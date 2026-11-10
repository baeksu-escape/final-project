package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-186 현금흐름 전망 및 적자 개월 수 계산 결과 DTO.
 * N-21-5 현금흐름 전망 및 N-21-6 적자 개월 수 산출 결과를 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashFlowForecastResult {
    /** 월별 전망 상세 목록 (순 현금흐름 포함) */
    private List<MonthlyFlowDetail> monthlyFlows;

    /** 총 적자 개월 수 (순 현금흐름 < 0인 달의 수) */
    private int totalDeficitMonthsCount;
    /** 최대 연속 적자 개월 수 */
    private int maxConsecutiveDeficitMonths;
    /** 총 누적 적자액 (음수인 달들의 순현금 절댓값 합계, 원) */
    private BigDecimal totalDeficitAmount;
    /** 전체 전망 기간 총 누적 순 현금흐름 합계 (원) */
    private BigDecimal totalNetCashFlow;

    /** 가장 빠듯한(순현금이 가장 낮거나 적자가 큰) 달 식별자 */
    private String worstMonth;
    /** 가장 빠듯한 달의 순 현금흐름 금액 (원) */
    private BigDecimal worstNetCashFlow;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyFlowDetail {
        /** 월 식별자 (예: "2026-09" 또는 "Month 1") */
        private String monthIdentifier;
        /** 예상 수입 금액 (원) */
        private BigDecimal expectedIncome;
        /** 예상 지출 금액 (원) */
        private BigDecimal expectedExpense;
        /** 순 현금흐름 (예상 수입 - 예상 지출, 원) */
        private BigDecimal netCashFlow;
        /** 적자 여부 (netCashFlow < 0) */
        private boolean isDeficit;
    }
}

