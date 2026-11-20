package com.baeksuescape.finance.dto.scenario;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-17-2 소득 기준월의 변동금리(VARIABLE) 대출 한 행 — 잔액, 연 금리(%), 월 원리금.
 * 금리 변화를 대출마다 0% 아래로 내려가지 않게 반영하고, 변동금리 대출의 상환액만 바꾸는 데 쓴다.
 */
@Getter
@Setter
@NoArgsConstructor
public class VariableLoanRow {
    private long balanceAmount;
    private BigDecimal annualRatePct;
    private long monthlyPaymentAmount;
}
