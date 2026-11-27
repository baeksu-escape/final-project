package com.baeksuescape.help.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-32-1 CHATBOT_PRESET_QUESTION 조회 결과 한 행 — 용어 도우미 질문 버튼 1개와 등록된 답.
 */
@Getter
@Setter
@NoArgsConstructor
public class ChatbotPresetRow {
    private Long presetId;
    /** 버튼에 보일 질문 */
    private String questionText;
    /** 버튼을 누르면 보일 답 */
    private String answerText;
    /** 버튼 순서 (작을수록 앞) */
    private Integer displayOrder;
}
