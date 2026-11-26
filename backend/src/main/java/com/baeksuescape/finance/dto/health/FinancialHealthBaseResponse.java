package com.baeksuescape.finance.dto.health;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-239 N-16-1·2·4 DIAG-03-1 자산·부채 저장값 — 로그인 회원의 기준월(가장 늦은 소득월) 값.
 * 필드 이름은 자산·부채 건전성 화면 adapter(경환)와 같다. 금액은 원 단위 정수이고 미입력은 0이 아니라 null이다(O-15 A안).
 * 비율·위험 단계는 넣지 않는다. 화면은 이 값으로 DIAG-03(POST /api/diagnosis/financial-health/calculate)을 부른다.
 */
public record FinancialHealthBaseResponse(
        String baseMonth,
        Long totalAssetAmount,
        Long annualIncomeAmount,
        Long totalDebtAmount,
        Long annualPaymentAmount,
        List<LoanItem> loans) {

    /** N-16-4 보유 대출 표 한 행 */
    public record LoanItem(
            long loanId,
            String loanTypeCode,
            String loanTypeName,
            long balanceAmount,
            BigDecimal annualRatePct,
            String rateTypeCode,
            int remainingMonths,
            long monthlyPaymentAmount) {
    }
}
