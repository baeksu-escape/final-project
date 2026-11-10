package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// N-15-2 동년배 기준값 조회 응답 DTO — 공공통계(HFS) 연령대별 평균 연소득·총자산·총부채
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PeerBenchmarkResponse {
    // 통계 연도 (예: 2025)
    private Integer statYear;

    // 연령 구간 (예: 20대, 30대, 40대, 50대 이상)
    private String ageGroup;

    // 평균 연소득 (원 단위)
    private Long avgAnnualIncome;

    // 평균 총자산 (원 단위)
    private Long avgTotalAsset;

    // 평균 총부채 (원 단위)
    private Long avgTotalDebt;

    // 표본 가구 수
    private Integer sampleSize;
}

