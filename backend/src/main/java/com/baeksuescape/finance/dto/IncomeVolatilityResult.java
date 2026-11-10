package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * FP-184 변동성 지표 및 성수기·비수기 소득 격차 계산 결과 DTO.
 * N-22-3 변동성 지표 및 N-22-4 성수기·비수기 격차 계산 결과를 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomeVolatilityResult {
    /** 12개월 평균 소득 (원) */
    private BigDecimal meanIncome;
    /** 소득 표준편차 (원) */
    private BigDecimal standardDeviation;
    /** 월 소득 변동계수 (CV, %) */
    private BigDecimal coefficientOfVariation;
    /** 변동성이 큰지 여부 (CV > 12.0% 기준) */
    private boolean isHighVolatility;

    /** 성수기(상위 N개월) 평균 소득 (원) */
    private BigDecimal peakSeasonAverage;
    /** 비수기(하위 N개월) 평균 소득 (원) */
    private BigDecimal offPeakSeasonAverage;
    /** 성수기 - 비수기 소득 격차 금액 (원) */
    private BigDecimal gapAmount;
    /** 비수기 대비 소득 격차 비율 (%) */
    private BigDecimal gapRatio;

    /** 소득이 0원인 달의 개수 */
    private int zeroIncomeMonthsCount;
}

