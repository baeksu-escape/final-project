package com.baeksuescape.help.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.help.dto.ChatbotPresetResponse;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * FP-181 GET /api/chatbot/presets(HELP-02)의 JSON 필드 이름과 로그인 확인(토큰 없음 401)을 보는 API 테스트.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatbotControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private ChatbotService chatbotService;

    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUpAccount() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    @Test
    @DisplayName("로그인하면 presets 아래 presetId·question·answer로 나가고 DB 열 이름(questionText·displayOrder)은 없다")
    void getPresets() throws Exception {
        when(chatbotService.findPresets()).thenReturn(new ChatbotPresetResponse(List.of(
                new ChatbotPresetResponse.Preset(1L, "DSR이 높으면 어떤 뜻인가요?", "소득에 비해 빚 갚는 부담이 크다는 뜻입니다."))));

        mockMvc.perform(get("/api/chatbot/presets")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(2L, "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.presets[0].presetId").value(1))
                .andExpect(jsonPath("$.presets[0].question").value("DSR이 높으면 어떤 뜻인가요?"))
                .andExpect(jsonPath("$.presets[0].answer").value("소득에 비해 빚 갚는 부담이 크다는 뜻입니다."))
                .andExpect(jsonPath("$.presets[0].questionText").doesNotExist())
                .andExpect(jsonPath("$.presets[0].displayOrder").doesNotExist());
    }

    @Test
    @DisplayName("토큰이 없으면 보안 설정이 401 UNAUTHORIZED를 내고 서비스를 부르지 않는다")
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/chatbot/presets"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(chatbotService);
    }
}
