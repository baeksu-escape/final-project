package com.baeksuescape.help.dto;

/**
 * N-31-2 RPT-04 AI 요약 응답. generated: 이번 요청에서 새로 만들었으면 true, 저장된 요약을 돌려주면 false.
 */
public record AiSummaryResponse(String requestId, String aiSummary, boolean generated) {
}
