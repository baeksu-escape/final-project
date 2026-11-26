package com.baeksuescape.finance.dto.health;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-239 N-16-1·2·4 DIAG-03-1 자산·부채 저장값 — 로그인 회원의 기준월(가장 늦은 소득월) 값.
 * 필드 이름은 자산·부채 건전성 화면 adapter(경환)와 같다. 금액은 원 단위 정수이고 미입력은 0이 아니라 null이다(O-15 A안).
 * 화면은 이 값으로 DIAG-03을 호출해 건전성 비율·위험 단계를 구하고, 공과금 납부 요약(N-20-5)은 응답에서 읽는다.
 */
public record FinancialHealthBaseResponse(
        String baseMonth,
        Long totalAssetAmount,
        Long annualIncomeAmount,
        Long totalDebtAmount,
        Long annualPaymentAmount,
        List<LoanItem> loans,
        UtilityPayment utilityPayment) {

    /** N-20-5 공과금 없이 응답을 만드는 기존 호출에서는 납부 요약을 null로 둔다. */
    public FinancialHealthBaseResponse(String baseMonth, Long totalAssetAmount, Long annualIncomeAmount,
                                      Long totalDebtAmount, Long annualPaymentAmount, List<LoanItem> loans) {
        this(baseMonth, totalAssetAmount, annualIncomeAmount, totalDebtAmount, annualPaymentAmount, loans, null);
    }

    /** N-20-5 기한 내 납부율의 분모는 기록이 있는 달 수다. 월별 기록은 청구월 오름차순이다. */
    public record UtilityPayment(
            int recordedMonthCount,
            int onTimeMonthCount,
            int lateMonthCount,
            BigDecimal onTimeRatePct,
            List<UtilityPaymentMonth> months) {
    }

    /** N-20-1 한 청구월의 기관 연동 공과금 납부 상태다. */
    public record UtilityPaymentMonth(String billMonth, String paymentStatusCode) {
    }

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
