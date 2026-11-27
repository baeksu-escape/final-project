package com.baeksuescape.admin.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.global.security.JwtTokenProvider.ScopedClaims;
import com.baeksuescape.global.security.JwtTokenProvider.ScopedToken;
import com.baeksuescape.global.security.TokenScope;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiMasking;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.AccountRules;
import com.baeksuescape.user.service.AuthErrors;
import com.baeksuescape.user.service.LoginAttemptService;
import com.baeksuescape.user.service.UserViewFactory;
import com.baeksuescape.user.service.email.EmailCodeSender;

// FP-80 N-01-1 관리자 이중 보안(11/14 결정) — 업무 이메일로 받은 6자리 번호를 확인해야 로그인·민감한 작업이 된다.
//   AUTH-01(관리자) → 번호 발송 + ADMIN_LOGIN_CHALLENGE 토큰 → AUTH-11 번호 확인 → ACCESS 토큰
//   (임시 비밀번호 상태면 ACCESS 대신 ADMIN_PASSWORD_SETUP 토큰 → 비밀번호를 바꿔야 ACCESS 토큰)
//   로그인한 관리자의 재확인(step-up) → ADMIN_STEP_UP 토큰 → 비밀번호 변경·관리자 추가·임시 비밀번호 재발급
// 번호는 VERIFICATION_CODE(PURPOSE_CODE='ADMIN_LOGIN', 재확인도 같은 목적)에 해시로만 저장한다. 짧은 토큰은 OneTimeTokenStore로 한 번만 쓴다.
@Service
public class AdminAuthService {

    // DDL CK_VCD_PURPOSE. TODO(2차) 재확인용 목적 코드 'ADMIN_STEP_UP'을 DDL에 추가하자고 제안한다(지금은 로그인과 같은 목적).
    static final String PURPOSE = "ADMIN_LOGIN";
    static final String CHANNEL = "EMAIL";
    static final int CODE_TTL_SECONDS = 300;
    static final int MAX_ATTEMPTS = 5;
    static final Duration RESEND_INTERVAL = Duration.ofMinutes(1);
    static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    static final Duration PASSWORD_SETUP_TTL = Duration.ofMinutes(10);
    static final Duration STEP_UP_TTL = Duration.ofMinutes(5);
    static final String LOG_SOURCE = "auth-service";

    // 프론트가 쓸 오류 code
    public static final String CHALLENGE_INVALID = "ADMIN_CHALLENGE_INVALID";
    public static final String CODE_INVALID = "INVALID_VERIFICATION_CODE";
    public static final String CODE_EXPIRED = "VERIFICATION_CODE_EXPIRED";
    public static final String ATTEMPTS_EXCEEDED = "VERIFICATION_ATTEMPTS_EXCEEDED";
    public static final String RESEND_TOO_SOON = "CODE_RESEND_TOO_SOON";
    public static final String PASSWORD_SETUP_INVALID = "PASSWORD_SETUP_INVALID";
    public static final String STEP_UP_REQUIRED = "STEP_UP_REQUIRED";
    public static final String EMAIL_UNAVAILABLE = "ADMIN_EMAIL_UNAVAILABLE";

    private static final Logger log = LoggerFactory.getLogger(AdminAuthService.class);

    private final VerificationCodeMapper codeMapper;
    private final UserAccountMapper userMapper;
    private final AdminAccountMapper adminMapper;
    private final JwtTokenProvider tokens;
    private final OneTimeTokenStore oneTimeTokens;
    private final EmailCodeSender sender;
    private final PasswordEncoder passwordEncoder;
    private final PiiCrypto crypto;
    private final UserViewFactory userViews;
    private final SystemLogService systemLog;
    private final AvenueProperties properties;
    private final Clock clock;
    private final LoginAttemptService loginAttempts;
    private final SecureRandom random = new SecureRandom();

    public AdminAuthService(VerificationCodeMapper codeMapper, UserAccountMapper userMapper, AdminAccountMapper adminMapper, JwtTokenProvider tokens,
            OneTimeTokenStore oneTimeTokens, EmailCodeSender sender, PasswordEncoder passwordEncoder, PiiCrypto crypto, UserViewFactory userViews,
            SystemLogService systemLog, AvenueProperties properties, Clock clock, LoginAttemptService loginAttempts) {
        this.codeMapper = codeMapper;
        this.userMapper = userMapper;
        this.adminMapper = adminMapper;
        this.tokens = tokens;
        this.oneTimeTokens = oneTimeTokens;
        this.sender = sender;
        this.passwordEncoder = passwordEncoder;
        this.crypto = crypto;
        this.userViews = userViews;
        this.systemLog = systemLog;
        this.properties = properties;
        this.clock = clock;
        this.loginAttempts = loginAttempts;
    }

    // ── 로그인 ──

    // AUTH-01 관리자 분기 — 비밀번호가 맞은 관리자에게 6자리 번호를 보내고 2단계 인증 대기 토큰(5분, 1회용)을 준다.
    // [다시 보내기]는 AUTH-01을 다시 부르는 것이다(새 번호·새 토큰, 이전 번호는 최신이 아니라 무효). 1분 안에 다시 부르면 429.
    // FP-258 로그인(AuthService.login)이 트랜잭션 밖으로 나가서, 번호 저장과 발송을 여기서 한 트랜잭션으로 묶는다(발송이 실패하면 저장도 되돌린다, 예전과 같음).
    @Transactional
    public AuthResponses.AdminChallenge startLogin(UserAccount admin) {
        SentCode sent = sendCode(admin);
        ScopedToken challenge = tokens.issueScoped(admin.getUserId(), admin.getRoleCode(), TokenScope.ADMIN_LOGIN_CHALLENGE, CHALLENGE_TTL);
        oneTimeTokens.register(challenge.jti(), challenge.expiresAt(), sent.verificationId());
        return new AuthResponses.AdminChallenge(true, challenge.token(), PiiMasking.email(sent.email()));
    }

    // AUTH-11 번호 확인. 맞으면 ACCESS 토큰, 임시 비밀번호 상태면 토큰 대신 비밀번호 설정 토큰을 준다.
    // 틀리면 시도 횟수를 올리고(5회면 그 번호는 못 씀) 대기 토큰은 그대로 둔다(다시 입력할 수 있게). 시도 횟수는 실패해도 저장한다.
    // FP-258 트랜잭션을 걸지 않는다(쓰기는 한 문장씩 바로 저장) — 성공 처리는 completeLogin이 계정 행 잠금 안(LoginAttemptService)에서 하고, 로그는 잠금 밖에서 남긴다.
    public AdminDtos.AdminLogin verifyLogin(AdminDtos.VerifyCode request) {
        String token = request == null ? null : request.challengeToken();
        ScopedClaims claims = tokens.parseScoped(token, TokenScope.ADMIN_LOGIN_CHALLENGE).orElseThrow(AdminAuthService::challengeInvalid);
        Long verificationId = oneTimeTokens.peek(claims.jti());
        if (verificationId == null) throw challengeInvalid();
        UserAccount admin = userMapper.selectById(claims.userId());
        if (admin == null || !admin.isAdmin() || admin.isWithdrawn()) throw challengeInvalid();
        // FP-258 잠긴 관리자는 회원용 안내(비밀번호 찾기) 대신 관리자 안내(423 ADMIN_ACCOUNT_LOCKED).
        if (admin.isLocked()) throw AuthErrors.adminAccountLocked();

        VerificationCode row = checkCode(admin, verificationId, request.code(), "관리자 2단계 인증");
        if (!oneTimeTokens.consume(claims.jti())) throw challengeInvalid();
        LocalDateTime now = LocalDateTime.now(clock);
        codeMapper.markVerified(row.getVerificationId(), admin.getUserId(), now, now);
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "관리자 2단계 인증 통과 (" + masked(admin) + ")", admin.getUserId());

        if (admin.isPasswordChangeRequired()) {
            ScopedToken setup = tokens.issueScoped(admin.getUserId(), admin.getRoleCode(), TokenScope.ADMIN_PASSWORD_SETUP, PASSWORD_SETUP_TTL);
            oneTimeTokens.register(setup.jti(), setup.expiresAt(), null);
            return new AdminDtos.AdminLogin(null, null, true, setup.token());
        }
        return completeLogin(admin, false);
    }

    // 첫 로그인(임시 비밀번호) 비밀번호 설정 — 설정 토큰(10분, 1회용)으로 새 비밀번호를 저장하고 그때 ACCESS 토큰을 준다.
    // 비밀번호 규칙·임시 비밀번호와 같은지를 먼저 보고, 통과한 뒤에 토큰을 쓴다(규칙에 걸리면 같은 토큰으로 다시 시도할 수 있다).
    // FP-258 verifyLogin과 같은 까닭으로 트랜잭션을 걸지 않는다(비밀번호 저장은 한 문장, 성공 처리는 completeLogin의 잠금 안).
    public AdminDtos.AdminLogin setupPassword(AdminDtos.PasswordSetup request) {
        String token = request == null ? null : request.passwordSetupToken();
        ScopedClaims claims = tokens.parseScoped(token, TokenScope.ADMIN_PASSWORD_SETUP).orElseThrow(AdminAuthService::passwordSetupInvalid);
        if (oneTimeTokens.peek(claims.jti()) == null) throw passwordSetupInvalid();
        UserAccount admin = userMapper.selectById(claims.userId());
        if (admin == null || !admin.isAdmin() || admin.isWithdrawn() || !admin.isPasswordChangeRequired()) throw passwordSetupInvalid();
        validateNewPassword(admin, request.newPassword());
        if (!oneTimeTokens.consume(claims.jti())) throw passwordSetupInvalid();

        adminMapper.updatePasswordChanged(admin.getUserId(), passwordEncoder.encode(request.newPassword()), LocalDateTime.now(clock));
        admin.setPasswordChangeRequiredYn("N");
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "관리자 첫 비밀번호 설정 (" + masked(admin) + ")", admin.getUserId());
        return completeLogin(admin, null);
    }

    // 로그인 완료 — 실패 횟수 0·마지막 로그인 시각, 로그인 성공 기록, ACCESS 토큰.
    // FP-258 성공 처리는 계정 행을 잠그고 다시 읽은 뒤 한다. 그사이 잠겼으면(10회째 실패·관리자 잠금) 423 ADMIN_ACCOUNT_LOCKED, 로그는 잠금이 끝난 뒤.
    private AdminDtos.AdminLogin completeLogin(UserAccount admin, Boolean passwordChangeRequired) {
        if (!loginAttempts.recordSuccess(admin.getUserId())) throw AuthErrors.adminAccountLocked();
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "로그인 성공 (" + masked(admin) + ")", admin.getUserId());
        return new AdminDtos.AdminLogin(tokens.issue(admin.getUserId(), admin.getRoleCode()), userViews.of(admin), passwordChangeRequired, null);
    }

    // ── 재확인(step-up) ──

    // POST /api/admin/me/step-up/send — 로그인한 관리자의 업무 이메일로 6자리 번호(1분에 1번).
    @Transactional
    public AdminDtos.StepUpSent sendStepUp(long adminId) {
        UserAccount admin = requireActiveAdmin(adminId);
        SentCode sent = sendCode(admin);
        return new AdminDtos.StepUpSent(CODE_TTL_SECONDS, PiiMasking.email(sent.email()));
    }

    // POST /api/admin/me/step-up/verify — 번호가 맞으면 재확인 토큰(5분, 1회용). 헤더 X-Step-Up-Token으로 민감한 작업에 보낸다.
    @Transactional(noRollbackFor = ApiException.class)
    public AdminDtos.StepUpToken verifyStepUp(long adminId, AdminDtos.StepUpVerify request) {
        UserAccount admin = requireActiveAdmin(adminId);
        VerificationCode row = checkCode(admin, null, request == null ? null : request.code(), "관리자 재확인");
        LocalDateTime now = LocalDateTime.now(clock);
        codeMapper.markVerified(row.getVerificationId(), admin.getUserId(), now, now);
        ScopedToken stepUp = tokens.issueScoped(admin.getUserId(), admin.getRoleCode(), TokenScope.ADMIN_STEP_UP, STEP_UP_TTL);
        oneTimeTokens.register(stepUp.jti(), stepUp.expiresAt(), null);
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "관리자 재확인 통과 (" + masked(admin) + ")", admin.getUserId());
        return new AdminDtos.StepUpToken(stepUp.token(), STEP_UP_TTL.toSeconds());
    }

    // 재확인 토큰을 검사만 한다(아직 쓰지 않음). 없거나 만료·사용됨·다른 관리자 것이면 401 STEP_UP_REQUIRED. 돌려준 jti로 나중에 consumeStepUp한다.
    // 입력 검사에 걸려도 같은 토큰으로 다시 시도할 수 있도록, 실제로 바꾸기 직전에 쓴다.
    public String checkStepUp(long adminId, String stepUpToken) {
        ScopedClaims claims = tokens.parseScoped(stepUpToken, TokenScope.ADMIN_STEP_UP).orElseThrow(AdminAuthService::stepUpRequired);
        if (claims.userId() != adminId || oneTimeTokens.peek(claims.jti()) == null) throw stepUpRequired();
        return claims.jti();
    }

    // 재확인 토큰을 한 번 쓴다. 그사이 다른 요청이 먼저 썼으면 401 STEP_UP_REQUIRED.
    public void consumeStepUp(String jti) {
        if (!oneTimeTokens.consume(jti)) throw stepUpRequired();
    }

    // 5-3 PUT /api/admin/me/password — 재확인 토큰 + 현재 비밀번호 확인 + 비밀번호 규칙(이전과 같은 비밀번호 거부).
    @Transactional
    public void changeMyPassword(long adminId, AdminDtos.PasswordChange request, String stepUpToken) {
        String jti = checkStepUp(adminId, stepUpToken);
        UserAccount admin = requireActiveAdmin(adminId);
        String current = request == null ? null : request.currentPassword();
        if (current == null || admin.getPasswordHash() == null || !passwordEncoder.matches(current, admin.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "현재 비밀번호가 올바르지 않습니다.",
                    List.of(new FieldErrorItem("currentPassword", "현재 비밀번호가 올바르지 않습니다.")));
        }
        validateNewPassword(admin, request.newPassword());
        consumeStepUp(jti);
        adminMapper.updatePasswordChanged(adminId, passwordEncoder.encode(request.newPassword()), LocalDateTime.now(clock));
        systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, "관리자 비밀번호 변경 (" + masked(admin) + ")", adminId);
    }

    // ── 공통 ──

    private record SentCode(long verificationId, String email) {
    }

    // 업무 이메일로 6자리 번호를 보낸다. 같은 관리자에게 1분에 1번까지(429). 번호는 해시만 저장한다.
    // 1분 제한은 아직 확인하지 않은 번호가 있을 때만 건다 — 로그인 번호를 확인한 직후 재확인 번호를 받는 것은 막지 않는다.
    private SentCode sendCode(UserAccount admin) {
        String email = plainEmail(admin);
        LocalDateTime now = LocalDateTime.now(clock);
        VerificationCode latest = codeMapper.selectLatest(PURPOSE, admin.getEmailHmac());
        if (latest != null && latest.getVerifiedAt() == null && latest.getCreatedAt() != null
                && latest.getCreatedAt().isAfter(now.minus(RESEND_INTERVAL))) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, RESEND_TOO_SOON, "인증번호는 1분에 한 번만 받을 수 있습니다. 잠시 후 다시 시도해 주세요.");
        }
        String code = newCode();
        VerificationCode row = new VerificationCode();
        row.setPurposeCode(PURPOSE);
        row.setChannelCode(CHANNEL);
        row.setTargetHmac(admin.getEmailHmac());
        row.setUserId(admin.getUserId());
        row.setCodeHash(passwordEncoder.encode(code));
        row.setExpiresAt(now.plusSeconds(CODE_TTL_SECONDS));
        row.setCreatedAt(now);
        codeMapper.insertCode(row);
        sender.send(email, code, PURPOSE);
        return new SentCode(row.getVerificationId(), email);
    }

    // 이 관리자의 최신 번호를 확인한다. expectedVerificationId가 있으면 그 번호가 최신이어야 한다(다시 보내면 이전 대기 토큰은 무효).
    // 만료·이미 씀·최신 아님 → 400 VERIFICATION_CODE_EXPIRED, 5회 틀림 → 400 VERIFICATION_ATTEMPTS_EXCEEDED, 틀림 → 400 INVALID_VERIFICATION_CODE.
    private VerificationCode checkCode(UserAccount admin, Long expectedVerificationId, String code, String action) {
        LocalDateTime now = LocalDateTime.now(clock);
        VerificationCode row = codeMapper.selectLatest(PURPOSE, admin.getEmailHmac());
        boolean usable = row != null && admin.getUserId().equals(row.getUserId()) && row.getVerifiedAt() == null && row.getExpiresAt().isAfter(now)
                && (expectedVerificationId == null || expectedVerificationId.equals(row.getVerificationId()));
        if (!usable) throw new ApiException(HttpStatus.BAD_REQUEST, CODE_EXPIRED, "인증번호가 만료되었습니다. 인증번호를 다시 받아 주세요.");
        if (row.getAttemptCount() >= MAX_ATTEMPTS) throw attemptsExceeded();
        if (code == null || !passwordEncoder.matches(code.strip(), row.getCodeHash())) {
            int attempts = row.getAttemptCount() + 1;
            codeMapper.increaseAttempt(row.getVerificationId());
            systemLog.record(SystemLogService.Type.AUTH, LOG_SOURCE, action + " 실패 " + attempts + "/" + MAX_ATTEMPTS + "회 (" + masked(admin) + ")",
                    admin.getUserId());
            if (attempts >= MAX_ATTEMPTS) throw attemptsExceeded();
            throw new ApiException(HttpStatus.BAD_REQUEST, CODE_INVALID, "인증번호가 올바르지 않습니다.");
        }
        return row;
    }

    // 새 비밀번호 — 작업 2의 규칙(영문·숫자 섞어 8자 이상)과 지금 비밀번호와 다른지.
    private void validateNewPassword(UserAccount admin, String newPassword) {
        List<FieldErrorItem> errors = new ArrayList<>();
        if (!AccountRules.isValidPassword(newPassword)) {
            errors.add(new FieldErrorItem("newPassword", "비밀번호 규칙을 지켜 주세요."));
        } else if (admin.getPasswordHash() != null && passwordEncoder.matches(newPassword, admin.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_PASSWORD", "지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요.",
                    List.of(new FieldErrorItem("newPassword", "지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요.")));
        }
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", errors.get(0).message(), errors);
    }

    private UserAccount requireActiveAdmin(long adminId) {
        UserAccount admin = userMapper.selectById(adminId);
        if (admin == null || !admin.isAdmin() || admin.isWithdrawn()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        }
        return admin;
    }

    // 번호를 보낼 업무 이메일 원문. 다른 키로 암호화돼 풀리지 않으면 409(로그에는 USER_ID만).
    private String plainEmail(UserAccount admin) {
        try {
            return crypto.decrypt(admin.getEmailEnc());
        } catch (RuntimeException e) {
            log.warn("관리자 업무 이메일을 복호화하지 못했습니다(userId={})", admin.getUserId());
            throw new ApiException(HttpStatus.CONFLICT, EMAIL_UNAVAILABLE, "업무 이메일을 확인할 수 없어 인증번호를 보낼 수 없습니다. 다른 관리자에게 문의해 주세요.");
        }
    }

    // 6자리 숫자. FIXED 모드면 고정 번호(EmailVerificationService와 같은 규칙).
    private String newCode() {
        if (properties.getAuth().getEmail().getMode() == AvenueProperties.EmailMode.FIXED) {
            return properties.getAuth().getEmail().getFixedCode();
        }
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private static String masked(UserAccount admin) {
        return SystemLogService.maskLoginId(admin.getLoginId());
    }

    static ApiException challengeInvalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, CHALLENGE_INVALID, "인증 시간이 지났거나 이미 사용한 요청입니다. 다시 로그인해 주세요.");
    }

    static ApiException passwordSetupInvalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, PASSWORD_SETUP_INVALID, "비밀번호 설정 시간이 지났거나 이미 사용한 요청입니다. 다시 로그인해 주세요.");
    }

    static ApiException attemptsExceeded() {
        return new ApiException(HttpStatus.BAD_REQUEST, ATTEMPTS_EXCEEDED, "인증번호를 5회 틀렸습니다. 인증번호를 다시 받아 주세요.");
    }

    public static ApiException stepUpRequired() {
        return new ApiException(HttpStatus.UNAUTHORIZED, STEP_UP_REQUIRED, "보안을 위해 인증번호를 다시 확인해 주세요.");
    }
}
