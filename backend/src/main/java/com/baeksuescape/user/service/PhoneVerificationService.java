package com.baeksuescape.user.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.phone.PhoneCodeSender;

// N-02 휴대폰 인증(11/18 1차 시연 후속) — 발송, 확인, 그리고 가입이 인증 토큰을 한 번 쓰는 일(consume).
// EmailVerificationService와 같은 구조·기준(유효 5분, 5회 틀리면 그 번호는 못 씀)이다. VERIFICATION_CODE에 CHANNEL_CODE='PHONE'으로
// 휴대폰 HMAC과 코드 BCrypt 해시만 저장한다(원문 저장 안 함, DDL 변경 없음).
@Service
public class PhoneVerificationService {

    public static final int CODE_TTL_SECONDS = EmailVerificationService.CODE_TTL_SECONDS;
    static final int MAX_ATTEMPTS = EmailVerificationService.MAX_ATTEMPTS;
    static final String CHANNEL_PHONE = "PHONE";

    static final String INVALID_CODE_MESSAGE = "인증번호가 올바르지 않거나 만료되었습니다.";
    static final String INVALID_PHONE_MESSAGE = "휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678";
    static final String VERIFICATION_REQUIRED_MESSAGE = "휴대폰 인증을 완료해 주세요.";

    private final VerificationCodeMapper codeMapper;
    private final VerificationTokenService tokenService;
    private final PhoneCodeSender sender;
    private final PasswordEncoder passwordEncoder;
    private final PiiHmac hmac;
    private final AvenueProperties properties;
    private final Clock clock;
    private final CodeSendGuard sendGuard;
    private final SecureRandom random = new SecureRandom();

    public PhoneVerificationService(VerificationCodeMapper codeMapper, VerificationTokenService tokenService, PhoneCodeSender sender,
            PasswordEncoder passwordEncoder, PiiHmac hmac, AvenueProperties properties, Clock clock, CodeSendGuard sendGuard) {
        this.sendGuard = sendGuard;
        this.codeMapper = codeMapper;
        this.tokenService = tokenService;
        this.sender = sender;
        this.passwordEncoder = passwordEncoder;
        this.hmac = hmac;
        this.properties = properties;
        this.clock = clock;
    }

    // 인증번호 발송 — { phone, purpose } → { expiresInSeconds }. 번호 형식이 틀리면 400(phone 칸 오류).
    // FP-258 PR #173 같은 번호의 발송은 sendGuard 잠금 안에서 한 트랜잭션으로 한다(이메일 발송과 같은 방식).
    public AuthResponses.PhoneSent send(AuthRequests.PhoneSend request) {
        PhonePurpose purpose = purposeOf(request.purpose());
        String phone = AccountRules.normalizePhone(request.phone());
        if (!AccountRules.isValidPhone(phone)) throw invalidPhone();

        String target = hmac.phone(phone);
        return sendGuard.run(CHANNEL_PHONE, target, () -> {
            LocalDateTime now = LocalDateTime.now(clock);
            // FP-258 13차 같은 번호로 오늘(0시부터) 보낸 횟수가 상한이면 429(가입·아이디 찾기 목적을 함께 센다).
            if (codeMapper.countSentSince(CHANNEL_PHONE, target, now.toLocalDate().atStartOfDay()) >= AuthErrors.DAILY_CODE_SEND_LIMIT) {
                throw AuthErrors.codeSendDailyLimit("번호");
            }
            String code = newCode();
            VerificationCode row = new VerificationCode();
            row.setPurposeCode(purpose.dbCode());
            row.setChannelCode(CHANNEL_PHONE);
            row.setTargetHmac(target);
            row.setCodeHash(passwordEncoder.encode(code));
            row.setExpiresAt(now.plusSeconds(CODE_TTL_SECONDS));
            row.setCreatedAt(now);
            codeMapper.insertCode(row);
            sender.send(phone, code, purpose.name());
            return new AuthResponses.PhoneSent(CODE_TTL_SECONDS);
        });
    }

    // 인증번호 확인 — 같은 목적·번호의 최근 발송 1건만 본다. 틀리면 시도 횟수를 올리고, 5회가 되면 그 번호는 쓸 수 없다.
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponses.PhoneVerified verify(AuthRequests.PhoneVerify request) {
        PhonePurpose purpose = purposeOf(request.purpose());
        String target = hmac.phone(AccountRules.normalizePhone(request.phone()));
        LocalDateTime now = LocalDateTime.now(clock);

        VerificationCode row = codeMapper.selectLatest(purpose.dbCode(), target);
        boolean usable = row != null && CHANNEL_PHONE.equals(row.getChannelCode()) && row.getVerifiedAt() == null
                && row.getAttemptCount() < MAX_ATTEMPTS && row.getExpiresAt().isAfter(now);
        if (!usable) throw invalidCode();
        if (!passwordEncoder.matches(request.code().strip(), row.getCodeHash())) {
            codeMapper.increaseAttempt(row.getVerificationId());
            throw invalidCode();
        }
        codeMapper.markVerified(row.getVerificationId(), null, now, now.plus(VerificationTokenService.LIFETIME));
        return new AuthResponses.PhoneVerified(tokenService.issuePhone(row.getVerificationId(), purpose.dbCode(), target));
    }

    // 휴대폰 인증 토큰을 한 번 쓴다. 휴대폰 종류의 토큰이어야 하고, 목적·번호(HMAC)가 같아야 한다. 아니면 400(phone 칸 오류).
    // 호출하는 쪽의 트랜잭션 안에서 부른다(가입이 실패하면 사용 처리도 되돌아간다).
    public void consume(String token, PhonePurpose purpose, String phone) {
        VerificationTokenService.Claim claim = tokenService.parsePhone(token).orElseThrow(PhoneVerificationService::verificationRequired);
        String target = hmac.phone(AccountRules.normalizePhone(phone));
        if (!claim.purposeCode().equals(purpose.dbCode()) || !claim.targetHmac().equals(target)) throw verificationRequired();
        VerificationCode row = codeMapper.selectById(claim.verificationId());
        if (row == null || !CHANNEL_PHONE.equals(row.getChannelCode()) || !purpose.dbCode().equals(row.getPurposeCode())
                || !target.equals(row.getTargetHmac())) {
            throw verificationRequired();
        }
        if (codeMapper.consume(claim.verificationId(), LocalDateTime.now(clock)) != 1) throw verificationRequired();
    }

    // 6자리 숫자 번호. FIXED 모드면 고정 번호.
    private String newCode() {
        if (properties.getAuth().getPhone().getMode() == AvenueProperties.PhoneMode.FIXED) {
            return properties.getAuth().getPhone().getFixedCode();
        }
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private static PhonePurpose purposeOf(String value) {
        return PhonePurpose.fromRequest(value).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "인증 목적이 올바르지 않습니다.",
                List.of(new FieldErrorItem("purpose", "인증 목적이 올바르지 않습니다."))));
    }

    private static ApiException invalidPhone() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", INVALID_PHONE_MESSAGE, List.of(new FieldErrorItem("phone", INVALID_PHONE_MESSAGE)));
    }

    private static ApiException invalidCode() {
        return new ApiException(HttpStatus.BAD_REQUEST, EmailVerificationService.INVALID_CODE, INVALID_CODE_MESSAGE);
    }

    static ApiException verificationRequired() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", VERIFICATION_REQUIRED_MESSAGE,
                List.of(new FieldErrorItem("phone", VERIFICATION_REQUIRED_MESSAGE)));
    }
}
