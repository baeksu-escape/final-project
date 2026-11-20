package com.baeksuescape.finance.dto.health;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * FP-239 N-16-4 DIAG-03-1 기준월 보유 대출 한 행 (USER_LOAN + DIM_LOAN_TYPE 이름).
 */
@Getter
@Setter
@NoArgsConstructor
public class HealthLoanRow {
    private long loanId;
    private String loanTypeCode;
    private String loanTypeName;
    private long balanceAmount;
    /** 연 금리 (%, 8.9 = 8.9%) */
    private BigDecimal annualRatePct;
    /** FIXED·VARIABLE·UNKNOWN */
    private String rateTypeCode;
    private int remainingMonths;
    private long monthlyPaymentAmount;
}
