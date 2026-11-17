package com.baeksuescape.assessment.dto;

import java.time.OffsetDateTime;

// FP-142 RPT-01 N-12-2 점수 산출 요청·응답 (B팀 명세서 3-1, 화면 dataInputApi.js·dataInputMockHandlers.js와 같은 모양).
public final class ScoreDtos {

    private ScoreDtos() {
    }

    // 요청 본문 { requestId } — 화면이 버튼을 누를 때 만든 소문자 UUID. 다시 시도할 때 같은 값을 보낸다.
    public record ScoreRequest(String requestId) {
    }

    // 응답 200 — SCORED 또는 NOT_SCORABLE(STALE_INPUT·MODEL_ERROR). NOT_SCORABLE이면 alternative는 null.
    public record ScoreResponse(OffsetDateTime calculatedAt, String requestId, String gradeStatusCode, String notScorableReasonCode,
            AlternativeResult alternative, TraditionalResult traditional) {
    }

    public record AlternativeResult(Integer score, String gradeBandCode) {
    }

    // 기존 모델은 산정 불가일 수 있다(scorableYn "N"이면 점수·등급 null).
    public record TraditionalResult(String scorableYn, Integer score, String gradeBandCode) {
    }
}
