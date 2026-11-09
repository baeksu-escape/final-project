package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-20-4 DSR 계산 요청 DTO.
 * 연소득과 연간 총 원리금 상환액을 받는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DsrCalculateRequest {
    private long annualIncome;
    private long annualDebtService;
}

