package com.baeksuescape.finance.dto.simulation;

import java.util.List;

/**
 * FP-170 N-18-5·N-18-8 SIM-02 응답 — ML-04 응답에서 requestId·shap을 빼고 감점 요인에 featureName(DIM_FEATURE)을 더한 모양.
 * delta.total = financialEffect + alternativeEffect ("금융 이력 영향"과 "대안 데이터 영향"). 결과는 저장하지 않는다.
 */
public record CreditCareSimulationResponse(
        String modelVersion,
        String cutoffVersion,
        ScoreSummary before,
        ScoreSummary after,
        Delta delta,
        List<ReductionFactor> topReductionFactors) {

    /** 바꾸기 전·후 대안 점수, 등급, 부도 확률(화면 표시 여부는 N-18-6 미정) */
    public record ScoreSummary(Integer score, String gradeBandCode, Double defaultProb) {
    }

    /** 점수 차이와 그 나눔 */
    public record Delta(Integer total, Integer financialEffect, Integer alternativeEffect) {
    }

    /** N-18-8 감점 요인 1개: 순위, 피처, 이름, 값, 감점, 가장 좋은 값으로 바꿨을 때의 회복 점수 */
    public record ReductionFactor(Integer rank, String featureCode, String featureName, Double featureValue,
            Integer shapScore, Integer recoverScore) {
    }
}
