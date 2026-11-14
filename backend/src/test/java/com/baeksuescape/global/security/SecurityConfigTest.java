package com.baeksuescape.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-87 보안 설정 — 401·403 JSON, 역할별 경로, 탈퇴·잠금 계정, 임시 개방 경로, CORS 미리 요청. 실제 DB 없이 계정 상태 조회는 mock으로 대신한다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTest {

    private static final String FRONT_ORIGIN = "http://localhost:5173";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void activeByDefault() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private String bearer(long userId, String role) {
        return "Bearer " + tokenProvider.issue(userId, role);
    }

    @Test
    void 토큰이_없으면_401_JSON() throws Exception {
        mvc.perform(get("/api/members/me/__test/ping"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    void 틀린_토큰은_401() throws Exception {
        mvc.perform(get("/api/members/me/__test/ping").header(HttpHeaders.AUTHORIZATION, "Bearer broken"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 사용자_토큰으로_내_정보_경로를_부르면_USER_ID를_받는다() throws Exception {
        mvc.perform(get("/api/members/me/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(7))
                .andExpect(jsonPath("$.role").value("ROLE_USER"));
    }

    @Test
    void 사용자_토큰으로_관리자_경로는_403_JSON() throws Exception {
        mvc.perform(get("/api/admin/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    void 관리자_토큰은_관리자_경로를_쓰고_사용자_경로는_403() throws Exception {
        mvc.perform(get("/api/admin/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(1L, "ROLE_ADMIN")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/members/me/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(1L, "ROLE_ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void 탈퇴_회원은_토큰이_있어도_401() throws Exception {
        given(userAccountMapper.selectAccountStatus(9L)).willReturn("WITHDRAWN");
        mvc.perform(get("/api/members/me/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(9L, "ROLE_USER")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 없는_회원은_401_잠긴_회원은_통과() throws Exception {
        given(userAccountMapper.selectAccountStatus(10L)).willReturn(null);
        given(userAccountMapper.selectAccountStatus(11L)).willReturn("LOCKED");
        mvc.perform(get("/api/members/me/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(10L, "ROLE_USER")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/members/me/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(11L, "ROLE_USER")))
                .andExpect(status().isOk());
    }

    @Test
    void 임시_개방_경로는_토큰_없이_통과() throws Exception {
        mvc.perform(get("/api/finance/__test/ping")).andExpect(status().isOk());
    }

    @Test
    void 목록에_없는_그_밖의_API는_로그인이_필요하다() throws Exception {
        mvc.perform(get("/api/other/__test/ping")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/other/__test/ping").header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized());
    }

    // 로그인·가입 API는 아직 없으므로(작업 2) 401이 아닌지만 본다. 지금은 404 NOT_FOUND.
    @Test
    void 인증_API는_토큰_없이_부를_수_있다() throws Exception {
        for (String path : new String[] {"/api/auth/login", "/api/auth/signup", "/api/auth/email/send", "/api/auth/email/verify",
                "/api/auth/find-id", "/api/auth/password/reset", "/api/auth/social/exchange", "/api/auth/social/link",
                "/api/auth/admin/verify-code"}) {
            int status = mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}")).andReturn().getResponse().getStatus();
            assertThat(status).as(path).isNotIn(401, 403);
        }
    }

    @Test
    void 허용한_출처의_CORS_미리_요청은_통과한다() throws Exception {
        mvc.perform(options("/api/members/me/__test/ping")
                        .header(HttpHeaders.ORIGIN, FRONT_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, FRONT_ORIGIN));
    }

    @Test
    void 다른_출처의_CORS_미리_요청은_거부한다() throws Exception {
        mvc.perform(options("/api/members/me/__test/ping")
                        .header(HttpHeaders.ORIGIN, "http://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
