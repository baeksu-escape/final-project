package com.baeksuescape.user.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.service.EmailVerificationService;
import com.baeksuescape.user.service.PhoneVerificationService;

// FP-298 N-04-8 마이페이지 직군 변경(MEM-05 PATCH /api/members/me/job-type) API — 실제 MyPageService와 JWT 필터를 타고,
// DB 대신 계정 한 줄을 기억하는 mock 매퍼를 쓴다. 저장한 회원도 바꾸고, 같은 직군·틀린 값은 400, 잠긴·탈퇴 계정은 401이다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class JobTypeChangeApiTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;
    // 응답의 사용자 정보가 이름을 복호화해 가리므로, 시험 키로 암호화한 합성 이름을 넣는다.
    @Autowired
    private PiiCrypto crypto;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private SystemLogMapper systemLogMapper;
    @MockBean
    private EmailVerificationService emailVerification;
    @MockBean
    private PhoneVerificationService phoneVerification;

    // DB의 APP_USER 한 줄 대신 — 입력을 저장하고 평가도 받은 급여소득자(평가 수는 서비스가 더 이상 보지 않는다).
    private UserAccount account;

    @BeforeEach
    void setUp() {
        account = new UserAccount();
        account.setUserId(7L);
        account.setLoginId("employee");
        account.setNickname("데모직장인");
        account.setNameEnc(crypto.encrypt("홍길동"));
        account.setEmailEnc("v1:test-email");
        account.setBirthYear(1990);
        account.setWorkerTypeCode("EMPLOYEE");
        account.setRoleCode(UserAccount.ROLE_USER);
        account.setAccountStatusCode(UserAccount.ACTIVE);
        account.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));

        given(userAccountMapper.selectById(7L)).willAnswer(invocation -> account);
        given(userAccountMapper.selectAccountStatus(anyLong())).willAnswer(invocation -> account.getAccountStatusCode());
        given(userAccountMapper.countAssessments(7L)).willReturn(2);
        given(userAccountMapper.updateWorkerTypeFrom(eq(7L), anyString(), anyString(), any())).willAnswer(invocation -> {
            if (!invocation.getArgument(1).equals(account.getWorkerTypeCode())) return 0;
            account.setWorkerTypeCode(invocation.getArgument(2));
            return 1;
        });
    }

    private MockHttpServletRequestBuilder jobType(String body) {
        return patch("/api/members/me/job-type")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"))
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void 저장한_회원도_다른_직군으로_바꾸면_200과_새_직군() throws Exception {
        mvc.perform(jobType("{\"jobType\":\"FREELANCER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.jobType").value("FREELANCER"));
        verify(userAccountMapper).updateWorkerTypeFrom(eq(7L), eq("EMPLOYEE"), eq("FREELANCER"), any());
        verify(systemLogMapper).insertLog(eq("INFO"), eq("member-service"), eq("직군 변경 EMPLOYEE → FREELANCER (em***)"), eq(7L), any());
    }

    @Test
    void 같은_직군이면_400_SAME_JOB_TYPE() throws Exception {
        mvc.perform(jobType("{\"jobType\":\"EMPLOYEE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SAME_JOB_TYPE"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("jobType"));
        verify(userAccountMapper, never()).updateWorkerTypeFrom(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 틀린_값이면_400_INVALID_INPUT() throws Exception {
        mvc.perform(jobType("{\"jobType\":\"STUDENT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("jobType"));
        mvc.perform(jobType("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        verify(userAccountMapper, never()).updateWorkerTypeFrom(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 잠긴_계정과_탈퇴_계정은_지금처럼_401() throws Exception {
        account.setAccountStatusCode("LOCKED");
        mvc.perform(jobType("{\"jobType\":\"FREELANCER\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));

        account.setAccountStatusCode(UserAccount.WITHDRAWN);
        mvc.perform(jobType("{\"jobType\":\"FREELANCER\"}"))
                .andExpect(status().isUnauthorized());
        verify(userAccountMapper, never()).updateWorkerTypeFrom(anyLong(), anyString(), anyString(), any());
    }
}
