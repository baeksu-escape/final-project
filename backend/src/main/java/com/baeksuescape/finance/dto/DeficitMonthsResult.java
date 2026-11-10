package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-185 소득 부족 달 확인 계산 결과 DTO.
 * N-22-5 기준 소득(고정지출 등) 미만인 달의 목록, 부족액 합계 및 사전 대비 알림 정보를 담는다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeficitMonthsResult {
    /** 기준 소득 금액 (원) */
    private BigDecimal thresholdAmount;
    /** 소득 부족 달의 총 개수 */
    private int deficitMonthsCount;
    /** 총 부족액 합계 (원) */
    private BigDecimal totalShortfallAmount;
    /** 부족 달 경고 발생 여부 (부족 달 > 0) */
    private boolean hasDeficitWarning;

    /** 부족 달 상세 항목 목록 */
    private List<DeficitMonthDetail> deficitItems;

    /** 가장 가까운 비수기 월 또는 인덱스 */
    private String nearestDeficitMonth;
    /** 마지막 입력월 기준 가장 가까운 비수기까지 남은 개월 수 */
    private Integer monthsUntilNearest;
    /** 가장 가까운 비수기를 대비해 미리 모아둘 권장 금액 (원) */
    private BigDecimal recommendedReserveAmount;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeficitMonthDetail {
        /** 월 식별자 (예: "2026-01" 또는 "Month 5") */
        private String monthIdentifier;
        /** 해당 월 소득 금액 (원) */
        private BigDecimal income;
        /** 기준 금액 대비 부족액 (원) */
        private BigDecimal shortfallAmount;
        /** 다시 돌아오기까지 남은 개월 수 (계산 가능 시) */
        private Integer monthsUntilNext;
    }
}

