package com.baeksuescape.help.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.help.dto.AiSummaryResponse;
import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.dto.ChatbotQuestionResponse;
import com.baeksuescape.help.service.AiSummaryService;
import com.baeksuescape.help.service.ChatbotService;
import com.baeksuescape.user.mapper.UserAccountMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * FP-181 용어 도우미 API(HELP-02 질문 버튼, HELP-03 자유 질문)와 AI 요약 API(RPT-04)의 JSON 모양·입력 검사·로그인·권한을 보는 API 테스트.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatbotControllerTest {

    private static final String REQUEST_ID = "11111111-2222-4333-8444-555555555555";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private ChatbotService chatbotService;

    @MockBean
    private AiSummaryService aiSummaryService;

    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUpAccount() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private String userToken() {
        return "Bearer " + tokenProvider.issue(2L, "ROLE_USER");
    }

    @Test
    @DisplayName("HELP-02 로그인하면 presets 아래 presetId·question·answer와 remainingCount·dailyLimit이 나가고 DB 열 이름은 없다")
    void getPresets() throws Exception {
        when(chatbotService.findPresets(2L)).thenReturn(new ChatbotPresetResponse(List.of(
                new ChatbotPresetResponse.Preset(1L, "DSR이 높으면 어떤 뜻인가요?", "소득에 비해 빚 갚는 부담이 크다는 뜻입니다.")), 7, 10));

        mockMvc.perform(get("/api/chatbot/presets").header(HttpHeaders.AUTHORIZATION, userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.presets[0].presetId").value(1))
                .andExpect(jsonPath("$.presets[0].question").value("DSR이 높으면 어떤 뜻인가요?"))
                .andExpect(jsonPath("$.presets[0].answer").value("소득에 비해 빚 갚는 부담이 크다는 뜻입니다."))
                .andExpect(jsonPath("$.presets[0].questionText").doesNotExist())
                .andExpect(jsonPath("$.presets[0].displayOrder").doesNotExist())
                .andExpect(jsonPath("$.remainingCount").value(7))
                .andExpect(jsonPath("$.dailyLimit").value(10));
    }

    @Test
    @DisplayName("토큰이 없으면 보안 설정이 401 UNAUTHORIZED를 내고 서비스를 부르지 않는다")
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/chatbot/presets"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(post("/api/chatbot/questions").contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"DSR\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(chatbotService);
    }

    @Test
    @DisplayName("HELP-03 질문을 보내면 answer·remainingCount·dailyLimit으로 답한다")
    void ask() throws Exception {
        when(chatbotService.ask(2L, "DSR이 뭐예요?")).thenReturn(new ChatbotQuestionResponse("DSR은 …입니다.", 9, 10));

        mockMvc.perform(post("/api/chatbot/questions").header(HttpHeaders.AUTHORIZATION, userToken())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"DSR이 뭐예요?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("DSR은 …입니다."))
                .andExpect(jsonPath("$.remainingCount").value(9))
                .andExpect(jsonPath("$.dailyLimit").value(10));
    }

    @Test
    @DisplayName("HELP-03 빈 질문·공백만·201자는 400 INVALID_INPUT이고 서비스를 부르지 않는다")
    void askValidation() throws Exception {
        String tooLong = "가".repeat(201);
        for (String body : List.of("{}", "{\"question\":\"   \"}", "{\"question\":\"" + tooLong + "\"}")) {
            mockMvc.perform(post("/api/chatbot/questions").header(HttpHeaders.AUTHORIZATION, userToken())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("question"));
        }
        verifyNoInteractions(chatbotService);
    }

    @Test
    @DisplayName("HELP-03 하루 횟수를 넘기면 서비스의 429 DAILY_LIMIT_EXCEEDED가 공통 오류 모양으로 나간다")
    void askLimit() throws Exception {
        when(chatbotService.ask(2L, "DSR")).thenThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "DAILY_LIMIT_EXCEEDED", "자유 질문은 하루 10번까지 할 수 있습니다."));

        mockMvc.perform(post("/api/chatbot/questions").header(HttpHeaders.AUTHORIZATION, userToken())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"DSR\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("DAILY_LIMIT_EXCEEDED"));
    }

    @Test
    @DisplayName("RPT-04 로그인한 사용자는 requestId·aiSummary·generated를 받는다")
    void aiSummary() throws Exception {
        when(aiSummaryService.summarize(2L, REQUEST_ID)).thenReturn(new AiSummaryResponse(REQUEST_ID, "요약 문장입니다.", true));

        mockMvc.perform(post("/api/report/" + REQUEST_ID + "/ai-summary").header(HttpHeaders.AUTHORIZATION, userToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestId").value(REQUEST_ID))
                .andExpect(jsonPath("$.aiSummary").value("요약 문장입니다."))
                .andExpect(jsonPath("$.generated").value(true));
        verify(aiSummaryService).summarize(2L, REQUEST_ID);
    }

    @Test
    @DisplayName("RPT-04 토큰이 없으면 401, 관리자 토큰이면 403(/api/report/** = ROLE_USER)이고 서비스를 부르지 않는다")
    void aiSummaryAuth() throws Exception {
        mockMvc.perform(post("/api/report/" + REQUEST_ID + "/ai-summary"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/report/" + REQUEST_ID + "/ai-summary")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(aiSummaryService);
    }
}
