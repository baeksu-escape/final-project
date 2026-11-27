package com.baeksuescape.user.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.service.AuthErrors;
import com.baeksuescape.user.service.AuthService;
import com.baeksuescape.user.service.EmailVerificationService;
import com.baeksuescape.user.service.MyPageService;
import com.baeksuescape.user.service.PhoneVerificationService;
import com.baeksuescape.user.service.social.SocialLoginService;

// FP-87 회원·인증·마이페이지 API 계약 — 경로·상태·JSON 키가 프론트 mock(authMockHandlers·socialLoginMockHandlers·myPageMockHandlers)과 같은지 본다.
// 서비스는 mock으로 대신하고, 보안 필터·오류 처리는 실제로 탄다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserApiContractTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private AuthService authService;
    @MockBean
    private EmailVerificationService emailVerification;
    @MockBean
    private PhoneVerificationService phoneVerification;
    @MockBean
    private SocialLoginService socialLoginService;
    @MockBean
    private MyPageService myPageService;

    private static final AuthResponses.UserView USER = new AuthResponses.UserView(7L, "홍*동", "ROLE_USER", "EMPLOYEE", true);

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"));
    }

    // ---- AUTH ----

    @Test
    void 로그인은_accessToken과_user를_준다() throws Exception {
        given(authService.login(any())).willReturn(new AuthResponses.Login("token-1", USER));
        mvc.perform(json(post("/api/auth/login"), "{\"loginId\":\"employee\",\"password\":\"demo1234\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("token-1"))
                .andExpect(jsonPath("$.user.userId").value(7))
                .andExpect(jsonPath("$.user.name").value("홍*동"))
                .andExpect(jsonPath("$.user.role").value("ROLE_USER"))
                .andExpect(jsonPath("$.user.jobType").value("EMPLOYEE"))
                .andExpect(jsonPath("$.user.hasScore").value(true))
                .andExpect(jsonPath("$.devMode").doesNotExist());
    }

    @Test
    void 로그인_실패는_401_잠김은_423_ACCOUNT_LOCKED_빈_칸은_400() throws Exception {
        willThrow(AuthErrors.loginFailed()).given(authService).login(any());
        mvc.perform(json(post("/api/auth/login"), "{\"loginId\":\"a\",\"password\":\"b\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("아이디 또는 비밀번호가 올바르지 않습니다."));

        willThrow(AuthErrors.accountLocked()).given(authService).login(any());
        mvc.perform(json(post("/api/auth/login"), "{\"loginId\":\"a\",\"password\":\"b\"}"))
                .andExpect(status().is(423))
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$.message").value("잠긴 계정입니다. 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정하면 풀립니다."));

        mvc.perform(json(post("/api/auth/login"), "{\"loginId\":\"employee\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("password"));
    }

    @Test
    void 관리자_사용자_정보에는_hasScore_키가_없다() throws Exception {
        given(authService.me(1L)).willReturn(new AuthResponses.Me(new AuthResponses.UserView(1L, "관*자", "ROLE_ADMIN", null, null)));
        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("ROLE_ADMIN"))
                .andExpect(jsonPath("$.user.hasScore").doesNotExist());
    }

    @Test
    void 내_정보와_로그아웃() throws Exception {
        given(authService.me(7L)).willReturn(new AuthResponses.Me(USER));
        mvc.perform(asUser(get("/api/auth/me"))).andExpect(status().isOk()).andExpect(jsonPath("$.user.userId").value(7));
        mvc.perform(asUser(post("/api/auth/logout"))).andExpect(status().isOk()).andExpect(content().json("{}"));
    }

    @Test
    void 가입과_중복_오류() throws Exception {
        given(authService.signup(any())).willReturn(new AuthResponses.Signup(100L));
        mvc.perform(json(post("/api/auth/signup"), "{\"loginId\":\"newbie01\",\"birthYear\":1990}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(100));

        willThrow(AuthErrors.duplicateNickname()).given(authService).signup(any());
        mvc.perform(json(post("/api/auth/signup"), "{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_NICKNAME"));
    }

    @Test
    void 이메일_인증_발송과_확인() throws Exception {
        given(emailVerification.send(any())).willReturn(new AuthResponses.EmailSent(300));
        given(emailVerification.verify(any())).willReturn(new AuthResponses.EmailVerified("verified-1"));
        mvc.perform(json(post("/api/auth/email/send"), "{\"email\":\"a@example.com\",\"purpose\":\"SIGNUP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresInSeconds").value(300));
        mvc.perform(json(post("/api/auth/email/verify"), "{\"email\":\"a@example.com\",\"code\":\"123456\",\"purpose\":\"SIGNUP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationToken").value("verified-1"));
    }

    // 11/18 1차 시연 후속: 닉네임 중복 확인·휴대폰 인증은 로그인 없이 부르고, JSON 키는 프론트 mock(authMockHandlers.js)과 같다.
    @Test
    void 닉네임_중복_확인은_토큰_없이_available을_준다() throws Exception {
        given(authService.checkNickname(any())).willReturn(new AuthResponses.NicknameAvailability(true));
        mvc.perform(json(post("/api/auth/nickname/check"), "{\"nickname\":\"테스트닉\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    // FP-258 AUTH-16 아이디 중복 확인도 로그인 없이 부르고, 응답 모양은 닉네임 확인과 같다.
    @Test
    void 아이디_중복_확인은_토큰_없이_available을_준다() throws Exception {
        given(authService.checkLoginId(any())).willReturn(new AuthResponses.LoginIdAvailability(false));
        mvc.perform(json(post("/api/auth/login-id/check"), "{\"loginId\":\"employee\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void 휴대폰_인증_발송과_확인은_토큰_없이_부르고_이메일과_같은_모양이다() throws Exception {
        given(phoneVerification.send(any())).willReturn(new AuthResponses.PhoneSent(300));
        given(phoneVerification.verify(any())).willReturn(new AuthResponses.PhoneVerified("phone-verified-1"));
        mvc.perform(json(post("/api/auth/phone/send"), "{\"phone\":\"01012345678\",\"purpose\":\"SIGNUP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresInSeconds").value(300));
        mvc.perform(json(post("/api/auth/phone/verify"), "{\"phone\":\"01012345678\",\"code\":\"123456\",\"purpose\":\"SIGNUP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationToken").value("phone-verified-1"));
        // 빈 칸은 400 INVALID_INPUT(칸별 오류)
        mvc.perform(json(post("/api/auth/phone/send"), "{\"purpose\":\"SIGNUP\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("phone"));
    }

    @Test
    void 아이디_찾기와_비밀번호_재설정() throws Exception {
        // FP-258 요청에 방법·인증 토큰이 붙고, 응답에 가리지 않은 loginId가 더해진다(maskedLoginId는 그대로).
        given(authService.findId(any())).willReturn(new AuthResponses.FoundId("jwc****", "jwc1226"));
        mvc.perform(json(post("/api/auth/find-id"), "{\"name\":\"홍길동\",\"method\":\"PHONE\",\"phone\":\"01012345678\",\"verificationToken\":\"t\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maskedLoginId").value("jwc****"))
                .andExpect(jsonPath("$.loginId").value("jwc1226"));

        willThrow(AuthErrors.accountNotFound()).given(authService).findId(any());
        mvc.perform(json(post("/api/auth/find-id"), "{\"name\":\"홍길동\",\"phone\":\"01012345678\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("입력한 정보와 일치하는 계정이 없습니다."));

        mvc.perform(json(post("/api/auth/password/reset"),
                        "{\"loginId\":\"employee\",\"email\":\"a@example.com\",\"emailVerificationToken\":\"t\",\"newPassword\":\"newpass99\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{}"));
    }

    // ---- 간편 로그인 ----

    @Test
    void 시작_주소는_프론트_콜백으로_보낸다() throws Exception {
        given(socialLoginService.authorizationRedirect("google")).willReturn(URI.create("http://localhost:5173/oauth/callback?code=c1"));
        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("http://localhost:5173/oauth/callback?code=")));
    }

    @Test
    void 교환은_LINK_REQUIRED_또는_LINKED_모양이고_devMode가_붙는다() throws Exception {
        given(socialLoginService.exchange(any())).willReturn(AuthResponses.SocialExchange.linkRequired("link-1", "google",
                new AuthResponses.SocialProfile("개발용 Google", "dev-google@example.com")));
        mvc.perform(json(post("/api/auth/social/exchange"), "{\"code\":\"c1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("LINK_REQUIRED"))
                .andExpect(jsonPath("$.linkKey").value("link-1"))
                .andExpect(jsonPath("$.provider").value("google"))
                .andExpect(jsonPath("$.profile.name").value("개발용 Google"))
                .andExpect(jsonPath("$.profile.email").value("dev-google@example.com"))
                .andExpect(jsonPath("$.devMode").value(true))
                .andExpect(jsonPath("$.accessToken").doesNotExist());

        given(socialLoginService.exchange(any())).willReturn(AuthResponses.SocialExchange.linked(new AuthResponses.Login("token-2", USER)));
        mvc.perform(json(post("/api/auth/social/exchange"), "{\"code\":\"c2\"}"))
                .andExpect(jsonPath("$.result").value("LINKED"))
                .andExpect(jsonPath("$.accessToken").value("token-2"))
                .andExpect(jsonPath("$.user.userId").value(7))
                .andExpect(jsonPath("$.linkKey").doesNotExist());

        given(socialLoginService.link(any())).willReturn(new AuthResponses.Login("token-3", USER, true));
        mvc.perform(json(post("/api/auth/social/link"), "{\"linkKey\":\"link-1\",\"loginId\":\"employee\",\"password\":\"demo1234\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("token-3"))
                .andExpect(jsonPath("$.devMode").value(true));
    }

    // ---- 마이페이지 ----

    @Test
    void 내_정보는_profile_안에_가린_값과_null_휴대폰() throws Exception {
        given(myPageService.profile(7L)).willReturn(new MyPageDtos.ProfileResponse(
                new MyPageDtos.Profile("employee", "데모직장인", "홍*동", null, "em******@example.com", "2026-10-01", "EMPLOYEE")));
        mvc.perform(asUser(get("/api/members/me/profile")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.loginId").value("employee"))
                .andExpect(jsonPath("$.profile.nickname").value("데모직장인"))
                .andExpect(jsonPath("$.profile.name").value("홍*동"))
                .andExpect(jsonPath("$.profile.phone").value(nullValue()))
                .andExpect(jsonPath("$.profile.email").value("em******@example.com"))
                .andExpect(jsonPath("$.profile.joinedAt").value("2026-10-01"))
                .andExpect(jsonPath("$.profile.jobType").value("EMPLOYEE"));
    }

    @Test
    void 가림_해제_이메일_비밀번호_변경과_직군_선택() throws Exception {
        given(myPageService.unmask(eq(7L), any())).willReturn(new MyPageDtos.UnmaskedResponse(
                new MyPageDtos.UnmaskedProfile("홍길동", "010-1234-5678", "employee@example.com")));
        mvc.perform(asUser(json(post("/api/members/me/profile/unmask"), "{\"password\":\"demo1234\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.phone").value("010-1234-5678"));

        mvc.perform(asUser(json(put("/api/members/me/email"), "{\"email\":\"new@example.com\",\"emailVerificationToken\":\"t\"}")))
                .andExpect(status().isOk()).andExpect(content().json("{}"));
        mvc.perform(asUser(json(put("/api/members/me/password"), "{\"currentPassword\":\"demo1234\",\"newPassword\":\"newpass99\"}")))
                .andExpect(status().isOk()).andExpect(content().json("{}"));

        given(myPageService.selectJobType(eq(7L), any())).willReturn(new AuthResponses.Me(USER));
        mvc.perform(asUser(json(patch("/api/members/me/job-type"), "{\"jobType\":\"EMPLOYEE\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.jobType").value("EMPLOYEE"));
    }

    @Test
    void 관리자는_마이페이지_API에서_403() throws Exception {
        mvc.perform(get("/api/members/me/profile").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isForbidden());
    }
}
