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

    @Test
    void 비밀번호가_틀리면_401이고_실패_횟수를_올린다() {
        given(userMapper.selectByLoginId("employee")).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        verify(userMapper).updateLoginFailure(eq(7L), eq(1), eq(false), any());
    }

    @Test
    void 다섯_번째로_틀리면_잠그고_423() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setLoginFailCount(4);
        given(userMapper.selectByLoginId("employee")).willReturn(account);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("423 ACCOUNT_LOCKED");
        verify(userMapper).updateLoginFailure(eq(7L), eq(5), eq(true), any());
    }

    @Test
    void 잠긴_계정은_비밀번호가_맞을_때만_423이고_틀리면_401() {
        given(userMapper.selectByLoginId("locked")).willReturn(UserFixtures.account(8L, "locked", UserAccount.ROLE_USER, UserAccount.LOCKED));
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("locked", PASSWORD)))).isEqualTo("423 ACCOUNT_LOCKED");
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("locked", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        verify(userMapper, never()).updateLoginFailure(anyLong(), anyInt(), anyBoolean(), any());
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
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

    // FP-80 N-28-1 로그인 성공(AUTH)·실패 n/5회(WARN)·자동 잠금(WARN)을 남긴다. 아이디는 앞 2자 + *** 만.
    @Test
    void 로그인_성공_실패_자동_잠금을_시스템_로그에_가린_아이디로_남긴다() {
        UserAccount account = UserFixtures.user(7L, "employee");
        given(userMapper.selectByLoginId("employee")).willReturn(account);
        service.login(new AuthRequests.Login("employee", PASSWORD));
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("auth-service"), eq("로그인 성공 (em***)"), eq(7L), any());

        account.setLoginFailCount(4);
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("employee", "wrong1234")))).isEqualTo("423 ACCOUNT_LOCKED");
        verify(systemLogMapper).insertLog(eq("WARN"), eq("auth-service"), eq("로그인 실패 5/5회 (em***)"), eq(7L), any());
        verify(systemLogMapper).insertLog(eq("WARN"), eq("auth-service"), eq("로그인 5회 실패로 계정 자동 잠금 (em***)"), eq(7L), any());
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
        assertThat(CRYPTO.decrypt(account.getEmailEnc())).isEqualTo("Newbie@Example.com");
        assertThat(account.getEmailHmac()).isEqualTo(HMAC.email("newbie@example.com"));
        assertThat(account.getPhoneHmac()).isEqualTo(HMAC.phone("01012345678"));
        assertThat(ENCODER.matches("abcd1234", account.getPasswordHash())).isTrue();
        verify(emailVerification).consume("token", EmailPurpose.SIGNUP, "Newbie@Example.com", null);
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
    void 닉네임은_2에서_12자이고_탈퇴로_시작할_수_없다() {
        assertThat(fieldOf(() -> service.signup(signup("탈퇴한사람", 1990, PHONE, true, null)))).isEqualTo("nickname");
        assertThat(fieldOf(() -> service.signup(signup("가", 1990, PHONE, true, null)))).isEqualTo("nickname");
        assertThat(fieldOf(() -> service.signup(signup("가나다라마바사아자차카타파", 1990, PHONE, true, null)))).isEqualTo("nickname");
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
        for (String nickname : new String[] { "가", "탈퇴한사람", "", "가나다라마바사아자차카타파" }) {
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

    @Test
    void 이름과_휴대폰이_맞으면_가린_아이디를_준다() {
        given(userMapper.selectUsersByPhoneHmac(HMAC.phone("01012345678"))).willReturn(List.of(UserFixtures.user(7L, "jwc1226")));
        assertThat(service.findId(new AuthRequests.FindId("홍길동", "010-1234-5678")).maskedLoginId()).isEqualTo("jwc****");
        assertThat(codeOf(() -> service.findId(new AuthRequests.FindId("김철수", "010-1234-5678")))).isEqualTo("404 ACCOUNT_NOT_FOUND");
    }

    @Test
    void 재설정은_인증_토큰을_계정과_함께_확인하고_잠금을_푼다() {
        given(userMapper.selectUserByLoginIdAndEmailHmac("employee", HMAC.email("employee@example.com"))).willReturn(UserFixtures.user(7L, "employee"));
        service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "newpass99"));
        verify(emailVerification).consume("token", EmailPurpose.RESET_PASSWORD, "employee@example.com", 7L);
        verify(userMapper).updatePasswordAndUnlock(eq(7L), anyString(), any());

        assertThat(codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("nobody", "employee@example.com", "token", "newpass99"))))
                .isEqualTo("404 ACCOUNT_NOT_FOUND");
        assertThatThrownBy(() -> service.resetPassword(new AuthRequests.PasswordReset("employee", "employee@example.com", "token", "short")))
                .isInstanceOf(ApiException.class);
    }

    // FP-80 관리자는 공개 비밀번호 찾기(AUTH-10)·아이디 찾기(AUTH-09)를 쓸 수 없다 — 조회가 일반 회원만 찾으므로 "없는 계정"과 같은 응답이다.
    @Test
    void 관리자_아이디로_비밀번호_찾기를_하면_없는_계정과_같은_응답() throws java.io.IOException {
        // 매퍼 SQL이 일반 회원(ROLE_USER)만 찾는다 → 관리자 아이디면 조회 결과가 없다(mock은 기본 null).
        String xml = java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/mapper/user/UserAccountMapper.xml"));
        for (String id : new String[] { "selectUserByLoginIdAndEmailHmac", "selectUsersByPhoneHmac" }) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("<select id=\"" + id + "\"[^>]*>(.*?)</select>", java.util.regex.Pattern.DOTALL)
                    .matcher(xml);
            assertThat(m.find()).isTrue();
            assertThat(m.group(1)).contains("ROLE_CODE = 'ROLE_USER'");
        }

        String admin = codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("admin01", "admin01@example.com", "token", "newpass99")));
        String unknown = codeOf(() -> service.resetPassword(new AuthRequests.PasswordReset("nobody", "nobody@example.com", "token", "newpass99")));
        assertThat(admin).isEqualTo(unknown).isEqualTo("404 ACCOUNT_NOT_FOUND");
        verify(emailVerification, never()).consume(anyString(), any(), anyString(), anyLong());
    }
}
