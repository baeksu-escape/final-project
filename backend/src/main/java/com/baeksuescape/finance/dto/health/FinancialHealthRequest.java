package com.baeksuescape.finance.dto.health;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-16-1·N-16-3 건전성 지표 계산 요청 DTO.
 * 총자산·연소득·총부채(대출 잔액 합)·연간 원리금 상환액을 받는다. 값 바꿔 보기에서 바꾼 값도 이 형식으로 보낸다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinancialHealthRequest {
    /** 총자산 (원) */
    private long totalAsset;
    /** 연소득 (원) */
    private long annualIncome;
    /** 총부채 = 대출 잔액 합계 (원) */
    private long totalDebt;
    /** 연간 원리금 상환액 (원) */
    private long annualDebtService;
}
