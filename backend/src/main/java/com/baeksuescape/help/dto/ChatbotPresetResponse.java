package com.baeksuescape.help.dto;

import java.util.List;

/**
 * N-32-1 HELP-02 용어 도우미 질문 버튼 응답 — 표시 순서대로의 질문·답 목록. 등록된 버튼이 없으면 빈 목록이다.
 */
public record ChatbotPresetResponse(List<Preset> presets) {

    /** 질문 버튼 1개: 번호(화면 key), 질문, 답 */
    public record Preset(Long presetId, String question, String answer) {
    }
}
