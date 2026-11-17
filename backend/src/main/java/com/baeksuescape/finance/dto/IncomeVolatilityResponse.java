package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * N-22 소득 변동성 진단 응답 DTO.
 * 변동성 지표(N-22-3), 성수기·비수기 격차(N-22-4), 소득 부족 달 확인(N-22-5) 결과를 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomeVolatilityResponse {
    // === N-22-3 변동성 지표 ===
    /** 최근 12개월 평균 소득 (원) */
    private long meanIncome;
    /** 최근 12개월 중앙값 소득 (원) */
    private long medianIncome;
    /** 월 소득 변동계수 (CV, %) */
    private double incomeCv;
    /** 변동성이 큰지 여부 (CV > 12.0% 기준) */
    private boolean isHighVolatility;
    /** 최저 소득 달 대비 고정지출 비율 (%) */
    private double fixedExpenseToLowestIncomeRatio;
    /** 소득 0원인 달 수 */
    private int zeroIncomeMonthsCount;
    /** 최근 3개월 평균 소득 (원) */
    private long recent3MonthsAverageIncome;
    /** 최근 3개월 평균과 12개월 평균의 차이 (원) */
    private long recent3MonthsDiff;

    // === N-22-4 성수기·비수기 격차 (N-21-7과 계산 공유) ===
    /** 최고 소득 달 (성수기) 정보 */
    private String peakMonth;
    private long peakIncome;
    /** 최저 소득 달 (비수기) 정보 */
    private String offPeakMonth;
    private long offPeakIncome;
    /** 성수기·비수기 소득 격차 (원) */
    private long peakOffPeakGap;

    // === N-22-5 소득 부족 달 확인 ===
    /** 소득 부족 달 경고 필요 여부 */
    private boolean hasDeficitWarning;
    /** 소득 부족 달 상세 목록 */
    private List<DeficitMonthItem> deficitMonths;
    /** 가장 가까운 비수기 월 (예: "2027-01") */
    private String nearestDeficitMonth;
    /** 가장 가까운 비수기까지 남은 개월 수 */
    private Integer monthsUntilNearest;
    /** 가장 가까운 비수기를 대비해 미리 모아둘 권장 금액 (원) */
    private long recommendedReserveAmount;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeficitMonthItem {
        /** 부족했던 기준월 (예: "2026-01") */
        private String yearMonth;
        /** 그 달의 소득 금액 (원) */
        private long income;
        /** 고정지출 대비 부족했던 금액 (원) */
        private long shortfallAmount;
        /** 마지막 입력월 기준 다시 오기까지 남은 개월 수 */
        private int monthsUntilNext;
    }
}

