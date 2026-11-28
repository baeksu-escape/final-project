package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.UserFixtures.CLOCK;
import static com.baeksuescape.user.service.UserFixtures.CRYPTO;
import static com.baeksuescape.user.service.UserFixtures.ENCODER;
import static com.baeksuescape.user.service.UserFixtures.HMAC;
import static com.baeksuescape.user.service.UserFixtures.PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.support.TransactionOperations;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.FinancialInputMapper;
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
    @Mock
    private FinancialInputMapper financialInputMapper;

    private final AvenueProperties properties = TestKeys.properties();
    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(properties);
    private final DevSocialStore store = new DevSocialStore(CLOCK);
    private SocialLoginService social;
    private MyPageService myPage;

    @BeforeEach
    void setUp() {
        UserViewFactory views = new UserViewFactory(userMapper, CRYPTO);
        // 휴대폰 인증(PhoneVerificationService)은 가입에서만 쓰므로 간편 로그인·마이 페이지 시험에서는 비워 둔다.
        AuthService auth = new AuthService(userMapper, consentMapper, socialMapper, emailVerification, null, store, views, tokenProvider,
                ENCODER, CRYPTO, HMAC, CLOCK, null,
                new SystemLogService(mock(SystemLogMapper.class), TransactionOperations.withoutTransaction(), CLOCK),
                new LoginAttemptService(userMapper, ENCODER, CLOCK));
        social = new SocialLoginService(properties, store, socialMapper, userMapper, auth);
        myPage = new MyPageService(userMapper, financialInputMapper, emailVerification, views, ENCODER, CRYPTO, HMAC, CLOCK);
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
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        AuthResponses.Login login = social.link(new AuthRequests.SocialLink(key, "employee", PASSWORD));
        assertThat(login.devMode()).isTrue();
        verify(socialMapper).insertLink(7L, "NAVER", "dev-naver-user");
        // FP-258 연결을 저장한 뒤 성공 처리는 계정 행 잠금 안에서 한 번만 한다(409로 막힌 연결은 초기화하지 않는다).
        InOrder order = inOrder(socialMapper, userMapper);
        order.verify(socialMapper).insertLink(7L, "NAVER", "dev-naver-user");
        order.verify(userMapper).lockUser(7L);
        order.verify(userMapper).updateLoginSuccess(eq(7L), any());
        verify(userMapper).updateLoginSuccess(anyLong(), any());
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

    // FP-258 대문자·앞뒤 공백이 있는 새 이메일은 소문자로 바꿔 판정·토큰 확인하고, 암호문(EMAIL_ENC)도 소문자로 저장한다. 한글 이메일은 400.
    @Test
    void 이메일_변경은_소문자로_저장하고_규칙에_맞지_않으면_400() {
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> myPage.changeEmail(7L, new MyPageDtos.EmailChange("새주소@example.com", "token")))).isEqualTo("400 INVALID_INPUT");

        myPage.changeEmail(7L, new MyPageDtos.EmailChange(" New.Mail@Example.COM ", "token"));
        verify(emailVerification).consume("token", EmailPurpose.CHANGE_EMAIL, "new.mail@example.com", null);
        ArgumentCaptor<String> emailEnc = ArgumentCaptor.forClass(String.class);
        verify(userMapper).updateEmail(eq(7L), emailEnc.capture(), eq(HMAC.email("new.mail@example.com")), any());
        assertThat(CRYPTO.decrypt(emailEnc.getValue())).isEqualTo("new.mail@example.com");
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

    // FP-222 MEM-08 닉네임 변경 — 형식 오류 400 INVALID_INPUT, 지금 닉네임과 같으면 400 SAME_NICKNAME, 다른 회원이 쓰면 409(저장 직전 겹침 포함), 아니면 저장.
    @Test
    void 닉네임_변경은_규칙_같은_값_중복을_막고_새_닉네임을_저장한다() {
        UserAccount account = UserFixtures.user(7L, "employee");
        account.setNickname("백수탈출");
        given(userMapper.selectById(7L)).willReturn(account);

        assertThat(codeOf(() -> myPage.changeNickname(7L, new MyPageDtos.NicknameChange("a")))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> myPage.changeNickname(7L, new MyPageDtos.NicknameChange("탈퇴회원")))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> myPage.changeNickname(7L, new MyPageDtos.NicknameChange(" 백수탈출 ")))).isEqualTo("400 SAME_NICKNAME");
        given(userMapper.countByNickname("남의닉")).willReturn(1);
        assertThat(codeOf(() -> myPage.changeNickname(7L, new MyPageDtos.NicknameChange("남의닉")))).isEqualTo("409 DUPLICATE_NICKNAME");
        verify(userMapper, never()).updateNickname(any(Long.class), anyString(), any());

        given(userMapper.updateNickname(eq(7L), eq("동시닉"), any())).willThrow(new DuplicateKeyException("UK_APU_NICKNAME"));
        assertThat(codeOf(() -> myPage.changeNickname(7L, new MyPageDtos.NicknameChange("동시닉")))).isEqualTo("409 DUPLICATE_NICKNAME");

        myPage.changeNickname(7L, new MyPageDtos.NicknameChange(" 새닉네임 "));
        verify(userMapper).updateNickname(eq(7L), eq("새닉네임"), any());
    }

    // FP-222 새 비밀번호가 지금 비밀번호와 같으면 400 SAME_PASSWORD로 막고 저장하지 않는다. 다르면 저장한다.
    @Test
    void 비밀번호_변경은_지금_비밀번호와_같은_새_비밀번호를_막는다() {
        given(userMapper.selectById(7L)).willReturn(UserFixtures.user(7L, "employee"));
        assertThat(codeOf(() -> myPage.changePassword(7L, new MyPageDtos.PasswordChange(PASSWORD, PASSWORD)))).isEqualTo("400 SAME_PASSWORD");
        verify(userMapper, never()).updatePassword(any(Long.class), anyString(), any());

        myPage.changePassword(7L, new MyPageDtos.PasswordChange(PASSWORD, "different99"));
        verify(userMapper).updatePassword(eq(7L), anyString(), any());
    }

    // FP-227 MEM-05 — 직군을 selectById가 돌려줄 계정에 넣어 둔다(null이면 아직 고르지 않음).
    private UserAccount givenJobType(String jobType) {
        UserAccount account = UserFixtures.user(7L, "newbie");
        account.setWorkerTypeCode(jobType);
        given(userMapper.selectById(7L)).willReturn(account);
        return account;
    }

    @Test
    void 직군이_비어_있으면_저장한다() {
        UserAccount account = givenJobType(null);
        assertThat(codeOf(() -> myPage.selectJobType(7L, new MyPageDtos.JobType("STUDENT")))).isEqualTo("400 INVALID_INPUT");

        given(userMapper.updateWorkerTypeIfEmpty(eq(7L), eq("FREELANCER"), any())).willAnswer(invocation -> {
            account.setWorkerTypeCode("FREELANCER");
            return 1;
        });
        assertThat(myPage.selectJobType(7L, new MyPageDtos.JobType("FREELANCER")).user().jobType()).isEqualTo("FREELANCER");
        verify(userMapper).lockUser(7L);
        verify(userMapper, never()).updateWorkerTypeFrom(any(Long.class), anyString(), anyString(), any());
    }

    @Test
    void 같은_직군을_다시_고르면_바꾸지_않고_200() {
        givenJobType("EMPLOYEE");
        given(financialInputMapper.selectSavedBaseMonths(7L)).willReturn(List.of("2026-10"));

        assertThat(myPage.selectJobType(7L, new MyPageDtos.JobType("EMPLOYEE")).user().jobType()).isEqualTo("EMPLOYEE");
        verify(userMapper, never()).updateWorkerTypeIfEmpty(any(Long.class), anyString(), any());
        verify(userMapper, never()).updateWorkerTypeFrom(any(Long.class), anyString(), anyString(), any());
    }

    @Test
    void 저장한_입력도_평가도_없으면_다른_직군으로_바꾼다() {
        UserAccount account = givenJobType("EMPLOYEE");
        given(financialInputMapper.selectSavedBaseMonths(7L)).willReturn(List.of());
        given(userMapper.countAssessments(7L)).willReturn(0);
        given(userMapper.updateWorkerTypeFrom(eq(7L), eq("EMPLOYEE"), eq("FREELANCER"), any())).willAnswer(invocation -> {
            account.setWorkerTypeCode("FREELANCER");
            return 1;
        });

        assertThat(myPage.selectJobType(7L, new MyPageDtos.JobType("FREELANCER")).user().jobType()).isEqualTo("FREELANCER");
        verify(userMapper).updateWorkerTypeFrom(eq(7L), eq("EMPLOYEE"), eq("FREELANCER"), any());

        // 그사이 다른 요청이 먼저 바꿔 조건부 변경이 0행이면 409로 알린다.
        account.setWorkerTypeCode("EMPLOYEE");
        given(userMapper.updateWorkerTypeFrom(eq(7L), eq("EMPLOYEE"), eq("SELF_EMPLOYED"), any())).willReturn(0);
        assertThat(codeOf(() -> myPage.selectJobType(7L, new MyPageDtos.JobType("SELF_EMPLOYED")))).isEqualTo("409 JOB_TYPE_ALREADY_SELECTED");
    }

    @Test
    void 저장한_입력이나_평가가_있으면_다른_직군으로_못_바꾸고_409_JOB_TYPE_LOCKED() {
        givenJobType("EMPLOYEE");
        given(financialInputMapper.selectSavedBaseMonths(7L)).willReturn(List.of("2026-10"));
        given(userMapper.countAssessments(7L)).willReturn(0);
        assertThat(codeOf(() -> myPage.selectJobType(7L, new MyPageDtos.JobType("FREELANCER")))).isEqualTo("409 JOB_TYPE_LOCKED");

        given(financialInputMapper.selectSavedBaseMonths(7L)).willReturn(List.of());
        given(userMapper.countAssessments(7L)).willReturn(1);
        assertThat(codeOf(() -> myPage.selectJobType(7L, new MyPageDtos.JobType("FREELANCER")))).isEqualTo("409 JOB_TYPE_LOCKED");

        verify(userMapper, never()).updateWorkerTypeFrom(any(Long.class), anyString(), anyString(), any());
    }
}
