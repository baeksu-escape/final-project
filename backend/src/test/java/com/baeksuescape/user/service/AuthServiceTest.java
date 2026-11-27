package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.UserFixtures.CLOCK;
import static com.baeksuescape.user.service.UserFixtures.CRYPTO;
import static com.baeksuescape.user.service.UserFixtures.ENCODER;
import static com.baeksuescape.user.service.UserFixtures.HMAC;
import static com.baeksuescape.user.service.UserFixtures.PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionOperations;

import com.baeksuescape.admin.service.AdminAuthService;
import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.service.social.DevSocialStore;

// FP-87 AuthService — 로그인 잠금·관리자 차단, 가입 검사·중복·동의, 아이디 찾기, 비밀번호 재설정. DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    @Mock
    private UserAccountMapper userMapper;
    @Mock
    private UserConsentMapper consentMapper;
    @Mock
    private UserSocialAccountMapper socialMapper;
    @Mock
    private EmailVerificationService emailVerification;
    @Mock
    private PhoneVerificationService phoneVerification;
    @Mock
    private AdminAuthService adminAuth;
    @Mock
    private SystemLogMapper systemLogMapper;

    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(TestKeys.properties());
    private final DevSocialStore socialStore = new DevSocialStore(CLOCK);
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(userMapper, consentMapper, socialMapper, emailVerification, phoneVerification, socialStore,
                new UserViewFactory(userMapper, CRYPTO), tokenProvider, ENCODER, CRYPTO, HMAC, CLOCK, adminAuth,
                new SystemLogService(systemLogMapper, TransactionOperations.withoutTransaction(), CLOCK));
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getStatus().value() + " " + e.getCode();
        }
        return "no error";
    }

    // ---- AUTH-01 로그인 ----

    @Test
    void 로그인_성공하면_토큰과_가린_이름을_주고_실패_횟수를_비운다() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setLoginFailCount(3);
        given(userMapper.selectByLoginId("employee")).willReturn(account);
        given(userMapper.countScoredAssessments(7L)).willReturn(1);

        AuthResponses.Login result = (AuthResponses.Login) service.login(new AuthRequests.Login("employee", PASSWORD));

        assertThat(tokenProvider.parse(result.accessToken())).isPresent();
        assertThat(result.user()).isEqualTo(new AuthResponses.UserView(7L, "홍*동", "ROLE_USER", "EMPLOYEE", true));
        assertThat(result.devMode()).isNull();
        verify(userMapper).updateLoginSuccess(eq(7L), any());
    }

    // FP-258 로그인 아이디는 앞뒤 공백을 빼고 소문자로 바꿔 조회한다(시드 demo_employee처럼 밑줄이 있는 아이디 포함).
    @Test
    void 로그인_아이디는_대문자로_입력해도_소문자로_조회한다() {
        given(userMapper.selectByLoginId("demo_employee")).willReturn(UserFixtures.user(7L, "demo_employee"));
        AuthResponses.Login result = (AuthResponses.Login) service.login(new AuthRequests.Login(" Demo_Employee ", PASSWORD));
        assertThat(tokenProvider.parse(result.accessToken())).isPresent();
        verify(userMapper).selectByLoginId("demo_employee");
    }

    @Test
    void 비밀번호가_틀리면_401이고_실패_횟수를_올린다() {
        given(userMapper.selectByLoginId("employee")).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        verify(userMapper).updateLoginFailure(eq(7L), eq(1), eq(false), any());
    }

    // FP-258 단계적 제한 — 5회째 실패하면 429(5분), 제한 중에는 맞는 비밀번호도 429이고 횟수를 올리지 않는다.
    @Test
    void 다섯_번째로_틀리면_5분_제한_429이고_잠그지_않는다() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setLoginFailCount(4);
        given(userMapper.selectByLoginId("employee")).willReturn(account);
        assertThatThrownBy(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus().value()).isEqualTo(429);
                    assertThat(e.getCode()).isEqualTo("LOGIN_TEMPORARILY_BLOCKED");
                    assertThat(e.getMessage()).contains("5분");
                });
        verify(userMapper).updateLoginFailure(eq(7L), eq(5), eq(false), any());
    }

    @Test
    void 제한_중에는_맞는_비밀번호도_429이고_횟수를_올리지_않으며_남은_분을_올림해_알린다() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setLoginFailCount(5);
        account.setLastLoginFailAt(java.time.LocalDateTime.now(CLOCK).minusSeconds(61));
        given(userMapper.selectByLoginId("employee")).willReturn(account);

        assertThatThrownBy(() -> service.login(new AuthRequests.Login("employee", PASSWORD)))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("LOGIN_TEMPORARILY_BLOCKED");
                    assertThat(e.getMessage()).contains("4분");
                });
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("429 LOGIN_TEMPORARILY_BLOCKED");
        verify(userMapper, never()).updateLoginFailure(anyLong(), anyInt(), anyBoolean(), any());
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    @Test
    void 제한이_끝나면_맞는_비밀번호로_로그인되고_틀리면_6회째는_401() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setLoginFailCount(5);
        account.setLastLoginFailAt(java.time.LocalDateTime.now(CLOCK).minusMinutes(5));
        given(userMapper.selectByLoginId("employee")).willReturn(account);

        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        verify(userMapper).updateLoginFailure(eq(7L), eq(6), eq(false), any());
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", PASSWORD)))).isEqualTo("no error");
    }

    // FP-258 PR #164 검수 — 5분 제한은 마지막 실패 시각으로만 잰다. 닉네임·이메일 변경으로 UPDATED_AT이 바뀌어도 늘어나거나 다시 시작되지 않는다.
    @Test
    void 다섯_번_실패_뒤_다른_정보를_고쳐도_제한은_마지막_실패_5분_뒤에_끝난다() {
        java.time.LocalDateTime now = java.time.LocalDateTime.now(CLOCK);
        UserAccount changedAfterFailure = UserFixtures.user(7L, "employee");
        changedAfterFailure.setLoginFailCount(5);
        changedAfterFailure.setLastLoginFailAt(now.minusMinutes(5));
        changedAfterFailure.setUpdatedAt(now); // 방금 닉네임을 바꿈
        given(userMapper.selectByLoginId("employee")).willReturn(changedAfterFailure);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", PASSWORD)))).isEqualTo("no error");

        UserAccount recentFailure = UserFixtures.user(8L, "seconduser");
        recentFailure.setLoginFailCount(5);
        recentFailure.setLastLoginFailAt(now.minusSeconds(61));
        recentFailure.setUpdatedAt(now.minusDays(1));
        given(userMapper.selectByLoginId("seconduser")).willReturn(recentFailure);
        assertThatThrownBy(() -> service.login(new AuthRequests.Login("seconduser", PASSWORD)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).contains("4분"));
    }

    @Test
    void 열_번째로_틀리면_잠그고_423() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setLoginFailCount(9);
        given(userMapper.selectByLoginId("employee")).willReturn(account);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("423 ACCOUNT_LOCKED");
        verify(userMapper).updateLoginFailure(eq(7L), eq(10), eq(true), any());
    }

    @Test
    void 잠긴_계정은_비밀번호가_맞을_때만_423이고_틀리면_401() {
        given(userMapper.selectByLoginId("locked")).willReturn(UserFixtures.account(8L, "locked", UserAccount.ROLE_USER, UserAccount.LOCKED));
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("locked", PASSWORD)))).isEqualTo("423 ACCOUNT_LOCKED");
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("locked", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        verify(userMapper, never()).updateLoginFailure(anyLong(), anyInt(), anyBoolean(), any());
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    // FP-258 PR #164 검수 — 관리자는 비밀번호 찾기로 잠금을 풀 수 없어, 잠긴 관리자가 맞는 비밀번호를 넣으면 다른 code·문구(423 ADMIN_ACCOUNT_LOCKED)다.
    @Test
    void 잠긴_관리자는_비밀번호가_맞으면_423_ADMIN_ACCOUNT_LOCKED이고_틀리면_401() {
        given(userMapper.selectByLoginId("admin")).willReturn(UserFixtures.account(1L, "admin", UserAccount.ROLE_ADMIN, UserAccount.LOCKED));
        assertThatThrownBy(() -> service.login(new AuthRequests.Login("admin", PASSWORD)))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus().value()).isEqualTo(423);
                    assertThat(e.getCode()).isEqualTo("ADMIN_ACCOUNT_LOCKED");
                    assertThat(e.getMessage()).isEqualTo("잠긴 관리자 계정입니다. 다른 관리자에게 잠금 해제를 요청해 주세요.");
                });
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("admin", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        verify(adminAuth, never()).startLogin(any());
        verify(userMapper, never()).updateLoginFailure(anyLong(), anyInt(), anyBoolean(), any());
    }

    // FP-80 관리자는 비밀번호가 맞아도 토큰을 주지 않고 2단계 인증 대기 응답(AdminAuthService.startLogin)으로 넘어간다.
    @Test
    void 관리자는_비밀번호가_맞아도_토큰_없이_2단계_인증으로_넘어간다() {
        UserAccount admin = UserFixtures.account(1L, "admin", UserAccount.ROLE_ADMIN, UserAccount.ACTIVE);
        given(userMapper.selectByLoginId("admin")).willReturn(admin);
        given(adminAuth.startLogin(admin)).willReturn(new AuthResponses.AdminChallenge(true, "challenge-1", "ad***@example.com"));

        AuthResponses.LoginResult result = service.login(new AuthRequests.Login("admin", PASSWORD));

        assertThat(result).isEqualTo(new AuthResponses.AdminChallenge(true, "challenge-1", "ad***@example.com"));
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    // FP-80 N-28-1 로그인 성공(AUTH)·실패 n/10회(WARN)·5분 제한(WARN, FP-258)·자동 잠금(WARN)을 남긴다. 아이디는 앞 2자 + *** 만.
    @Test
    void 로그인_성공_실패_제한_자동_잠금을_시스템_로그에_가린_아이디로_남긴다() {
        UserAccount account = UserFixtures.user(7L, "employee");
        given(userMapper.selectByLoginId("employee")).willReturn(account);
        service.login(new AuthRequests.Login("employee", PASSWORD));
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("auth-service"), eq("로그인 성공 (em***)"), eq(7L), any());

        account.setLoginFailCount(4);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("429 LOGIN_TEMPORARILY_BLOCKED");
        verify(systemLogMapper).insertLog(eq("WARN"), eq("auth-service"), eq("로그인 실패 5/10회 (em***)"), eq(7L), any());
        verify(systemLogMapper).insertLog(eq("WARN"), eq("auth-service"), eq("로그인 5회 실패로 5분 제한 (em***)"), eq(7L), any());

        account.setLoginFailCount(9);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("423 ACCOUNT_LOCKED");
        verify(systemLogMapper).insertLog(eq("WARN"), eq("auth-service"), eq("로그인 실패 10/10회 (em***)"), eq(7L), any());
        verify(systemLogMapper).insertLog(eq("WARN"), eq("auth-service"), eq("로그인 10회 실패로 계정 자동 잠금 (em***)"), eq(7L), any());
    }

    // FP-80 시스템 로그 저장이 실패해도 로그인은 성공한다(별도 트랜잭션, 예외를 삼키고 앱 로그에 경고만).
    @Test
    void 시스템_로그_저장이_실패해도_로그인은_성공한다() {
        given(userMapper.selectByLoginId("employee")).willReturn(UserFixtures.user(7L, "employee"));
        given(systemLogMapper.insertLog(anyString(), anyString(), anyString(), any(), any())).willThrow(new IllegalStateException("db down"));

        AuthResponses.Login result = (AuthResponses.Login) service.login(new AuthRequests.Login("employee", PASSWORD));

        assertThat(result.accessToken()).isNotBlank();
        verify(userMapper).updateLoginSuccess(eq(7L), any());
    }

    @Test
    void 없는_계정과_탈퇴_회원과_비밀번호_없는_계정은_같은_401() {
        UserAccount withdrawn = UserFixtures.account(9L, "wd_9", UserAccount.ROLE_USER, UserAccount.WITHDRAWN);
        UserAccount noPassword = UserFixtures.user(10L, "socialonly");
        noPassword.setPasswordHash(null);
        given(userMapper.selectByLoginId("wd_9")).willReturn(withdrawn);
        given(userMapper.selectByLoginId("socialonly")).willReturn(noPassword);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("nobody", PASSWORD)))).isEqualTo("401 LOGIN_FAILED");
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("wd_9", PASSWORD)))).isEqualTo("401 LOGIN_FAILED");
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("socialonly", PASSWORD)))).isEqualTo("401 LOGIN_FAILED");
    }

    @Test
    void 관리자의_사용자_정보에는_hasScore가_없다() {
        AuthResponses.UserView view = new UserViewFactory(userMapper, CRYPTO)
                .of(UserFixtures.account(1L, "admin", UserAccount.ROLE_ADMIN, UserAccount.ACTIVE));
        assertThat(view.hasScore()).isNull();
    }

    // ---- AUTH-06 가입 ----

    // 11/18 1차 시연 후속: 휴대폰이 필수가 되어 기본 가입 요청은 인증받은 휴대폰 번호와 휴대폰 인증 토큰을 함께 보낸다.
    private static final String PHONE = "010-1234-5678";
    private static final String PHONE_TOKEN = "phone-token";

    private static AuthRequests.Signup signup(String nickname, Integer birthYear, String phone, Boolean agree, String socialLinkKey) {
        return signup("홍길동", nickname, birthYear, phone, agree, socialLinkKey, PHONE_TOKEN);
    }

    private static AuthRequests.Signup signup(String name, String nickname, Integer birthYear, String phone, Boolean agree, String socialLinkKey,
            String phoneToken) {
        return new AuthRequests.Signup("newbie01", name, nickname, phone, "Newbie@Example.com", "abcd1234", birthYear, "AGE_30S",
                agree, null, "token", socialLinkKey, phoneToken);
    }

    private void givenInsertReturnsId(long userId) {
        doAnswer(invocation -> {
            invocation.<UserAccount>getArgument(0).setUserId(userId);
            return 1;
        }).when(userMapper).insertUser(any());
    }

    @Test
    void 가입하면_암호문_HMAC_동의_3행을_저장하고_인증_토큰을_쓴다() {
        givenInsertReturnsId(100L);
        AuthResponses.Signup result = service.signup(signup("  새닉네임  ", 1990, PHONE, true, null));

        assertThat(result.userId()).isEqualTo(100L);
        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(userMapper).insertUser(saved.capture());
        UserAccount account = saved.getValue();
        assertThat(account.getNickname()).isEqualTo("새닉네임");
        assertThat(account.getNameEnc()).startsWith("v1:").doesNotContain("홍길동");
        // FP-258 대문자로 보낸 이메일(Newbie@Example.com)은 소문자로 바꿔 암호문·HMAC·토큰 확인에 쓴다.
        assertThat(CRYPTO.decrypt(account.getEmailEnc())).isEqualTo("newbie@example.com");
        assertThat(account.getEmailHmac()).isEqualTo(HMAC.email("newbie@example.com"));
        assertThat(account.getPhoneHmac()).isEqualTo(HMAC.phone("01012345678"));
        assertThat(ENCODER.matches("abcd1234", account.getPasswordHash())).isTrue();
        verify(emailVerification).consume("token", EmailPurpose.SIGNUP, "newbie@example.com", null);
        verify(phoneVerification).consume(PHONE_TOKEN, PhonePurpose.SIGNUP, "01012345678");
        verify(consentMapper).insertSignupConsent(eq(100L), eq("TERMS_OF_SERVICE"), eq("Y"), eq("Y"), any(), any());
        verify(consentMapper).insertSignupConsent(eq(100L), eq("PRIVACY_COLLECTION"), eq("Y"), eq("Y"), any(), any());
        verify(consentMapper).insertSignupConsent(eq(100L), eq("NOTIFICATION_MARKETING"), eq("N"), eq("N"), isNull(), any());
    }

    @Test
    void 휴대폰은_숫자만_남겨_암호화한다() {
        givenInsertReturnsId(100L);
        service.signup(signup("새닉네임", 1990, "010-1234-5678", true, null));
        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(userMapper).insertUser(saved.capture());
        assertThat(CRYPTO.decrypt(saved.getValue().getPhoneEnc())).isEqualTo("01012345678");
        assertThat(saved.getValue().getPhoneHmac()).isEqualTo(HMAC.phone("01012345678"));
    }

    @Test
    void 아이디_이메일_닉네임_중복은_409와_각자의_code() {
        given(userMapper.countByLoginId("newbie01")).willReturn(1);
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, PHONE, true, null)))).isEqualTo("409 DUPLICATE_LOGIN_ID");

        given(userMapper.countByLoginId("newbie01")).willReturn(0);
        given(userMapper.countByEmailHmac(HMAC.email("newbie@example.com"))).willReturn(1);
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, PHONE, true, null)))).isEqualTo("409 DUPLICATE_EMAIL");

        given(userMapper.countByEmailHmac(anyString())).willReturn(0);
        given(userMapper.countByNickname("새닉네임")).willReturn(1);
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, PHONE, true, null)))).isEqualTo("409 DUPLICATE_NICKNAME");
        verify(emailVerification, never()).consume(any(), any(), any(), any());
    }

    @Test
    void 출생연도는_1930부터_올해_빼기_20까지() {
        givenInsertReturnsId(100L);
        assertThat(codeOf(() -> service.signup(signup("닉네임가", 1930, PHONE, true, null)))).isEqualTo("no error");
        assertThat(codeOf(() -> service.signup(signup("닉네임나", 2006, PHONE, true, null)))).isEqualTo("no error");
        assertThat(fieldOf(() -> service.signup(signup("닉네임다", 2007, PHONE, true, null)))).isEqualTo("birthYear");
        assertThat(fieldOf(() -> service.signup(signup("닉네임라", 1929, PHONE, true, null)))).isEqualTo("birthYear");
        assertThat(fieldOf(() -> service.signup(signup("닉네임마", null, PHONE, true, null)))).isEqualTo("birthYear");
    }

    @Test
    void 닉네임은_2에서_7자이고_탈퇴로_시작할_수_없다() {
        assertThat(fieldOf(() -> service.signup(signup("탈퇴한사람", 1990, PHONE, true, null)))).isEqualTo("nickname");
        assertThat(fieldOf(() -> service.signup(signup("가", 1990, PHONE, true, null)))).isEqualTo("nickname");
        assertThat(fieldOf(() -> service.signup(signup("가나다라마바사아", 1990, PHONE, true, null)))).isEqualTo("nickname");
    }

    // 11/18 화면 확인 후속 — 닉네임 규칙(한글·영문·숫자 2~7자)을 닉네임 확인 API와 가입 검사 두 곳에서 같은 문구로 막는지 본다.
    private static final String[] NICKNAMES_OK = { "홍길동", "abc12", "가나다라마바사" };
    private static final String[] NICKNAMES_BAD_FORMAT = { "가나다라마바사아", "a", "홍 길동", "홍길동!", "ㄱㄴ" };

    @Test
    void 닉네임_확인_API는_한글_영문_숫자_2에서_7자만_통과한다() {
        for (String nickname : NICKNAMES_OK) {
            assertThat(service.checkNickname(new AuthRequests.NicknameCheck(nickname)).available()).as(nickname).isTrue();
        }
        for (String nickname : NICKNAMES_BAD_FORMAT) {
            assertThat(nicknameMessageOf(() -> service.checkNickname(new AuthRequests.NicknameCheck(nickname))))
                    .as(nickname).isEqualTo(AccountRules.NICKNAME_RULE_MESSAGE);
        }
        assertThat(nicknameMessageOf(() -> service.checkNickname(new AuthRequests.NicknameCheck("탈퇴123")))).isEqualTo("쓸 수 없는 닉네임입니다.");
        verify(userMapper, never()).countByNickname("홍 길동");
    }

    @Test
    void 가입_검사도_닉네임_확인과_같은_규칙과_문구로_막는다() {
        givenInsertReturnsId(100L);
        for (String nickname : NICKNAMES_OK) {
            assertThat(codeOf(() -> service.signup(signup(nickname, 1990, PHONE, true, null)))).as(nickname).isEqualTo("no error");
        }
        for (String nickname : NICKNAMES_BAD_FORMAT) {
            assertThat(nicknameMessageOf(() -> service.signup(signup(nickname, 1990, PHONE, true, null))))
                    .as(nickname).isEqualTo(AccountRules.NICKNAME_RULE_MESSAGE);
        }
        assertThat(nicknameMessageOf(() -> service.signup(signup("탈퇴123", 1990, PHONE, true, null)))).isEqualTo("쓸 수 없는 닉네임입니다.");
    }

    // 400 INVALID_INPUT의 nickname 칸 오류 문구를 꺼낸다. 오류가 없으면 "no error".
    private static String nicknameMessageOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            assertThat(e.getCode()).isEqualTo("INVALID_INPUT");
            return e.getFieldErrors().stream().filter(item -> item.field().equals("nickname")).findFirst()
                    .map(item -> item.message()).orElse("no nickname error");
        }
        return "no error";
    }

    @Test
    void 필수_동의가_없거나_휴대폰_형식이_틀리면_칸별_오류() {
        assertThat(fieldOf(() -> service.signup(signup("새닉네임", 1990, PHONE, false, null)))).isEqualTo("agreeCreditInfo");
        assertThat(fieldOf(() -> service.signup(signup("새닉네임", 1990, "02-123-4567", true, null)))).isEqualTo("phone");
    }

    // ---- 11/18 1차 시연 후속: 휴대폰 필수·인증, 이름 한글, 닉네임 중복 확인 ----

    @Test
    void 휴대폰이_없거나_휴대폰_인증_토큰이_없으면_phone_칸_오류이고_인증_토큰을_쓰지_않는다() {
        assertThat(fieldOf(() -> service.signup(signup("새닉네임", 1990, "", true, null)))).isEqualTo("phone");
        assertThat(fieldOf(() -> service.signup(signup("홍길동", "새닉네임", 1990, PHONE, true, null, null)))).isEqualTo("phone");
        assertThat(fieldOf(() -> service.signup(signup("홍길동", "새닉네임", 1990, PHONE, true, null, " ")))).isEqualTo("phone");
        verify(emailVerification, never()).consume(any(), any(), any(), any());
        verify(phoneVerification, never()).consume(any(), any(), any());
        verify(userMapper, never()).insertUser(any());
    }

    @Test
    void 다른_번호의_토큰이나_이메일_토큰이면_휴대폰_인증_단계에서_거절하고_가입하지_않는다() {
        // 토큰 종류·번호 확인은 PhoneVerificationService.consume이 한다(PhoneVerificationServiceTest). 여기서는 거절되면 가입이 멈추는지 본다.
        willThrowPhoneRequired();
        assertThat(fieldOf(() -> service.signup(signup("새닉네임", 1990, PHONE, true, null)))).isEqualTo("phone");
        verify(userMapper, never()).insertUser(any());
    }

    private void willThrowPhoneRequired() {
        org.mockito.Mockito.doThrow(PhoneVerificationService.verificationRequired())
                .when(phoneVerification).consume(any(), any(), any());
    }

    // FP-258 이메일 규칙 — 한글·기호·점 연속·처음/끝 점·밑줄 도메인·숫자 최상위 도메인은 email 칸 400이고 가입하지 않는다.
    @Test
    void 한글이나_규칙에_맞지_않는_이메일은_가입_email_칸_오류() {
        for (String email : new String[] { "홍길동@example.com", "a..b@example.com", ".ab@example.com", "ab.@example.com", "a+b@example.com",
                "ab@ex_ample.com", "ab@-example.com", "ab@example.c", "ab@example.c1", "ab@example" }) {
            AuthRequests.Signup request = new AuthRequests.Signup("newbie01", "홍길동", "새닉네임", PHONE, email, "abcd1234", 1990, "AGE_30S",
                    true, null, "token", null, PHONE_TOKEN);
            assertThat(fieldOf(() -> service.signup(request))).as(email).isEqualTo("email");
        }
        verify(userMapper, never()).insertUser(any());
    }

    @Test
    void 이름은_완성형_한글_2에서_20자만_통과한다() {
        givenInsertReturnsId(100L);
        assertThat(codeOf(() -> service.signup(signup("홍길동", "닉네임가", 1990, PHONE, true, null, PHONE_TOKEN)))).isEqualTo("no error");
        for (String name : new String[] { "hong", "홍길동1", "홍 길동", "ㄱㄴ", "홍", "가".repeat(21) }) {
            assertThat(fieldOf(() -> service.signup(signup(name, "닉네임나", 1990, PHONE, true, null, PHONE_TOKEN)))).as(name).isEqualTo("name");
        }
    }

    @Test
    void 닉네임_확인은_쓸_수_있음_이미_있음_형식_오류_400() {
        given(userMapper.countByNickname("새닉네임")).willReturn(0);
        given(userMapper.countByNickname("있는닉네임")).willReturn(1);
        assertThat(service.checkNickname(new AuthRequests.NicknameCheck("  새닉네임 ")).available()).isTrue();
        assertThat(service.checkNickname(new AuthRequests.NicknameCheck("있는닉네임")).available()).isFalse();
        for (String nickname : new String[] { "가", "탈퇴한사람", "", "가나다라마바사아" }) {
            assertThat(fieldOf(() -> service.checkNickname(new AuthRequests.NicknameCheck(nickname)))).as(nickname).isEqualTo("nickname");
        }
        assertThat(fieldOf(() -> service.checkNickname(new AuthRequests.NicknameCheck(null)))).isEqualTo("nickname");
    }

    @Test
    void 간편_로그인_키로_가입하면_연결_행도_만들고_키를_지운다() {
        givenInsertReturnsId(100L);
        String key = socialStore.issueLinkKey(new DevSocialStore.PendingLink("GOOGLE", "dev-google-user"));
        service.signup(signup("새닉네임", 1990, PHONE, true, key));
        verify(socialMapper).insertLink(100L, "GOOGLE", "dev-google-user");
        assertThat(socialStore.findLinkKey(key)).isEmpty();
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, PHONE, true, "unknown-key")))).isEqualTo("400 SOCIAL_LINK_EXPIRED");
    }

    private static String fieldOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            assertThat(e.getCode()).isEqualTo("INVALID_INPUT");
            return e.getFieldErrors().get(0).field();
        }
        return "no error";
    }

    // ---- AUTH-09 아이디 찾기, AUTH-10 비밀번호 재설정 ----

    // FP-258 아이디 찾기는 이름 + 휴대폰·이메일 인증 토큰(FIND_ID). 토큰을 먼저 쓰고, 통과하면 가리지 않은 아이디도 준다.
    @Test
    void 휴대폰_인증을_마치고_이름이_맞으면_가리지_않은_아이디를_준다() {
        given(userMapper.selectUsersByPhoneHmac(HMAC.phone("01012345678"))).willReturn(List.of(UserFixtures.user(7L, "jwc1226")));
        AuthResponses.FoundId found = service.findId(new AuthRequests.FindId("홍길동", "010-1234-5678", "PHONE", null, "phone-token"));
        assertThat(found.maskedLoginId()).isEqualTo("jwc****");
        assertThat(found.loginId()).isEqualTo("jwc1226");
        verify(phoneVerification).consume("phone-token", PhonePurpose.FIND_ID, "01012345678");

        assertThat(codeOf(() -> service.findId(new AuthRequests.FindId("김철수", "010-1234-5678", "PHONE", null, "phone-token"))))
                .isEqualTo("404 ACCOUNT_NOT_FOUND");
    }

    @Test
    void 이메일_인증을_마치고_이름이_맞으면_아이디를_주고_없으면_같은_404() {
        given(userMapper.selectUserByEmailHmac(HMAC.email("jwc1226@example.com"))).willReturn(UserFixtures.user(7L, "jwc1226"));
        AuthResponses.FoundId found = service.findId(new AuthRequests.FindId("홍길동", null, "EMAIL", " jwc1226@example.com ", "email-token"));
        assertThat(found.loginId()).isEqualTo("jwc1226");
        verify(emailVerification).consume("email-token", EmailPurpose.FIND_ID, "jwc1226@example.com", null);

        assertThat(codeOf(() -> service.findId(new AuthRequests.FindId("홍길동", null, "EMAIL", "nobody@example.com", "email-token"))))
                .isEqualTo("404 ACCOUNT_NOT_FOUND");
        assertThat(codeOf(() -> service.findId(new AuthRequests.FindId("김철수", null, "EMAIL", "jwc1226@example.com", "email-token"))))
                .isEqualTo("404 ACCOUNT_NOT_FOUND");
    }

    @Test
    void 인증_토큰이_없거나_방법을_모르면_400이고_회원을_찾지_않는다() {
        assertThat(fieldOf(() -> service.findId(new AuthRequests.FindId("홍길동", "010-1234-5678", "PHONE", null, null)))).isEqualTo("phone");
        assertThat(codeOf(() -> service.findId(new AuthRequests.FindId("홍길동", null, "EMAIL", "a@example.com", " "))))
                .isEqualTo("400 EMAIL_VERIFICATION_REQUIRED");
        assertThat(fieldOf(() -> service.findId(new AuthRequests.FindId("홍길동", "010-1234-5678", null, null, "token")))).isEqualTo("method");
        verify(userMapper, never()).selectUsersByPhoneHmac(anyString());
        verify(userMapper, never()).selectUserByEmailHmac(anyString());
    }

    @Test
    void 재설정은_인증_토큰을_계정과_함께_확인하고_잠금을_푼다() {
        given(userMapper.selectUserByLoginIdAndEmailHmac("employee", HMAC.email("employee@example.com"))).willReturn(UserFixtures.user(7L, "employee"));
        service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "newpass99", "홍길동"));
        verify(emailVerification).consume("token", EmailPurpose.RESET_PASSWORD, "employee@example.com", 7L);
        verify(userMapper).updatePasswordAndUnlock(eq(7L), anyString(), any());

        assertThat(codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("nobody", "employee@example.com", "token", "newpass99", "홍길동"))))
                .isEqualTo("404 ACCOUNT_NOT_FOUND");
        assertThatThrownBy(() -> service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "short", "홍길동")))
                .isInstanceOf(ApiException.class);
    }

    // FP-258 아이디·이메일이 맞아도 이름이 다르면 같은 404이고, 인증 토큰을 쓰지 않는다(이름이 없거나 형식이 틀리면 400, 아래 시험).
    @Test
    void 재설정은_이름까지_같아야_하고_다르면_404() {
        given(userMapper.selectUserByLoginIdAndEmailHmac("employee", HMAC.email("employee@example.com"))).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "newpass99", "김철수"))))
                .isEqualTo("404 ACCOUNT_NOT_FOUND");
        verify(emailVerification, never()).consume(anyString(), any(), anyString(), anyLong());
        verify(userMapper, never()).updatePasswordAndUnlock(anyLong(), anyString(), any());
    }

    // FP-258 찾기 화면의 이름은 가입과 같은 규칙 — 형식이 틀리거나 없으면 400 name 칸이고, 계정을 찾거나 토큰을 쓰지 않는다.
    @Test
    void 아이디_찾기와_재설정의_이름_형식이_틀리면_400_name_칸() {
        for (String name : new String[] { "hong", "홍길동1", "홍 길동", "ㄱㄴ", "홍", "" }) {
            assertThat(fieldOf(() -> service.findId(new AuthRequests.FindId(name, "010-1234-5678", "PHONE", null, "phone-token")))).as(name)
                    .isEqualTo("name");
            assertThat(fieldOf(() -> service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "newpass99", name))))
                    .as(name).isEqualTo("name");
        }
        assertThat(fieldOf(() -> service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "newpass99", null))))
                .isEqualTo("name");
        verify(phoneVerification, never()).consume(anyString(), any(), anyString());
        verify(userMapper, never()).selectUsersByPhoneHmac(anyString());
        verify(userMapper, never()).selectUserByLoginIdAndEmailHmac(anyString(), anyString());
        verify(emailVerification, never()).consume(anyString(), any(), anyString(), anyLong());
    }

    // FP-258 아이디 찾기·재설정의 이메일과 재설정 아이디는 앞뒤 공백을 빼고 소문자로 바꿔 찾는다.
    @Test
    void 찾기와_재설정은_대문자_이메일과_아이디를_소문자로_바꿔_찾는다() {
        given(userMapper.selectUserByEmailHmac(HMAC.email("jwc1226@example.com"))).willReturn(UserFixtures.user(7L, "jwc1226"));
        service.findId(new AuthRequests.FindId("홍길동", null, "EMAIL", " JWC1226@Example.COM ", "email-token"));
        verify(emailVerification).consume("email-token", EmailPurpose.FIND_ID, "jwc1226@example.com", null);

        given(userMapper.selectUserByLoginIdAndEmailHmac("employee", HMAC.email("employee@example.com"))).willReturn(UserFixtures.user(7L, "employee"));
        service.resetPassword(new AuthRequests.PasswordReset(" Employee ", "Employee@Example.com", "token", "newpass99", "홍길동"));
        verify(emailVerification).consume("token", EmailPurpose.RESET_PASSWORD, "employee@example.com", 7L);
    }

    // FP-80 관리자는 공개 비밀번호 찾기(AUTH-10)·아이디 찾기(AUTH-09)를 쓸 수 없다 — 조회가 일반 회원만 찾으므로 "없는 계정"과 같은 응답이다.
    @Test
    void 관리자_아이디로_비밀번호_찾기를_하면_없는_계정과_같은_응답() throws java.io.IOException {
        // 매퍼 SQL이 일반 회원(ROLE_USER)만 찾는다 → 관리자 아이디면 조회 결과가 없다(mock은 기본 null).
        String xml = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/mapper/user/UserAccountMapper.xml"));
        for (String id : new String[] { "selectUserByLoginIdAndEmailHmac", "selectUsersByPhoneHmac", "selectUserByEmailHmac" }) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("<select id=\"" + id + "\"[^>]*>(.*?)</select>", java.util.regex.Pattern.DOTALL)
                    .matcher(xml);
            assertThat(m.find()).isTrue();
            assertThat(m.group(1)).contains("ROLE_CODE = 'ROLE_USER'");
        }

        String admin = codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("admin01", "admin01@example.com", "token", "newpass99", "홍길동")));
        String unknown = codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("nobody", "nobody@example.com", "token", "newpass99", "홍길동")));
        assertThat(admin).isEqualTo(unknown).isEqualTo("404 ACCOUNT_NOT_FOUND");
        verify(emailVerification, never()).consume(anyString(), any(), anyString(), anyLong());
    }
}
