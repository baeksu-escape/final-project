package com.baeksuescape.loan.dto;

import java.util.List;

// N-37 대출 상품 API 응답(API 정의서 2-7 LOAN-01~05). 필드 이름은 화면 mock(frontend features/loans)과 같다.
// 상품은 더미 데이터이고 금리·한도는 "같은 점수대의 참고 정보"다(dummyYn). 내 점수·즐겨찾기 여부는 상품 응답에 넣지 않는다.
public final class LoanDtos {

    private LoanDtos() {
    }

    // LOAN-01 목록 한 칸·LOAN-02 상세. minScore가 null이면 점수 조건 없음(누구나 충족).
    public record Product(Long productId, String productCode, String name, String providerName, String summary, String description,
            String eligibility, double rateMinPct, double rateMaxPct, long limitAmount, Integer minScore, List<String> workerTypeCodes,
            String termText, String repaymentMethod, List<String> requiredDocuments, List<String> features, String cautionText,
            boolean dummyYn) {
    }

    // LOAN-01 전체 상품(PRODUCT_ID 순). 필터·정렬은 화면이 한다.
    public record ProductList(List<Product> items) {
    }

    // LOAN-03 즐겨찾기한 상품 코드 목록(최근에 담은 순)
    public record FavoriteList(List<String> items) {
    }
}
