package com.baeksuescape.global.exception;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-87 공통 오류 응답 — 프론트 serverErrors.js가 읽는 { code, message, fieldErrors: [{ field, message }] } 모양인지 확인한다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;

    private String auth;

    @BeforeEach
    void login() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
        auth = "Bearer " + tokenProvider.issue(7L, "ROLE_USER");
    }

    @Test
    void Valid_실패는_400_INVALID_INPUT과_칸별_오류() throws Exception {
        mvc.perform(post("/api/members/me/__test/validate").header(HttpHeaders.AUTHORIZATION, auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("nickname"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("닉네임은 2~12자로 넣어 주세요."));
    }

    @Test
    void JSON_형식_오류는_400_INVALID_INPUT() throws Exception {
        mvc.perform(post("/api/members/me/__test/validate").header(HttpHeaders.AUTHORIZATION, auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty());
    }

    @Test
    void ApiException은_던진_상태와_코드를_그대로_쓴다() throws Exception {
        mvc.perform(post("/api/members/me/__test/conflict").header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_NICKNAME"))
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("nickname"));
    }

    @Test
    void 예상_못_한_오류는_500이고_원래_메시지를_내보내지_않는다() throws Exception {
        mvc.perform(post("/api/members/me/__test/boom").header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(content().string(not(containsString("SELECT"))))
                .andExpect(content().string(not(containsString("secret@example.com"))));
    }

    @Test
    void 없는_경로는_404_NOT_FOUND_지원하지_않는_방식은_405() throws Exception {
        mvc.perform(get("/api/members/me/__test/nothing-here").header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(get("/api/members/me/__test/validate").header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }
}
