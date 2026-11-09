package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-18-5 시뮬레이터 9개 행동 변경 요청 DTO.
 * 슬라이더 5개와 직접 금액 입력 4개로 구성된다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreditCareRecalculateRequest {
    // 슬라이더 5개
    private Integer currentScore;
    private Integer telecomPaymentMonths;
    private Integer delinquencyCount1y;
    private Integer cashServiceMonths;
    private Integer newLoanCount3m;
    private Integer easypayMonthlyCount;

    // 금액 입력 4개
    private Long creditCardLimit;
    private Long monthlyCardSpend;
    private Long loanBalance;
    private Long loanBalanceSubprime;
}

