package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * N-21 현금흐름 전망 요청 DTO.
 * 과거 12개월 소득·지출 이력과 향후 전망 변경 조건을 받는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashFlowForecastRequest {
    /** 과거 12개월 월별 소득/지출 이력 (N-21-6 적자 개월 수 및 N-21-7 계산용) */
    private List<MonthlyIncomeItem> past12MonthsHistory;

    /** 기준 월 소득 (원) */
    private long baseMonthlyIncome;
    /** 기준 월 고정 지출 (원) */
    private long baseMonthlyFixedExpense;
    /** 기준 월 대출 원리금 상환액 (원) */
    private long baseLoanMonthlyPayment;

    /** 소득 변화율 (% 단위, 예: -10.0은 10% 감소) */
    private double incomeChangePercent;
    /** 지출 변화율 (% 단위, 예: +5.0은 5% 증가) */
    private double expenseChangePercent;
    /** 원리금 변화율 (% 단위, 예: 금리 인상 시 원리금 증가) */
    private double loanPaymentChangePercent;

    /** 전망 기간 (개월 단위, 3, 6, 12개월 중 선택) */
    private int forecastMonths;
}

