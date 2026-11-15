package com.baeksuescape.user.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// FP-85·FP-86 N-05 입력 표 한 행씩(DDL v0.3.2 + FP-209 NO_LOAN_YN). MyBatis가 열 별칭으로 채우고, 저장할 때도 이 객체를 넘긴다.
public final class DataInputRows {

    private DataInputRows() {
    }

    // USER_INCOME_MONTH — 달마다 한 행(UK USER_ID+BASE_MONTH, D-16).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class IncomeRow {
        private Long userId;
        private String baseMonth;
        private String incomeKindCode;
        private Long incomeAmt;
        private LocalDate inputDate;
        private LocalDateTime now;
    }

    // USER_LOAN — 직접 입력은 SOURCE_CODE='MANUAL', CONSENT_ID NULL(W3).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class LoanRow {
        private Long userId;
        private String baseMonth;
        private String loanTypeCode;
        private Long balanceAmt;
        private BigDecimal annualRatePct;
        private String rateTypeCode;
        private Integer remainingMonths;
        private Long monthlyPaymentAmt;
        private String sourceCode;
        private Long consentId;
        private LocalDateTime now;
    }

    // USER_ASSET_SNAPSHOT — TOTAL_ASSET_AMT NULL은 미입력, NO_LOAN_YN NULL은 대출 미확인(O-15).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class AssetRow {
        private Long userId;
        private String baseMonth;
        private Long totalAssetAmt;
        private String noLoanYn;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime now;
    }

    // USER_EXPENSE_ITEM — FIXED·INSTALLMENT·SUBSCRIPTION·OTHER.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ExpenseRow {
        private Long userId;
        private String baseMonth;
        private String expenseGroupCode;
        private String expenseCategory;
        private String description;
        private Long monthlyAmt;
        private LocalDateTime now;
    }

    // USER_CREDIT_PROFILE — 직접 입력(MANUAL, CB_AVAILABLE_YN='N', CB_GRADE NULL, D-29). BASE_DATE는 기준월 말일.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class CreditRow {
        private Long userId;
        private LocalDate baseDate;
        private Integer creditHistoryDays;
        private Integer delinqCount12m;
        private Integer newLoanCount3m;
        private Long cardLimitAmt;
        private Long cardMonthlySpendAmt;
        private BigDecimal cardUtilPct;
        private Integer cashAdvanceMonths;
        private Long privateLenderLoanBalanceAmt;
        private String sourceCode;
        private LocalDateTime now;
    }

    // USER_CONSENT — 대안 데이터 정보 제공 동의(ALT_DATA_PROVISION).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ConsentRow {
        private Long consentId;
        private Long userId;
        private String consentTypeCode;
        private String providerCode;
        private String itemCode;
        private String requiredYn;
        private String agreedYn;
        private String termsVersion;
        private LocalDateTime agreedAt;
        private LocalDateTime expiresAt;
        private LocalDateTime withdrawnAt;
        private String externalConsentId;
        private LocalDateTime createdAt;
    }

    // USER_TELECOM_PAYMENT·USER_UTILITY_PAYMENT — 청구·납부 한 달(두 표 열이 같다).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class BillRow {
        private Long userId;
        private String billMonth;
        private Long billedAmt;
        private LocalDate dueDate;
        private LocalDate paidDate;
        private String paymentStatusCode;
        private Long consentId;
        private LocalDate baseDate;
        private LocalDateTime createdAt;
    }

    // USER_EASYPAY_USAGE — MISSING이면 건수·금액·이용일 수가 NULL(CK_UEU_VALUES).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class EasypayRow {
        private Long userId;
        private String baseMonth;
        private String observationStatusCode;
        private Integer paymentCount;
        private Long paymentAmt;
        private Integer activeDays;
        private Long consentId;
        private LocalDate baseDate;
        private LocalDateTime createdAt;
    }

    // USER_SOCIAL_INSURANCE_PAYMENT — 국민연금·건강보험 한 달.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class InsuranceRow {
        private Long userId;
        private String insuranceTypeCode;
        private String baseMonth;
        private String coverageStatusCode;
        private String payerTypeCode;
        private Long billedAmt;
        private Long individualAmt;
        private Long paidAmt;
        private LocalDate dueDate;
        private LocalDate paidDate;
        private String paymentStatusCode;
        private Long consentId;
        private LocalDate baseDate;
        private LocalDateTime createdAt;
    }
}
