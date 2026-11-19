package com.baeksuescape.finance.dto.scenario;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-17-4 시나리오 상환 여력 재계산 요청 DTO.
 * 기준 소득·지출·대출 정보 및 금리/소득/지출 변동폭을 받는다.
 * 아직 쓰는 곳이 없으며, FP-167(시나리오 재계산) 구현 때 모양을 고치거나 지운다.
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

