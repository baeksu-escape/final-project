package com.baeksuescape.admin.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

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

import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.admin.mapper.AdminAuditMapper;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.global.security.TokenScope;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;

// FP-80 관리자 API 권한·토큰 규칙 — USER 토큰 403, 2단계 인증 대기 토큰 401, 재확인 없이 민감한 작업 401 STEP_UP_REQUIRED,
// 비밀번호 변경이 필요한 관리자 403, AUTH-01 관리자 응답 모양. 실제 보안 필터·오류 처리를 타고 DB 매퍼만 mock으로 대신한다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminApiTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private PiiCrypto crypto;
    @Autowired
    private PiiHmac hmac;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private AdminAccountMapper adminAccountMapper;
    @MockBean
    private AdminAuditMapper adminAuditMapper;
    @MockBean
    private VerificationCodeMapper verificationCodeMapper;
    @MockBean
    private SystemLogMapper systemLogMapper;

    private UserAccount admin;

    @BeforeEach
    void setUp() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
        admin = new UserAccount();
        admin.setUserId(1L);
        admin.setLoginId("admin01");
        admin.setPasswordHash(passwordEncoder.encode("admin1234"));
        admin.setNickname("관리자1");
        admin.setNameEnc(crypto.encrypt("김관리"));
        admin.setEmailEnc(crypto.encrypt("admin01@example.com"));
        admin.setEmailHmac(hmac.email("admin01@example.com"));
        admin.setRoleCode(UserAccount.ROLE_ADMIN);
        admin.setAccountStatusCode(UserAccount.ACTIVE);
        admin.setPasswordChangeRequiredYn("N");
        given(userAccountMapper.selectById(1L)).willReturn(admin);
        given(userAccountMapper.selectByLoginId("admin01")).willReturn(admin);
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder builder, String token) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void userTokenIs403OnAdminApis() throws Exception {
        mvc.perform(as(get("/api/admin/users"), tokenProvider.issue(7L, "ROLE_USER"))).andExpect(status().isForbidden());
        mvc.perform(as(get("/api/admin/system-logs"), tokenProvider.issue(7L, "ROLE_USER"))).andExpect(status().isForbidden());
    }

    @Test
    void challengeOrStepUpTokenIsNotALogin401() throws Exception {
        String challenge = tokenProvider.issueScoped(1L, "ROLE_ADMIN", TokenScope.ADMIN_LOGIN_CHALLENGE, Duration.ofMinutes(5)).token();
        String stepUp = tokenProvider.issueScoped(1L, "ROLE_ADMIN", TokenScope.ADMIN_STEP_UP, Duration.ofMinutes(5)).token();
        mvc.perform(as(get("/api/admin/users"), challenge))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(as(get("/api/auth/me"), stepUp)).andExpect(status().isUnauthorized());
    }

    @Test
    void sensitiveAdminActionsWithoutStepUpAre401StepUpRequired() throws Exception {
        String access = tokenProvider.issue(1L, "ROLE_ADMIN");
        mvc.perform(as(json(post("/api/admin/admins"), "{\"loginId\":\"newadmin\",\"name\":\"김관리\",\"workEmail\":\"new@example.com\"}"), access))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STEP_UP_REQUIRED"));
        mvc.perform(as(json(put("/api/admin/me/password"), "{\"currentPassword\":\"admin1234\",\"newPassword\":\"newpass99\"}"), access))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("STEP_UP_REQUIRED"));
        // 다른 관리자의 재확인 토큰이나 ACCESS 토큰을 헤더에 넣어도 같다.
        mvc.perform(as(json(post("/api/admin/admins"), "{}"), access).header("X-Step-Up-Token", access))
                .andExpect(jsonPath("$.code").value("STEP_UP_REQUIRED"));
    }

    @Test
    void adminWhoMustChangePasswordIs403() throws Exception {
        given(adminAccountMapper.selectPasswordChangeRequired(1L)).willReturn("Y");
        mvc.perform(as(get("/api/admin/users"), tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    void userListShape() throws Exception {
        AdminRows.UserData row = new AdminRows.UserData();
        row.setUserId(7L);
        row.setLoginId("employee");
        row.setNameEnc(crypto.encrypt("홍길동"));
        row.setRoleCode("ROLE_USER");
        row.setWorkerTypeCode("EMPLOYEE");
        row.setAccountStatusCode("ACTIVE");
        row.setReportedPostCount(0);
        row.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));
        row.setNickname("데모직장인");
        given(adminAccountMapper.selectUsers(any(), any(), any(), any(), anyBoolean(), anyInt(), anyInt())).willReturn(List.of(row));
        given(adminAccountMapper.countUsers(any(), any(), any(), any(), anyBoolean())).willReturn(1L);

        // FP-273 직군 조건(workerType)을 함께 보내고, 응답 한 줄에 닉네임이 실린다.
        mvc.perform(as(get("/api/admin/users").param("q", "emp").param("workerType", "FREELANCER"), tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].userId").value(7))
                .andExpect(jsonPath("$.items[0].nickname").value("데모직장인"))
                .andExpect(jsonPath("$.items[0].maskedName").value("홍*동"))
                .andExpect(jsonPath("$.items[0].role").value("ROLE_USER"))
                .andExpect(jsonPath("$.items[0].latestAltScore").isEmpty())
                .andExpect(jsonPath("$.items[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.items[0].reportedPostCount").value(0))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-01T09:30:00+09:00"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalCount").value(1));
    }

    // FP-273 직군 코드 3개 밖의 값은 role·status와 같은 400 INVALID_INPUT(칸 workerType).
    @Test
    void userListRejectsUnknownWorkerType() throws Exception {
        mvc.perform(as(get("/api/admin/users").param("workerType", "WRONG"), tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("workerType"));
    }

    @Test
    void adminLoginGivesChallengeInsteadOfToken() throws Exception {
        // MyBatis useGeneratedKeys처럼 저장한 번호에 VERIFICATION_ID를 채운다.
        doAnswer(invocation -> {
            invocation.<VerificationCode>getArgument(0).setVerificationId(11L);
            return 1;
        }).when(verificationCodeMapper).insertCode(any());
        mvc.perform(json(post("/api/auth/login"), "{\"loginId\":\"admin01\",\"password\":\"admin1234\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(jsonPath("$.challengeToken").isNotEmpty())
                .andExpect(jsonPath("$.maskedEmail").value("ad*****@example.com"))
                .andExpect(jsonPath("$.accessToken").doesNotExist());
    }

    @Test
    void publicAdminAuthPathsAnswer400NotLogin401() throws Exception {
        mvc.perform(json(post("/api/auth/admin/verify-code"), "{\"challengeToken\":\"x\",\"code\":\"123456\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADMIN_CHALLENGE_INVALID"));
        mvc.perform(json(post("/api/auth/admin/password-setup"), "{\"passwordSetupToken\":\"x\",\"newPassword\":\"newpass99\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_SETUP_INVALID"));
    }

    @Test
    void creditDataWithoutReasonIs400() throws Exception {
        mvc.perform(as(json(post("/api/admin/users/7/credit-data"), "{\"reason\":\"\"}"), tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACCESS_REASON_REQUIRED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("reason"));
    }
}
