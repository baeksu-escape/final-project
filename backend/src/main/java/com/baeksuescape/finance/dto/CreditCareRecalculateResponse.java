package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * N-18-5 시뮬레이터 점수 재계산 결과 응답 DTO.
 * 변경 전후 점수/등급, 점수 차이, 상위 감점 요인 3개를 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreditCareRecalculateResponse {
    private int currentScore;
    private String currentGradeBand;
    private int expectedScore;
    private String expectedGradeBand;
    private int scoreDiff;
    private int modelRecalculatedDiff;
    private int altDataBonusDiff;
    private double expectedDefaultRate;
    private List<ReductionFactorItem> topReductionFactors;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReductionFactorItem {
        private String factorName;
        private String currentValue;
        private int reductionScore;
        private String actionCondition;
        private int recoverScore;
    }
}

