package com.baeksuescape.help.dto;

import java.util.List;

/**
 * N-32-1 HELP-02 용어 도우미 질문 버튼 응답 — 표시 순서대로의 질문·답 목록. 등록된 버튼이 없으면 빈 목록이다.
 * 창을 처음 열 때 남은 자유 질문 횟수(N-32-2)도 함께 보여 주도록 remainingCount·dailyLimit을 넣는다(따로 API를 두지 않음).
 */
public record ChatbotPresetResponse(List<Preset> presets, int remainingCount, int dailyLimit) {

    /** 질문 버튼 1개: 번호(화면 key), 질문, 답 */
    public record Preset(Long presetId, String question, String answer) {
    }
}
