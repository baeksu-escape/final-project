package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * N-18-7 같은 점수대 금리·한도·추천 대출 상품 응답 DTO.
 * 점수 구간별 예상 금리/한도와 조건에 맞는 더미 상품 3종을 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanRecommendResponse {
    private int score;
    private String gradeBand;
    private double expectedMinRate;
    private double expectedMaxRate;
    private long expectedLimitAmount;
    private boolean isDummyNotice;
    private List<LoanProductItem> recommendedProducts;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoanProductItem {
        private Long productId;
        private String productName;
        private String institutionName;
        private double minRate;
        private double maxRate;
        private long maxLimitAmount;
        private String jobType;
        private String description;
        private boolean isAvailable;
        private boolean isFavorite;
    }
}

