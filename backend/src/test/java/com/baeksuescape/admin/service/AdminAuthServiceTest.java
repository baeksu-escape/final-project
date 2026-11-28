package com.baeksuescape.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionOperations;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.global.security.TestTokens;
import com.baeksuescape.global.security.TokenScope;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.LoginAttemptService;
import com.baeksuescape.user.service.UserViewFactory;
import com.baeksuescape.user.service.email.EmailCodeSender;

// FP-80 관리자 이중 보안 — 2단계 인증(만료·5회·재사용), 1회용 토큰 두 번째 사용 거부, scope가 다른 토큰 거부, 첫 로그인 비밀번호 설정, 재확인.
// DB는 mock(인증번호 표는 메모리 목록)으로 대신하고, 이메일은 FIXED 번호(123456)로 보낸 것으로 본다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminAuthServiceTest {

    static final String CODE = "123456";
    static final String PASSWORD = "admin1234";
    static final PiiCrypto CRYPTO = new PiiCrypto(TestKeys.AES);
    static final PiiHmac HMAC = new PiiHmac(TestKeys.HMAC);
    static final PasswordEncoder ENCODER = new BCryptPasswordEncoder(4);

    @Mock
    private VerificationCodeMapper codeMapper;
    @Mock
    private UserAccountMapper userMapper;
    @Mock
    private AdminAccountMapper adminMapper;
    @Mock
    private EmailCodeSender sender;
    @Mock
    private SystemLogMapper systemLogMapper;

    private MutableClock clock;
    private JwtTokenProvider tokens;
    private OneTimeTokenStore store;
    private AdminAuthService service;
    private UserAccount admin;
    // VERIFICATION_CODE 대신 쓰는 메모리 목록
    private final List<VerificationCode> codes = new ArrayList<>();

    // 테스트 안에서 시각을 앞으로 돌리는 시계(서울). JWT 발급·만료 확인도 같은 시계를 쓴다.
    static final class MutableClock extends Clock {
        private Instant now = Instant.now();

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("Asia/Seoul");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    static UserAccount admin(long userId, String loginId) {
        UserAccount account = new UserAccount();
        account.setUserId(userId);
        account.setLoginId(loginId);
        account.setPasswordHash(ENCODER.encode(PASSWORD));
        account.setNickname("관리자" + userId);
        account.setNameEnc(CRYPTO.encrypt("김관리"));
        account.setEmailEnc(CRYPTO.encrypt(loginId + "@example.com"));
        account.setEmailHmac(HMAC.email(loginId + "@example.com"));
        account.setRoleCode(UserAccount.ROLE_ADMIN);
        account.setAccountStatusCode(UserAccount.ACTIVE);
        account.setPasswordChangeRequiredYn("N");
        return account;
    }

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        AvenueProperties properties = TestKeys.properties();
        properties.getAuth().getEmail().setMode(AvenueProperties.EmailMode.FIXED);
        properties.getAuth().getEmail().setFixedCode(CODE);
        tokens = TestTokens.provider(properties, clock);
        store = new OneTimeTokenStore(clock);
        service = new AdminAuthService(codeMapper, userMapper, adminMapper, tokens, store, sender, ENCODER, CRYPTO,
                new UserViewFactory(userMapper, CRYPTO), new SystemLogService(systemLogMapper, TransactionOperations.withoutTransaction(), clock),
                properties, clock, new LoginAttemptService(userMapper, ENCODER, clock));
        admin = admin(1L, "admin01");
        given(userMapper.selectById(1L)).willAnswer(invocation -> admin);
        fakeCodeTable();
    }

    // insertCode·selectLatest·increaseAttempt·markVerified를 메모리 목록으로 흉내 낸다.
    private void fakeCodeTable() {
        doAnswer(invocation -> {
            VerificationCode row = invocation.getArgument(0);
            row.setVerificationId((long) codes.size() + 1);
            codes.add(row);
            return 1;
        }).when(codeMapper).insertCode(any());
        given(codeMapper.selectLatest(anyString(), anyString())).willAnswer(invocation -> codes.stream()
                .filter(row -> row.getPurposeCode().equals(invocation.getArgument(0)) && row.getTargetHmac().equals(invocation.getArgument(1)))
                .reduce((first, second) -> second).orElse(null));
        doAnswer(invocation -> {
            VerificationCode row = codes.get(((Long) invocation.getArgument(0)).intValue() - 1);
            row.setAttemptCount(row.getAttemptCount() + 1);
            return 1;
        }).when(codeMapper).increaseAttempt(anyLong());
        doAnswer(invocation -> {
            codes.get(((Long) invocation.getArgument(0)).intValue() - 1).setVerifiedAt(invocation.getArgument(2));
            return 1;
        }).when(codeMapper).markVerified(anyLong(), any(), any(), any());
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getStatus().value() + " " + e.getCode();
        }
        return "no error";
    }

    private String challenge() {
        return service.startLogin(admin).challengeToken();
    }

    // ── AUTH-01 관리자 → 번호 발송 ──

    @Test
    void startLoginSendsCodeToWorkEmailAndGivesChallengeOnly() {
        AuthResponses.AdminChallenge result = service.startLogin(admin);

        assertThat(result.twoFactorRequired()).isTrue();
        assertThat(result.maskedEmail()).isEqualTo("ad*****@example.com");
        verify(sender).send("admin01@example.com", CODE, "ADMIN_LOGIN");
        VerificationCode saved = codes.get(0);
        assertThat(saved.getPurposeCode()).isEqualTo("ADMIN_LOGIN");
        assertThat(saved.getChannelCode()).isEqualTo("EMAIL");
        assertThat(saved.getUserId()).isEqualTo(1L);
        assertThat(saved.getCodeHash()).isNotEqualTo(CODE);
        // 대기 토큰은 ACCESS가 아니라 JWT 필터가 로그인으로 받지 않는다(/api/** → 401).
        assertThat(tokens.parse(result.challengeToken())).isEmpty();
        assertThat(tokens.parseScoped(result.challengeToken(), TokenScope.ADMIN_LOGIN_CHALLENGE)).isPresent();
    }

    @Test
    void sendingAgainWithinOneMinuteIs429() {
        service.startLogin(admin);
        clock.advance(Duration.ofSeconds(59));
        assertThat(codeOf(() -> service.startLogin(admin))).isEqualTo("429 CODE_RESEND_TOO_SOON");
        clock.advance(Duration.ofSeconds(2));
        assertThat(codeOf(() -> service.startLogin(admin))).isEqualTo("no error");
    }

    // 로그인 번호를 확인한 직후(1분 안)에도 재확인 번호는 받을 수 있다 — 1분 제한은 확인하지 않은 번호가 있을 때만.
    @Test
    void stepUpRightAfterVerifiedLoginIsNotRateLimited() {
        service.verifyLogin(new AdminDtos.VerifyCode(challenge(), CODE));
        clock.advance(Duration.ofSeconds(10));

        assertThat(codeOf(() -> service.sendStepUp(1L))).isEqualTo("no error");
        assertThat(codeOf(() -> service.sendStepUp(1L))).isEqualTo("429 CODE_RESEND_TOO_SOON");
    }

    // ── AUTH-11 ──

    @Test
    void rightCodeGivesAccessTokenAndRecordsPass() {
        AdminDtos.AdminLogin result = service.verifyLogin(new AdminDtos.VerifyCode(challenge(), CODE));

        assertThat(tokens.parse(result.token())).isPresent();
        assertThat(result.passwordChangeRequired()).isFalse();
        assertThat(result.passwordSetupToken()).isNull();
        assertThat(result.user().role()).isEqualTo("ROLE_ADMIN");
        verify(userMapper).updateLoginSuccess(eq(1L), any());
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("auth-service"), eq("관리자 2단계 인증 통과 (ad***)"), eq(1L), any());
        // FP-258 성공 처리는 계정 행을 잠근 뒤 한다.
        InOrder order = inOrder(userMapper);
        order.verify(userMapper).lockUser(1L);
        order.verify(userMapper).updateLoginSuccess(eq(1L), any());
    }

    // FP-258 번호를 확인하는 사이 다른 요청이 10회째 실패로 잠그면, 잠근 뒤 다시 읽은 값으로 423 ADMIN_ACCOUNT_LOCKED이고 실패 횟수를 지우지 않는다.
    @Test
    void lockedWhileVerifyingIs423AndKeepsFailureCount() {
        String challenge = challenge();
        given(userMapper.lockUser(1L)).willAnswer(invocation -> {
            admin.setAccountStatusCode(UserAccount.LOCKED);
            return 1L;
        });

        assertThatThrownBy(() -> service.verifyLogin(new AdminDtos.VerifyCode(challenge, CODE)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("ADMIN_ACCOUNT_LOCKED"));
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
        verify(systemLogMapper, never()).insertLog(eq("AUTH"), eq("auth-service"), eq("로그인 성공 (ad***)"), eq(1L), any());
    }

    @Test
    void challengeTokenIsOneTimeSecondUseIsRejected() {
        String challenge = challenge();
        service.verifyLogin(new AdminDtos.VerifyCode(challenge, CODE));

        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(challenge, CODE)))).isEqualTo("400 ADMIN_CHALLENGE_INVALID");
    }

    @Test
    void wrongCodeCountsAttemptsAndFifthLocksTheCode() {
        String challenge = challenge();
        for (int i = 1; i <= 4; i++) {
            assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(challenge, "000000")))).isEqualTo("400 INVALID_VERIFICATION_CODE");
        }
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(challenge, "000000")))).isEqualTo("400 VERIFICATION_ATTEMPTS_EXCEEDED");
        // 5회 틀린 뒤에는 맞는 번호도 쓸 수 없다.
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(challenge, CODE)))).isEqualTo("400 VERIFICATION_ATTEMPTS_EXCEEDED");
        assertThat(codes.get(0).getAttemptCount()).isEqualTo(5);
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("auth-service"), eq("관리자 2단계 인증 실패 5/5회 (ad***)"), eq(1L), any());
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    @Test
    void expiredOrSupersededCodeIsRejected() {
        String first = challenge();
        clock.advance(Duration.ofSeconds(301));
        // 번호(5분)와 대기 토큰(5분)이 함께 만료된다 — 어느 쪽이 먼저 걸려도 400으로 다시 받게 한다.
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(first, CODE)))).isIn("400 VERIFICATION_CODE_EXPIRED",
                "400 ADMIN_CHALLENGE_INVALID");

        // [다시 보내기] = AUTH-01을 다시 부름 → 이전 대기 토큰의 번호는 최신이 아니라 무효
        String second = challenge();
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(first, CODE)))).isIn("400 VERIFICATION_CODE_EXPIRED",
                "400 ADMIN_CHALLENGE_INVALID");
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(second, CODE)))).isEqualTo("no error");
    }

    @Test
    void tokensOfOtherScopesAreRejected() {
        String access = tokens.issue(1L, "ROLE_ADMIN");
        String stepUp = tokens.issueScoped(1L, "ROLE_ADMIN", TokenScope.ADMIN_STEP_UP, Duration.ofMinutes(5)).token();
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(access, CODE)))).isEqualTo("400 ADMIN_CHALLENGE_INVALID");
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(stepUp, CODE)))).isEqualTo("400 ADMIN_CHALLENGE_INVALID");
        assertThat(codeOf(() -> service.setupPassword(new AdminDtos.PasswordSetup(access, "newpass99")))).isEqualTo("400 PASSWORD_SETUP_INVALID");
        // 서명은 맞지만 서버가 발급 목록에 없는 토큰(예: 서버 재시작 전 발급)도 거부한다.
        String unregistered = tokens.issueScoped(1L, "ROLE_ADMIN", TokenScope.ADMIN_LOGIN_CHALLENGE, Duration.ofMinutes(5)).token();
        assertThat(codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(unregistered, CODE)))).isEqualTo("400 ADMIN_CHALLENGE_INVALID");
    }

    // ── 첫 로그인(임시 비밀번호) ──

    @Test
    void firstLoginGivesNoAccessTokenUntilPasswordIsChanged() {
        admin.setPasswordChangeRequiredYn("Y");

        AdminDtos.AdminLogin verified = service.verifyLogin(new AdminDtos.VerifyCode(challenge(), CODE));

        assertThat(verified.token()).isNull();
        assertThat(verified.passwordChangeRequired()).isTrue();
        assertThat(tokens.parse(verified.passwordSetupToken())).isEmpty();
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());

        // 임시 비밀번호와 같은 비밀번호·규칙 위반은 거부하고, 같은 설정 토큰으로 다시 시도할 수 있다.
        String setup = verified.passwordSetupToken();
        assertThat(codeOf(() -> service.setupPassword(new AdminDtos.PasswordSetup(setup, PASSWORD)))).isEqualTo("400 SAME_PASSWORD");
        assertThat(codeOf(() -> service.setupPassword(new AdminDtos.PasswordSetup(setup, "short")))).isEqualTo("400 INVALID_INPUT");

        AdminDtos.AdminLogin done = service.setupPassword(new AdminDtos.PasswordSetup(setup, "newpass99"));
        assertThat(tokens.parse(done.token())).isPresent();
        assertThat(done.passwordChangeRequired()).isNull();
        verify(adminMapper).updatePasswordChanged(eq(1L), anyString(), any());
        // 설정 토큰도 1회용
        assertThat(codeOf(() -> service.setupPassword(new AdminDtos.PasswordSetup(setup, "newpass77")))).isEqualTo("400 PASSWORD_SETUP_INVALID");
    }

    // ── 재확인(step-up) ──

    @Test
    void stepUpTokenIsOneTimeAndBoundToTheAdmin() {
        service.sendStepUp(1L);
        AdminDtos.StepUpToken stepUp = service.verifyStepUp(1L, new AdminDtos.StepUpVerify(CODE));
        assertThat(stepUp.expiresIn()).isEqualTo(300);
        assertThat(tokens.parse(stepUp.stepUpToken())).isEmpty();

        // 다른 관리자는 쓸 수 없다.
        assertThat(codeOf(() -> service.checkStepUp(2L, stepUp.stepUpToken()))).isEqualTo("401 STEP_UP_REQUIRED");
        String jti = service.checkStepUp(1L, stepUp.stepUpToken());
        service.consumeStepUp(jti);
        assertThat(codeOf(() -> service.consumeStepUp(jti))).isEqualTo("401 STEP_UP_REQUIRED");
        assertThat(codeOf(() -> service.checkStepUp(1L, stepUp.stepUpToken()))).isEqualTo("401 STEP_UP_REQUIRED");
    }

    @Test
    void changeMyPasswordNeedsStepUpAndCurrentPassword() {
        AdminDtos.PasswordChange change = new AdminDtos.PasswordChange(PASSWORD, "newpass99");
        assertThat(codeOf(() -> service.changeMyPassword(1L, change, null))).isEqualTo("401 STEP_UP_REQUIRED");

        service.sendStepUp(1L);
        String stepUp = service.verifyStepUp(1L, new AdminDtos.StepUpVerify(CODE)).stepUpToken();
        assertThat(codeOf(() -> service.changeMyPassword(1L, new AdminDtos.PasswordChange("wrong1234", "newpass99"), stepUp)))
                .isEqualTo("400 INVALID_PASSWORD");
        assertThat(codeOf(() -> service.changeMyPassword(1L, new AdminDtos.PasswordChange(PASSWORD, PASSWORD), stepUp)))
                .isEqualTo("400 SAME_PASSWORD");
        // 검사에 걸린 동안에는 재확인 토큰을 쓰지 않았으므로 같은 토큰으로 바꿀 수 있다.
        service.changeMyPassword(1L, change, stepUp);
        verify(adminMapper).updatePasswordChanged(eq(1L), anyString(), any());
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("auth-service"), eq("관리자 비밀번호 변경 (ad***)"), eq(1L), any());
    }

    @Test
    void codeIsNeverWrittenToSystemLog() {
        String challenge = challenge();
        codeOf(() -> service.verifyLogin(new AdminDtos.VerifyCode(challenge, "000000")));
        service.verifyLogin(new AdminDtos.VerifyCode(challenge, CODE));

        ArgumentCaptor<String> messages = ArgumentCaptor.forClass(String.class);
        verify(systemLogMapper, atLeastOnce()).insertLog(anyString(), anyString(), messages.capture(), any(), any());
        assertThat(messages.getAllValues()).noneMatch(message -> message.contains(CODE) || message.contains("000000")
                || message.contains("admin01") || message.contains("@"));
    }
}
