package com.baeksuescape.finance.dto.cashflow;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    /**
     * N-21-1·N-21-2 저장 데이터 조회(DIAG-08-1)에서 읽은 기준값 (원). 화면 조건(고정지출 슬라이더 등)의 처음 값으로 쓴다.
     * 기타 지출 = 월 지출 합계 − 고정지출이고, 지출에는 대출 원리금이 들어 있지 않다(원리금은 baseMonthlyLoanPayment).
     * 요청 본문으로 계산하는 DIAG-08(POST)은 저장값이 없어 null이다.
     */
    @Setter
    private Long baseFixedExpenseAmount;
    @Setter
    private Long baseOtherExpenseAmount;
    @Setter
    private Long baseMonthlyLoanPayment;

    /**
     * N-21-1·N-21-3·N-21-5 기타 지출(FIXED 제외)의 항목별 내역. 합이 baseOtherExpenseAmount와 같다.
     * 금액 큰 순, 같으면 저장 순이다. 저장 데이터 조회(DIAG-08-1)만 채우고 POST(DIAG-08)는 null이며, 항목이 없으면 빈 리스트다.
     */
    @Setter
    private List<BaseOtherExpenseItem> baseOtherExpenseItems;
    /**
     * N-21-1·N-21-3·N-21-5 보유 대출별 월 원리금 내역. 합이 baseMonthlyLoanPayment와 같다.
     * 대출 번호 순이다. 저장 데이터 조회(DIAG-08-1)만 채우고 POST(DIAG-08)는 null이며, 대출이 없으면 빈 리스트다.
     */
    @Setter
    private List<BaseLoanItem> baseLoanItems;

    /** N-21-3 기타 지출 한 항목 (소득 기준월, FIXED 제외). 매퍼가 열 별칭으로 바로 채운다. */
    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BaseOtherExpenseItem {
        private String expenseGroupCode;
        private String expenseCategory;
        private String description;
        /** 월 금액 (원) */
        private long monthlyAmount;
    }

    /** N-21-5 대출 한 건의 월 원리금 (소득 기준월). 매퍼가 열 별칭으로 바로 채운다. */
    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BaseLoanItem {
        private long loanId;
        private String loanTypeName;
        /** 월 원리금 (원) */
        private long monthlyPaymentAmount;
    }

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

