package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-16-1·2 건전성 지표 계산 결과 응답 DTO.
 * 총자산·총부채·순자산 요약과 비율 3개, 비율별 위험 단계(SAFE/CAUTION/DANGER)를 담는다. 비율·단계가 null이면 계산 불가다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinancialHealthResponse {
    /** 총자산 (원) */
    private long totalAsset;
    /** 총부채 (원) */
    private long totalDebt;
    /** 순자산 = 총자산 - 총부채 (원, 음수 가능) */
    private long netAsset;

    /** 상환 부담률(DSR, %). 연소득이 0 이하이면 null */
    private Double repaymentBurdenRatio;
    /** 상환 부담률 위험 단계 (30% 주의 / 40% 위험) */
    private String repaymentBurdenLevel;

    /** 자산 대비 부채 비율(%). 총자산이 0 이하이면 null */
    private Double debtToAssetRatio;
    /** 자산 대비 부채 위험 단계 (40% 주의 / 60% 위험) */
    private String debtToAssetLevel;

    /** 순자산 대비 부채 비율(%). 순자산이 0 이하이면 null */
    private Double debtToNetAssetRatio;
    /** 순자산 대비 부채 위험 단계 (70% 주의 / 100% 위험) */
    private String debtToNetAssetLevel;
}
