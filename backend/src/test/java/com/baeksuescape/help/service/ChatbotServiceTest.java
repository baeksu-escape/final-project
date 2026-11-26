package com.baeksuescape.help.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.dto.ChatbotPresetRow;
import com.baeksuescape.help.mapper.ChatbotMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * FP-181 N-32-1 질문 버튼 서비스 테스트 — 저장된 행을 화면용 모양으로 바꾸고, 횟수 기록 없이 조회만 하는지 DB 없이 확인한다.
 */
class ChatbotServiceTest {

    private ChatbotMapper mapper;
    private ChatbotService service;

    @BeforeEach
    void setUp() {
        mapper = mock(ChatbotMapper.class);
        service = new ChatbotService(mapper);
    }

    private static ChatbotPresetRow row(long id, String question, String answer, int order) {
        ChatbotPresetRow row = new ChatbotPresetRow();
        row.setPresetId(id);
        row.setQuestionText(question);
        row.setAnswerText(answer);
        row.setDisplayOrder(order);
        return row;
    }

    @Test
    @DisplayName("질문 버튼을 매퍼가 준 순서 그대로 번호·질문·답으로 돌려주고, 조회 말고는 아무것도 하지 않는다(횟수 차감 없음)")
    void findPresets() {
        when(mapper.selectPresets()).thenReturn(List.of(
                row(3L, "대안 신용 점수는 무엇이 다른가요?", "생활 기록을 더해 본 점수입니다.", 1),
                row(1L, "DSR이 높으면 어떤 뜻인가요?", "소득에 비해 빚 갚는 부담이 크다는 뜻입니다.", 2)));

        List<ChatbotPresetResponse.Preset> presets = service.findPresets().presets();

        assertEquals(2, presets.size());
        assertEquals(3L, presets.get(0).presetId());
        assertEquals("대안 신용 점수는 무엇이 다른가요?", presets.get(0).question());
        assertEquals("생활 기록을 더해 본 점수입니다.", presets.get(0).answer());
        assertEquals("DSR이 높으면 어떤 뜻인가요?", presets.get(1).question());
        verify(mapper).selectPresets();
        verifyNoMoreInteractions(mapper);
    }

    @Test
    @DisplayName("등록된 질문 버튼이 없으면 오류가 아니라 빈 목록이다")
    void emptyPresets() {
        when(mapper.selectPresets()).thenReturn(List.of());

        assertTrue(service.findPresets().presets().isEmpty());
    }
}
