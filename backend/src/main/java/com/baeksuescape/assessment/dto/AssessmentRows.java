package com.baeksuescape.assessment.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// FP-142 N-12-2·N-14 평가 표(ASSESSMENT·ASSESSMENT_FACTOR·SCORE_GRADE_BAND)와 1:1로 맞는 행 — MyBatis가 채운다.
public final class AssessmentRows {

    private AssessmentRows() {
    }

    // ASSESSMENT 한 행. 서비스 회원 평가만 다루므로 DATASET_CODE는 SQL에서 'SERVICE'로 고정한다.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class AssessmentRow {
        private Long assessmentId;
        private String requestId;
        private Long userId;
        private String workerTypeCode;
        private String ageBandCode;
        private String inputBaseMonth;
        private String modelVersion;
        private String featureSetVersion;
        private String cutoffVersion;
        private String gradeStatusCode;
        private String notScorableReasonCode;
        private String tradScorableYn;
        private Integer tradScore;
        private String tradGradeBandCode;
        private BigDecimal tradDefaultProb;
        private String altScorableYn;
        private Integer altScore;
        private String altGradeBandCode;
        private BigDecimal altDefaultProb;
        private Integer shapBaseScore;
        private String featureSnapshot;   // JSON 문자열 (CLOB IS JSON) — 저장만 하고 회원 화면 응답에는 넣지 않는다
        private String aiSummary;         // N-31 AI 요약 (생성은 RPT-04, 없으면 null)
        private LocalDateTime assessedAt;
    }

    // ASSESSMENT_FACTOR 한 행 + 조회할 때 DIM_FEATURE에서 조인해 오는 이름·단위·대안·시뮬 여부.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class FactorRow {
        private Long assessmentId;
        private String featureSetVersion;
        private Integer featureRank;
        private String featureCode;
        private String featureValue;
        private BigDecimal shapValue;
        private Integer shapScore;
        private String featureName;
        private String unitName;
        private String alternativeYn;
        private String simulatableYn;
    }

    // N-12-6 모델별 피처 칩 — DIM_FEATURE 한 행(코드·이름·대안 여부).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class FeatureRow {
        private String featureCode;
        private String featureName;
        private String alternativeYn;
    }

    // SCORE_GRADE_BAND 한 행 (리포트 게이지 눈금).
    @Getter
    @Setter
    @NoArgsConstructor
    public static class GradeBandRow {
        private String gradeBandCode;
        private Integer minScore;
        private Integer maxScore;
    }
}
