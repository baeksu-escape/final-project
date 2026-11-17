package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * N-22 소득 변동성 진단 요청 DTO.
 * 최근 12개월 월별 소득 목록과 월 고정지출 금액을 받는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomeVolatilityRequest {
    /** 최근 12개월 월별 소득 목록 */
    private List<MonthlyIncomeItem> monthlyIncomes;
    /** 월 고정지출 금액 (원) */
    private long monthlyFixedExpense;
}

