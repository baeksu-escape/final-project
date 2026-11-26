package com.baeksuescape.help.service;

import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.dto.ChatbotPresetResponse.Preset;
import com.baeksuescape.help.mapper.ChatbotMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * N-32 용어 도우미(챗봇) 서비스 (FP-181). 지금은 N-32-1 질문 버튼 조회만 있다.
 * 질문 버튼은 등록된 답을 보여 줄 뿐이라 AI를 부르지 않고, 하루 질문 횟수를 줄이거나 기록하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final ChatbotMapper chatbotMapper;

    /** N-32-1 질문 버튼 전체 (표시 순서대로) */
    public ChatbotPresetResponse findPresets() {
        return new ChatbotPresetResponse(chatbotMapper.selectPresets().stream()
                .map(row -> new Preset(row.getPresetId(), row.getQuestionText(), row.getAnswerText()))
                .toList());
    }
}
