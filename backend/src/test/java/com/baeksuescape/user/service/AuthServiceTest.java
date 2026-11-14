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

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.exception.ApiException;
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

    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(TestKeys.properties());
    private final DevSocialStore socialStore = new DevSocialStore(CLOCK);
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(userMapper, consentMapper, socialMapper, emailVerification, socialStore,
                new UserViewFactory(userMapper, CRYPTO), tokenProvider, ENCODER, CRYPTO, HMAC, CLOCK);
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

        AuthResponses.Login result = service.login(new AuthRequests.Login("employee", PASSWORD));

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

    @Test
    void 관리자는_비밀번호가_맞아도_토큰_없이_409() {
        given(userMapper.selectByLoginId("admin")).willReturn(UserFixtures.account(1L, "admin", UserAccount.ROLE_ADMIN, UserAccount.ACTIVE));
        assertThat(codeOf(() -> service.login(new AuthRequests.Login("admin", PASSWORD)))).isEqualTo("409 ADMIN_2FA_NOT_READY");
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
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

    private static AuthRequests.Signup signup(String nickname, Integer birthYear, String phone, Boolean agree, String socialLinkKey) {
        return new AuthRequests.Signup("newbie01", "홍길동", nickname, phone, "Newbie@Example.com", "abcd1234", birthYear, "AGE_30S",
                agree, null, "token", socialLinkKey);
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
        AuthResponses.Signup result = service.signup(signup("  새닉네임  ", 1990, "", true, null));

        assertThat(result.userId()).isEqualTo(100L);
        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(userMapper).insertUser(saved.capture());
        UserAccount account = saved.getValue();
        assertThat(account.getNickname()).isEqualTo("새닉네임");
        assertThat(account.getNameEnc()).startsWith("v1:").doesNotContain("홍길동");
        assertThat(CRYPTO.decrypt(account.getEmailEnc())).isEqualTo("Newbie@Example.com");
        assertThat(account.getEmailHmac()).isEqualTo(HMAC.email("newbie@example.com"));
        assertThat(account.getPhoneEnc()).isNull();
        assertThat(account.getPhoneHmac()).isNull();
        assertThat(ENCODER.matches("abcd1234", account.getPasswordHash())).isTrue();
        verify(emailVerification).consume("token", EmailPurpose.SIGNUP, "Newbie@Example.com", null);
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
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, "", true, null)))).isEqualTo("409 DUPLICATE_LOGIN_ID");

        given(userMapper.countByLoginId("newbie01")).willReturn(0);
        given(userMapper.countByEmailHmac(HMAC.email("newbie@example.com"))).willReturn(1);
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, "", true, null)))).isEqualTo("409 DUPLICATE_EMAIL");

        given(userMapper.countByEmailHmac(anyString())).willReturn(0);
        given(userMapper.countByNickname("새닉네임")).willReturn(1);
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, "", true, null)))).isEqualTo("409 DUPLICATE_NICKNAME");
        verify(emailVerification, never()).consume(any(), any(), any(), any());
    }

    @Test
    void 출생연도는_1930부터_올해_빼기_20까지() {
        givenInsertReturnsId(100L);
        assertThat(codeOf(() -> service.signup(signup("닉네임가", 1930, "", true, null)))).isEqualTo("no error");
        assertThat(codeOf(() -> service.signup(signup("닉네임나", 2006, "", true, null)))).isEqualTo("no error");
        assertThat(fieldOf(() -> service.signup(signup("닉네임다", 2007, "", true, null)))).isEqualTo("birthYear");
        assertThat(fieldOf(() -> service.signup(signup("닉네임라", 1929, "", true, null)))).isEqualTo("birthYear");
        assertThat(fieldOf(() -> service.signup(signup("닉네임마", null, "", true, null)))).isEqualTo("birthYear");
    }

    @Test
    void 닉네임은_2에서_12자이고_탈퇴로_시작할_수_없다() {
        assertThat(fieldOf(() -> service.signup(signup("탈퇴한사람", 1990, "", true, null)))).isEqualTo("nickname");
        assertThat(fieldOf(() -> service.signup(signup("가", 1990, "", true, null)))).isEqualTo("nickname");
        assertThat(fieldOf(() -> service.signup(signup("가나다라마바사아자차카타파", 1990, "", true, null)))).isEqualTo("nickname");
    }

    @Test
    void 필수_동의가_없거나_휴대폰_형식이_틀리면_칸별_오류() {
        assertThat(fieldOf(() -> service.signup(signup("새닉네임", 1990, "", false, null)))).isEqualTo("agreeCreditInfo");
        assertThat(fieldOf(() -> service.signup(signup("새닉네임", 1990, "02-123-4567", true, null)))).isEqualTo("phone");
    }

    @Test
    void 간편_로그인_키로_가입하면_연결_행도_만들고_키를_지운다() {
        givenInsertReturnsId(100L);
        String key = socialStore.issueLinkKey(new DevSocialStore.PendingLink("GOOGLE", "dev-google-user"));
        service.signup(signup("새닉네임", 1990, "", true, key));
        verify(socialMapper).insertLink(100L, "GOOGLE", "dev-google-user");
        assertThat(socialStore.findLinkKey(key)).isEmpty();
        assertThat(codeOf(() -> service.signup(signup("새닉네임", 1990, "", true, "unknown-key")))).isEqualTo("400 SOCIAL_LINK_EXPIRED");
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
}
