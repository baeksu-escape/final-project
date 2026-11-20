package com.baeksuescape.global.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
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

    // FP-143 업무 오류는 상태·코드·방식·경로만 서버 로그에 한 줄 남기고, 응답 문구·칸 오류는 남기지 않는다.
    @Test
    void 업무_오류는_상태_코드_경로만_로그에_남긴다() throws Exception {
        List<String> logs = captureLogs(() -> mvc.perform(post("/api/members/me/__test/conflict").header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isConflict()));
        assertThat(logs).containsExactly("API 오류 409 DUPLICATE_NICKNAME POST /api/members/me/__test/conflict");
    }

    // FP-143 500은 예외 종류와 우리 코드 위치를 남기고, 예외 메시지(SQL·이메일)는 남기지 않는다.
    @Test
    void 예상_못_한_오류는_위치를_남기고_메시지는_남기지_않는다() throws Exception {
        List<String> logs = captureLogs(() -> mvc.perform(post("/api/members/me/__test/boom").header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isInternalServerError()));
        assertThat(logs).hasSize(1);
        assertThat(logs.get(0))
                .startsWith("처리하지 못한 오류: java.lang.IllegalStateException at SecurityTestController.boom:")
                .endsWith("(POST /api/members/me/__test/boom)")
                .doesNotContain("SELECT", "secret@example.com");
    }

    // FP-143 경로 변수에 민감한 문자열(이메일·전화번호 같은 임의 값)이 들어와도 로그에는 경로 템플릿만 남는다(AGENTS.md 5장).
    @Test
    void 경로_변수_값은_로그에_남기지_않고_템플릿만_남긴다() throws Exception {
        String sensitive = "secret@example.com";
        List<String> logs = captureLogs(() -> {
            mvc.perform(post("/api/members/me/__test/items/{code}/conflict", sensitive).header(HttpHeaders.AUTHORIZATION, auth))
                    .andExpect(status().isNotFound());
            mvc.perform(post("/api/members/me/__test/items/{code}/boom", "010-1234-5678").header(HttpHeaders.AUTHORIZATION, auth))
                    .andExpect(status().isInternalServerError());
        });
        assertThat(logs).hasSize(2);
        assertThat(logs.get(0)).isEqualTo("API 오류 404 PRODUCT_NOT_FOUND POST /api/members/me/__test/items/{code}/conflict");
        assertThat(logs.get(1)).endsWith("(POST /api/members/me/__test/items/{code}/boom)");
        assertThat(String.join("\n", logs)).doesNotContain(sensitive, "secret", "010-1234-5678");
    }

    // FP-143 원인 체인 탐색: A에 우리 코드 위치가 없으면 원인 B까지 따라가서 찾는다.
    @Test
    void 첫_예외에_우리_코드가_없으면_원인까지_따라가_찾는다() {
        RuntimeException a = exceptionAt(frame("org.example.Library", "call"));
        RuntimeException b = exceptionAt(frame("com.baeksuescape.sample.Service", "run"));
        a.initCause(b);
        b.initCause(a);   // A→B→A 순환이어도 B에서 찾고 끝난다
        assertThat(GlobalExceptionHandler.firstAppFrame(a)).isEqualTo("Service.run:7");
    }

    // FP-143 A→B→A 순환이고 어디에도 우리 코드가 없으면, 체인을 끝까지 돌고(무한 루프 없이) 맨 위 위치를 돌려준다.
    @Test
    void 원인_체인이_순환하고_우리_코드가_없어도_끝난다() {
        RuntimeException a = exceptionAt(frame("org.example.Library", "call"));
        RuntimeException b = exceptionAt(frame("org.example.Other", "work"));
        a.initCause(b);
        b.initCause(a);
        String found = assertTimeoutPreemptively(Duration.ofSeconds(2), () -> GlobalExceptionHandler.firstAppFrame(a));
        assertThat(found).isEqualTo("org.example.Library.call:7");
    }

    private static StackTraceElement frame(String className, String method) {
        return new StackTraceElement(className, method, "Sample.java", 7);
    }

    private static RuntimeException exceptionAt(StackTraceElement frame) {
        RuntimeException e = new RuntimeException();
        e.setStackTrace(new StackTraceElement[] {frame});
        return e;
    }

    private interface Request {
        void run() throws Exception;
    }

    private static List<String> captureLogs(Request request) throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            request.run();
        } finally {
            logger.detachAppender(appender);
        }
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
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
