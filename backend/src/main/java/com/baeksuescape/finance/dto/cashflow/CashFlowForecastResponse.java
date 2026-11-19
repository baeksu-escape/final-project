package com.baeksuescape.finance.dto.cashflow;

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

    /**
     * N-21-9 전망 앞에 이어 그릴 과거 월 실적 (오래된 달 → 최근 달). 계산에 쓴 이력을 그대로 담는다.
     * 저장 데이터 조회는 소득 기준월까지 최대 12개월이고, 급여소득자는 월급을 12개월로 펼친 값이다.
     */
    private List<PastMonthItem> months;

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

    /** N-21-9 과거 한 달 실적 — 필드 이름은 현금흐름 화면 adapter(baseMonth·incomeAmount·expenseAmount)와 맞췄다. */
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PastMonthItem {
        /** 기준월 (예: "2026-08") */
        private String baseMonth;
        /** 그 달 소득 (원) */
        private long incomeAmount;
        /** 그 달 지출 (원). 지출은 평소 월 금액 하나만 저장하므로 저장 데이터 조회에서는 매달 같은 값이다 */
        private long expenseAmount;
    }
}

