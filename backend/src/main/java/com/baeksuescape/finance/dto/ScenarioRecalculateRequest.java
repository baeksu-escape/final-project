package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-17-4 시나리오 상환 여력 재계산 요청 DTO.
 * 기준 소득·지출·대출 정보 및 금리/소득/지출 변동폭을 받는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScenarioRecalculateRequest {
    private long baseMonthlyIncome;
    private long baseMonthlyFixedExpense;
    private long baseLoanBalance;
    private double baseInterestRate;
    private double interestRateChange;
    private double incomeChangePercent;
    private double expenseChangePercent;
}

