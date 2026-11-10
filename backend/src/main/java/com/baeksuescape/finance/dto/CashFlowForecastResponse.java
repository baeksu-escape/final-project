package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * N-21 현금흐름 전망 응답 DTO.
 * 과거 12개월 적자 개월 수(N-21-6), 성수기·비수기 격차(N-21-7), 기간별 현금흐름 전망(N-21-5)을 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashFlowForecastResponse {
    /** N-21-6 최근 12개월 적자 개월 수 (지출 > 소득인 달) */
    private int pastDeficitMonthsCount;

    /** N-21-7 성수기·비수기 소득 격차 (N-22-4와 계산 공유) */
    private long peakOffPeakGap;
    private String peakMonth;
    private long peakIncome;
    private String offPeakMonth;
    private long offPeakIncome;

    /** N-21-5 기간별 월별 현금흐름 전망 목록 */
    private List<MonthlyForecastItem> monthlyForecasts;

    /** 전망 기간 중 가장 빠듯한(순현금이 가장 적은) 달 정보 */
    private String worstForecastMonth;
    private long worstNetCashFlow;

    /** 전망 기간 총 누적 잉여금 (원) */
    private long totalAccumulatedSurplus;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyForecastItem {
        /** 전망 대상 월 (예: "2026-09") */
        private String forecastYearMonth;
        /** 전망 소득 금액 (원) */
        private long forecastIncome;
        /** 전망 지출 금액 (원) */
        private long forecastExpense;
        /** 전망 대출 원리금 (원) */
        private long forecastLoanPayment;
        /** 전망 순현금 (소득 - 지출 - 원리금) */
        private long netCashFlow;
        /** 적자 여부 */
        private boolean isDeficit;
    }
}

