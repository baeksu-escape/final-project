package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-20-4 DSR 계산 결과 응답 DTO.
 * DSR 비율, 위험 단계(SAFE/CAUTION/DANGER), 배지 텍스트를 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DsrCalculateResponse {
    private long annualIncome;
    private long annualDebtService;
    private double dsrRatio;
    private String riskLevel;
    private String riskBadgeText;
    private String description;
}

