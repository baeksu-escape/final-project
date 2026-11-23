package com.baeksuescape.finance.dto.cashflow;

/**
 * FP-170 N-21-8 DIAG-09 현금흐름 조건별 예상 대안 점수.
 * 현재 점수는 점수가 나온 최근 평가에 저장된 대안 점수, 예상 점수는 소득·지출 조건을 바꿔 ML-03으로 다시 구한 값이다(저장 안 함).
 * paymentStatusApplied는 납부 상태가 점수에 반영됐는지다. FP-239부터 밀림(DELAYED)이면 true, 제때·생략이면 false.
 * assumedDelinquencyCount는 밀림일 때 점수 계산에 넣은 최근 1년 30일 이상 연체 건수(저장값 + 1, 저장값 없으면 1)이고, 밀림이 아니면 null이다.
 * modelVersion은 예상 점수를 계산한 모델(ACTIVE), baseModelVersion은 현재 점수를 낸 모델이다. 둘이 다르면 scoreDiff에 모델 차이도 섞인다.
 */
public record ExpectedScoreResponse(
        Integer currentScore,
        String currentGradeBandCode,
        Integer expectedScore,
        String expectedGradeBandCode,
        Integer scoreDiff,
        String modelVersion,
        String baseModelVersion,
        String baseRequestId,
        boolean paymentStatusApplied,
        Integer assumedDelinquencyCount) {
}
