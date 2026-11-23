package com.baeksuescape.assessment.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-251 N-13-3 내 위치 응답(RPT-05) — 내 대안 점수와, 같은 직군·같은 연령대·같은 직군+연령대 안에서의 내 위치.
 * 직군·연령대는 내 평가에 저장된 값(평가 시점)이고, modelVersion은 비교에 쓴 ACTIVE 모델이다.
 * groups는 항상 WORKER_TYPE, AGE_BAND, WORKER_TYPE_AGE 순서로 3개다.
 */
public record ScorePercentileResponse(
        int myScore,
        String workerTypeCode,
        String ageBandCode,
        String modelVersion,
        int minGroupSize,
        List<GroupPosition> groups) {

    /**
     * 집단 하나에서의 내 위치. memberCount는 본인을 포함한 집단 인원이다.
     * topPct = 상위 n%, avgScore = 집단 평균, diffFromAvg = 내 점수 − 평균(모두 소수 첫째 자리).
     * 인원이 minGroupSize보다 적으면 이 세 값은 null이다(화면은 표본 부족으로 안내한다).
     */
    public record GroupPosition(
            String groupType,
            int memberCount,
            BigDecimal topPct,
            BigDecimal avgScore,
            BigDecimal diffFromAvg) {
    }
}
