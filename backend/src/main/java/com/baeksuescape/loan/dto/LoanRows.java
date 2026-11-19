package com.baeksuescape.loan.dto;

import java.math.BigDecimal;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// N-37 대출 상품 표(LOAN_PRODUCT·LOAN_PRODUCT_WORKER_TYPE·LOAN_PRODUCT_FEATURE)와 1:1로 맞는 행 — MyBatis가 채운다.
public final class LoanRows {

    private LoanRows() {
    }

    // LOAN_PRODUCT 한 행 (화면에 쓰는 열만)
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ProductRow {
        private Long productId;
        private String productCode;
        private String providerName;
        private String productName;
        private String summary;
        private String description;
        private BigDecimal rateMinPct;
        private BigDecimal rateMaxPct;
        private Long limitMaxAmt;
        private String termText;
        private String repaymentMethod;
        private Integer minAltScore;
        private String eligibilityText;
        private String requiredDocuments;
        private String cautionText;
        private String dummyYn;
    }

    // LOAN_PRODUCT_WORKER_TYPE 한 행
    @Getter
    @Setter
    @NoArgsConstructor
    public static class WorkerTypeRow {
        private Long productId;
        private String workerTypeCode;
    }

    // LOAN_PRODUCT_FEATURE 한 행 (DISPLAY_ORDER 순으로 읽는다)
    @Getter
    @Setter
    @NoArgsConstructor
    public static class FeatureRow {
        private Long productId;
        private String featureText;
    }
}
