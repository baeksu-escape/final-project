package com.baeksuescape.user.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.AltDataMapper;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.EmailVerificationService;
import com.baeksuescape.user.service.PhoneVerificationService;

// FP-93 N-04-7 회원 탈퇴(MEM-07) API — 실제 탈퇴·가입 서비스와 JWT 필터를 타고, DB 대신 계정 한 줄을 기억하는 mock 매퍼를 쓴다.
// 탈퇴 → 같은 토큰 401, 같은 아이디로 바로 다시 가입을 확인한다. 실제 Oracle 확인은 작업 3에서 한다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WithdrawalApiTest {

    private static final String LOGIN_ID = "employee";
    private static final String PASSWORD = "demo1234";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private UserConsentMapper consentMapper;
    @MockBean
    private AltDataMapper altDataMapper;
    @MockBean
    private UserSocialAccountMapper socialMapper;
    @MockBean
    private VerificationCodeMapper verificationMapper;
    @MockBean
    private EmailVerificationService emailVerification;
    // 11/18 1차 시연 후속: 가입에 휴대폰 인증 토큰이 필요해졌다. 이메일 인증처럼 토큰 확인은 mock으로 대신한다.
    @MockBean
    private PhoneVerificationService phoneVerification;

    // DB의 APP_USER 한 줄 대신 — updateWithdrawn이 불리면 SQL과 같은 표시값으로 바꾼다.
    private UserAccount account;

    @BeforeEach
    void setUp() {
        account = new UserAccount();
        account.setUserId(7L);
        account.setLoginId(LOGIN_ID);
        account.setPasswordHash(passwordEncoder.encode(PASSWORD));
        account.setNickname("데모직장인");
        account.setNameEnc("v1:test-name");
        account.setEmailEnc("v1:test-email");
        account.setEmailHmac("a".repeat(64));
        account.setBirthYear(1990);
        account.setWorkerTypeCode("EMPLOYEE");
        account.setRoleCode(UserAccount.ROLE_USER);
        account.setAccountStatusCode(UserAccount.ACTIVE);
        account.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));

        given(userAccountMapper.selectById(7L)).willAnswer(invocation -> account);
        given(userAccountMapper.updateWithdrawn(eq(7L), any())).willAnswer(invocation -> {
            if (account.isWithdrawn()) return 0;
            account.setAccountStatusCode(UserAccount.WITHDRAWN);
            account.setLoginId("wd_7");
            account.setNickname("탈퇴7");
            account.setNameEnc("WITHDRAWN");
            account.setEmailEnc("WITHDRAWN");
            account.setEmailHmac("WITHDRAWN:7");
            account.setPasswordHash(null);
            return 1;
        });
        given(userAccountMapper.countByLoginId(anyString())).willAnswer(invocation -> invocation.getArgument(0).equals(account.getLoginId()) ? 1 : 0);
        given(userAccountMapper.countByEmailHmac(anyString())).willAnswer(invocation -> invocation.getArgument(0).equals(account.getEmailHmac()) ? 1 : 0);
        given(userAccountMapper.countByNickname(anyString())).willAnswer(invocation -> invocation.getArgument(0).equals(account.getNickname()) ? 1 : 0);
        given(userAccountMapper.insertUser(any())).willAnswer(invocation -> {
            invocation.<UserAccount>getArgument(0).setUserId(8L);
            return 1;
        });
        given(userAccountMapper.selectAccountStatus(anyLong())).willAnswer(invocation ->
                invocation.<Long>getArgument(0) == 7L ? account.getAccountStatusCode() : null);
    }

    private MockHttpServletRequestBuilder asMember(MockHttpServletRequestBuilder builder, String token) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    // 가입 화면이 보내는 본문(합성 값). 이메일·휴대폰 인증 토큰 확인은 mock으로 대신한다.
    private static String signupBody(String email) {
        return "{\"loginId\":\"" + LOGIN_ID + "\",\"name\":\"홍길동\",\"nickname\":\"새닉네임\",\"phone\":\"01012345678\",\"email\":\"" + email
                + "\",\"password\":\"newpass99\",\"birthYear\":1990,\"agreeTerms\":true,\"agreePrivacy\":true,\"agreeMarketing\":false,"
                + "\"emailVerificationToken\":\"verified-1\",\"phoneVerificationToken\":\"phone-verified-1\"}";
    }

    @Test
    void wrongPasswordIs400OnPasswordFieldAndAccountStays() throws Exception {
        String token = tokenProvider.issue(7L, "ROLE_USER");

        mvc.perform(asMember(json(delete("/api/members/me"), "{\"password\":\"wrong-pass1\"}"), token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PASSWORD"))
                .andExpect(jsonPath("$.message").value("비밀번호가 올바르지 않습니다."))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("password"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("비밀번호가 올바르지 않습니다."));
        assertThat(account.getAccountStatusCode()).isEqualTo(UserAccount.ACTIVE);
        assertThat(account.getLoginId()).isEqualTo(LOGIN_ID);
    }

    @Test
    void afterWithdrawalOldTokenIs401AndSameLoginIdCanSignUpAgain() throws Exception {
        String token = tokenProvider.issue(7L, "ROLE_USER");
        // 탈퇴 전에는 같은 아이디로 가입할 수 없다.
        mvc.perform(json(post("/api/auth/signup"), signupBody("employee@example.com")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));

        mvc.perform(asMember(json(delete("/api/members/me"), "{\"password\":\"" + PASSWORD + "\"}"), token))
                .andExpect(status().isOk())
                .andExpect(content().json("{}"));

        // 같은 토큰으로 회원 API를 부르면 JWT 필터가 WITHDRAWN을 보고 인증하지 않는다 → 401(프론트 client.js가 로그아웃 처리).
        for (String path : new String[] { "/api/members/me/profile", "/api/members/me/financial-input", "/api/members/me/consents" }) {
            mvc.perform(asMember(get(path), token))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        }
        mvc.perform(asMember(json(delete("/api/members/me"), "{\"password\":\"" + PASSWORD + "\"}"), token))
                .andExpect(status().isUnauthorized());
        mvc.perform(asMember(post("/api/auth/logout"), token)).andExpect(status().isUnauthorized());

        // 원래 아이디는 바로 다시 가입할 수 있다(재가입 제한 없음). 새 회원 번호를 받는다.
        mvc.perform(json(post("/api/auth/signup"), signupBody("employee@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(8));
    }
}
