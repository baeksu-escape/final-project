package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.UserFixtures.CLOCK;
import static com.baeksuescape.user.service.UserFixtures.CRYPTO;
import static com.baeksuescape.user.service.UserFixtures.ENCODER;
import static com.baeksuescape.user.service.UserFixtures.HMAC;
import static com.baeksuescape.user.service.UserFixtures.PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.service.social.DevSocialStore;
import com.baeksuescape.user.service.social.SocialLoginService;

// FP-87 간편 로그인 DEV(AUTH-04·05)와 마이페이지(MEM-01~05) 서비스. DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SocialAndMyPageServiceTest {

    @Mock
    private UserAccountMapper userMapper;
    @Mock
    private UserConsentMapper consentMapper;
    @Mock
    private UserSocialAccountMapper socialMapper;
    @Mock
    private EmailVerificationService emailVerification;

    private final AvenueProperties properties = TestKeys.properties();
    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(properties);
    private final DevSocialStore store = new DevSocialStore(CLOCK);
    private SocialLoginService social;
    private MyPageService myPage;

    @BeforeEach
    void setUp() {
        UserViewFactory views = new UserViewFactory(userMapper, CRYPTO);
        AuthService auth = new AuthService(userMapper, consentMapper, socialMapper, emailVerification, store, views, tokenProvider,
                ENCODER, CRYPTO, HMAC, CLOCK);
        social = new SocialLoginService(properties, store, socialMapper, userMapper, auth);
        myPage = new MyPageService(userMapper, emailVerification, views, ENCODER, CRYPTO, HMAC, CLOCK);
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getStatus().value() + " " + e.getCode();
        }
        return "no error";
    }

    private String codeFromRedirect(String provider) {
        String location = social.authorizationRedirect(provider).toString();
        assertThat(location).startsWith("http://localhost:5173/oauth/callback?code=");
        return location.substring(location.indexOf("code=") + 5);
    }

    // ---- 간편 로그인 DEV ----

    @Test
    void 처음이면_LINK_REQUIRED와_가짜_프로필을_주고_코드는_한_번만_쓴다() {
        String code = codeFromRedirect("google");
        AuthResponses.SocialExchange result = social.exchange(new AuthRequests.SocialExchange(code));
        assertThat(result.result()).isEqualTo("LINK_REQUIRED");
        assertThat(result.provider()).isEqualTo("google");
        assertThat(result.profile().email()).isEqualTo("dev-google@example.com");
        assertThat(result.devMode()).isTrue();
        assertThat(store.findLinkKey(result.linkKey())).isPresent();
        assertThat(codeOf(() -> social.exchange(new AuthRequests.SocialExchange(code)))).isEqualTo("400 INVALID_SOCIAL_CODE");
    }

    @Test
    void 연결된_계정이면_바로_로그인하고_관리자는_403_잠김은_423() {
        given(socialMapper.selectUserId("KAKAO", "dev-kakao-user")).willReturn(7L);
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        AuthResponses.SocialExchange linked = social.exchange(new AuthRequests.SocialExchange(codeFromRedirect("kakao")));
        assertThat(linked.result()).isEqualTo("LINKED");
        assertThat(tokenProvider.parse(linked.accessToken())).isPresent();

        given(userMapper.selectById(7L)).willReturn(UserFixtures.account(7L, "admin", UserAccount.ROLE_ADMIN, UserAccount.ACTIVE));
        assertThat(codeOf(() -> social.exchange(new AuthRequests.SocialExchange(codeFromRedirect("kakao"))))).isEqualTo("403 SOCIAL_ADMIN_NOT_ALLOWED");

        given(userMapper.selectById(7L)).willReturn(UserFixtures.account(7L, "locked", UserAccount.ROLE_USER, UserAccount.LOCKED));
        assertThat(codeOf(() -> social.exchange(new AuthRequests.SocialExchange(codeFromRedirect("kakao"))))).isEqualTo("423 ACCOUNT_LOCKED");
    }

    @Test
    void 기존_계정_연결은_비밀번호를_확인하고_관리자와_중복_연결을_막는다() {
        String key = store.issueLinkKey(new DevSocialStore.PendingLink("NAVER", "dev-naver-user"));
        given(userMapper.selectByLoginId("employee")).willReturn(UserFixtures.user(7L, "employee"));
        given(userMapper.selectByLoginId("admin")).willReturn(UserFixtures.account(1L, "admin", UserAccount.ROLE_ADMIN, UserAccount.ACTIVE));

        assertThat(codeOf(() -> social.link(new AuthRequests.SocialLink(key, "employee", "wrong1234")))).isEqualTo("401 LOGIN_FAILED");
        assertThat(codeOf(() -> social.link(new AuthRequests.SocialLink(key, "admin", PASSWORD)))).isEqualTo("403 SOCIAL_ADMIN_NOT_ALLOWED");
        given(socialMapper.countByUserAndProvider(7L, "NAVER")).willReturn(1);
        assertThat(codeOf(() -> social.link(new AuthRequests.SocialLink(key, "employee", PASSWORD)))).isEqualTo("409 SOCIAL_ALREADY_LINKED");

        given(socialMapper.countByUserAndProvider(7L, "NAVER")).willReturn(0);
        AuthResponses.Login login = social.link(new AuthRequests.SocialLink(key, "employee", PASSWORD));
        assertThat(login.devMode()).isTrue();
        verify(socialMapper).insertLink(7L, "NAVER", "dev-naver-user");
        assertThat(store.findLinkKey(key)).isEmpty();
        assertThat(codeOf(() -> social.link(new AuthRequests.SocialLink(key, "employee", PASSWORD)))).isEqualTo("400 SOCIAL_LINK_EXPIRED");
    }

    @Test
    void REAL_모드는_아직_지원하지_않는다() {
        properties.getAuth().getSocial().setMode(AvenueProperties.SocialMode.REAL);
        assertThat(social.authorizationRedirect("google").toString()).contains("error=social_mode_not_supported");
        assertThat(codeOf(() -> social.exchange(new AuthRequests.SocialExchange("any")))).isEqualTo("501 SOCIAL_MODE_NOT_SUPPORTED");
    }

    // ---- 마이페이지 ----

    @Test
    void 내_정보는_가린_값이고_휴대폰이_없으면_null() {
        UserAccount account = UserFixtures.user(7L, "employee");
        given(userMapper.selectById(7L)).willReturn(account);
        assertThat(myPage.profile(7L).profile()).isEqualTo(new MyPageDtos.Profile("employee", "닉employee", "홍*동", "010-****-5678",
                "em******@example.com", "2026-10-01", "EMPLOYEE"));

        account.setPhoneEnc(null);
        assertThat(myPage.profile(7L).profile().phone()).isNull();
    }

    @Test
    void 가림_해제는_비밀번호가_맞을_때만_원래_값을_준다() {
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> myPage.unmask(7L, new MyPageDtos.Unmask("wrong1234")))).isEqualTo("400 INVALID_PASSWORD");
        assertThat(myPage.unmask(7L, new MyPageDtos.Unmask(PASSWORD)).profile())
                .isEqualTo(new MyPageDtos.UnmaskedProfile("홍길동", "010-1234-5678", "employee@example.com"));
    }

    @Test
    void 이메일_변경은_같은_이메일과_중복을_막고_인증_토큰을_쓴다() {
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> myPage.changeEmail(7L, new MyPageDtos.EmailChange("Employee@example.com", "token")))).isEqualTo("400 SAME_EMAIL");
        given(userMapper.countByEmailHmac(HMAC.email("taken@example.com"))).willReturn(1);
        assertThat(codeOf(() -> myPage.changeEmail(7L, new MyPageDtos.EmailChange("taken@example.com", "token")))).isEqualTo("409 DUPLICATE_EMAIL");

        myPage.changeEmail(7L, new MyPageDtos.EmailChange("new@example.com", "token"));
        verify(emailVerification).consume("token", EmailPurpose.CHANGE_EMAIL, "new@example.com", null);
        verify(userMapper).updateEmail(eq(7L), anyString(), eq(HMAC.email("new@example.com")), any());
    }

    @Test
    void 비밀번호_변경은_현재_비밀번호와_규칙을_확인한다() {
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> myPage.changePassword(7L, new MyPageDtos.PasswordChange("wrong1234", "newpass99")))).isEqualTo("400 INVALID_PASSWORD");
        assertThat(codeOf(() -> myPage.changePassword(7L, new MyPageDtos.PasswordChange(PASSWORD, "onlyletters")))).isEqualTo("400 INVALID_INPUT");
        verify(userMapper, never()).updatePassword(any(Long.class), anyString(), any());
        myPage.changePassword(7L, new MyPageDtos.PasswordChange(PASSWORD, "newpass99"));
        verify(userMapper).updatePassword(eq(7L), anyString(), any());
    }

    @Test
    void 직군은_비어_있을_때만_저장하고_이미_있으면_409() {
        UserAccount account = UserFixtures.user(7L, "newbie");
        account.setWorkerTypeCode("FREELANCER");
        given(userMapper.selectById(7L)).willReturn(account);
        assertThat(codeOf(() -> myPage.selectJobType(7L, new MyPageDtos.JobType("STUDENT")))).isEqualTo("400 INVALID_INPUT");

        given(userMapper.updateWorkerTypeIfEmpty(eq(7L), eq("FREELANCER"), any())).willReturn(1);
        assertThat(myPage.selectJobType(7L, new MyPageDtos.JobType("FREELANCER")).user().jobType()).isEqualTo("FREELANCER");

        given(userMapper.updateWorkerTypeIfEmpty(eq(7L), eq("EMPLOYEE"), any())).willReturn(0);
        assertThat(codeOf(() -> myPage.selectJobType(7L, new MyPageDtos.JobType("EMPLOYEE")))).isEqualTo("409 JOB_TYPE_ALREADY_SELECTED");
    }
}
