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
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.email.EmailCodeSender;

// FP-87 N-02-3·N-03-2·N-04-3 이메일 인증 — AUTH-07 발송, AUTH-08 확인, 그리고 가입·재설정·이메일 변경이 인증 토큰을 한 번 쓰는 일(consume).
// VERIFICATION_CODE에는 이메일 HMAC과 코드 BCrypt 해시만 저장한다(원문 저장 안 함).
@Service
public class EmailVerificationService {

    public static final int CODE_TTL_SECONDS = 300;
    static final int MAX_ATTEMPTS = 5;
    static final String CHANNEL_EMAIL = "EMAIL";

    static final String INVALID_CODE = "INVALID_VERIFICATION_CODE";
    static final String INVALID_CODE_MESSAGE = "인증코드가 올바르지 않거나 만료되었습니다.";
    static final String VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED";
    static final String VERIFICATION_REQUIRED_MESSAGE = "이메일 인증을 다시 진행해 주세요.";

    private final VerificationCodeMapper codeMapper;
    private final UserAccountMapper userMapper;
    private final VerificationTokenService tokenService;
    private final EmailCodeSender sender;
    private final PasswordEncoder passwordEncoder;
    private final PiiHmac hmac;
    private final AvenueProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public EmailVerificationService(VerificationCodeMapper codeMapper, UserAccountMapper userMapper, VerificationTokenService tokenService,
            EmailCodeSender sender, PasswordEncoder passwordEncoder, PiiHmac hmac, AvenueProperties properties, Clock clock) {
        this.codeMapper = codeMapper;
        this.userMapper = userMapper;
        this.tokenService = tokenService;
        this.sender = sender;
        this.passwordEncoder = passwordEncoder;
        this.hmac = hmac;
        this.properties = properties;
        this.clock = clock;
    }

    // AUTH-07 인증코드 발송. 가입·이메일 변경 목적이면 이미 가입된 이메일을 막는다. 재설정 목적은 계정이 있는지 알려 주지 않고 항상 보낸다.
    @Transactional
    public AuthResponses.EmailSent send(AuthRequests.EmailSend request) {
        EmailPurpose purpose = purposeOf(request.purpose());
        String email = request.email().strip();
        if (!AccountRules.isValidEmail(email)) throw invalidEmail();
        String target = hmac.email(email);
        if (purpose.blocksUsedEmail() && userMapper.countByEmailHmac(target) > 0) throw AuthErrors.duplicateEmail();

        LocalDateTime now = LocalDateTime.now(clock);
        String code = newCode();
        VerificationCode row = new VerificationCode();
        row.setPurposeCode(purpose.dbCode());
        row.setChannelCode(CHANNEL_EMAIL);
        row.setTargetHmac(target);
        row.setCodeHash(passwordEncoder.encode(code));
        row.setExpiresAt(now.plusSeconds(CODE_TTL_SECONDS));
        row.setCreatedAt(now);
        codeMapper.insertCode(row);
        sender.send(email, code, purpose.name());
        return new AuthResponses.EmailSent(CODE_TTL_SECONDS);
    }

    // AUTH-08 인증코드 확인. 같은 목적·대상의 최근 코드만 본다. 틀리면 시도 횟수를 올리고 5회가 되면 그 코드는 쓸 수 없다.
    // 재설정 목적이면 코드가 맞은 뒤 아이디·이메일이 같은 일반 회원이 있는지 보고, 없으면 404(프론트 mock과 같은 순서).
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponses.EmailVerified verify(AuthRequests.EmailVerify request) {
        EmailPurpose purpose = purposeOf(request.purpose());
        String email = request.email().strip();
        String target = hmac.email(email);
        LocalDateTime now = LocalDateTime.now(clock);

        VerificationCode row = codeMapper.selectLatest(purpose.dbCode(), target);
        boolean usable = row != null && row.getVerifiedAt() == null && row.getAttemptCount() < MAX_ATTEMPTS && row.getExpiresAt().isAfter(now);
        if (!usable) throw invalidCode();
        if (!passwordEncoder.matches(request.code().strip(), row.getCodeHash())) {
            codeMapper.increaseAttempt(row.getVerificationId());
            throw invalidCode();
        }

        Long userId = null;
        if (purpose == EmailPurpose.RESET_PASSWORD) {
            UserAccount account = request.loginId() == null ? null : userMapper.selectUserByLoginIdAndEmailHmac(request.loginId().strip(), target);
            if (account == null) throw AuthErrors.accountNotFound();
            userId = account.getUserId();
        }
        codeMapper.markVerified(row.getVerificationId(), userId, now, now.plus(VerificationTokenService.LIFETIME));
        return new AuthResponses.EmailVerified(tokenService.issue(row.getVerificationId(), purpose.dbCode(), target));
    }

    // 인증 토큰을 한 번 쓴다. 목적·이메일이 토큰과 같아야 하고, expectedUserId를 주면 확인할 때 찾은 계정과도 같아야 한다.
    // 호출하는 쪽의 트랜잭션 안에서 부른다(가입이 실패하면 사용 처리도 되돌아간다).
    public void consume(String token, EmailPurpose purpose, String email, Long expectedUserId) {
        VerificationTokenService.Claim claim = tokenService.parse(token).orElseThrow(EmailVerificationService::verificationRequired);
        String target = hmac.email(email == null ? "" : email.strip());
        if (!claim.purposeCode().equals(purpose.dbCode()) || !claim.targetHmac().equals(target)) throw verificationRequired();
        VerificationCode row = codeMapper.selectById(claim.verificationId());
        if (row == null || !purpose.dbCode().equals(row.getPurposeCode()) || !target.equals(row.getTargetHmac())) throw verificationRequired();
        if (expectedUserId != null && !expectedUserId.equals(row.getUserId())) throw verificationRequired();
        if (codeMapper.consume(claim.verificationId(), LocalDateTime.now(clock)) != 1) throw verificationRequired();
    }

    // 6자리 숫자 코드. FIXED 모드면 고정 코드.
    private String newCode() {
        if (properties.getAuth().getEmail().getMode() == AvenueProperties.EmailMode.FIXED) {
            return properties.getAuth().getEmail().getFixedCode();
        }
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private static EmailPurpose purposeOf(String value) {
        return EmailPurpose.fromRequest(value).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "인증 목적이 올바르지 않습니다.",
                List.of(new FieldErrorItem("purpose", "인증 목적이 올바르지 않습니다."))));
    }

    private static ApiException invalidEmail() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "이메일 형식이 올바르지 않습니다.",
                List.of(new FieldErrorItem("email", "이메일 형식이 올바르지 않습니다.")));
    }

    private static ApiException invalidCode() {
        return new ApiException(HttpStatus.BAD_REQUEST, INVALID_CODE, INVALID_CODE_MESSAGE);
    }

    static ApiException verificationRequired() {
        return new ApiException(HttpStatus.BAD_REQUEST, VERIFICATION_REQUIRED, VERIFICATION_REQUIRED_MESSAGE);
    }
}
