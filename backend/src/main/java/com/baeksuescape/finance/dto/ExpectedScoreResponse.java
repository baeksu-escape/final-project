package com.baeksuescape.finance.dto;

/**
 * FP-170 N-21-8 DIAG-09 현금흐름 조건별 예상 대안 점수.
 * 현재 점수는 점수가 나온 최근 평가에 저장된 대안 점수, 예상 점수는 소득·지출 조건을 바꿔 ML-03으로 다시 구한 값이다(저장 안 함).
 * paymentStatusApplied는 납부 상태(제때·밀림)가 점수에 반영됐는지다. 반영 방식이 정해지기 전이라 지금은 항상 false.
 */
public record ExpectedScoreResponse(
        Integer currentScore,
        String currentGradeBandCode,
        Integer expectedScore,
        String expectedGradeBandCode,
        Integer scoreDiff,
        String modelVersion,
        String baseRequestId,
        boolean paymentStatusApplied) {
}
