package com.baeksuescape.assessment.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

// FP-142 RPT-02·03 N-12 나의 신용 리포트·N-14 영역별 영향도, MEM-06 N-04-6 진단 내역 응답 (B팀 명세서 3-2~3-4).
// 넣지 않는 것: ASSESSMENT_ID, FEATURE_SNAPSHOT(개인 금융정보), SHAP_VALUE(원래 SHAP 값).
public final class ReportDtos {

    private ReportDtos() {
    }

    // RPT-02·03 리포트 한 건
    public record Report(String requestId, OffsetDateTime assessedAt, String inputBaseMonth, String workerTypeCode,
            String gradeStatusCode, String notScorableReasonCode, ModelScore traditional, ModelScore alternative,
            Comparison comparison, GradeBands gradeBands, Shap shap, String aiSummary, String modelVersion) {
    }

    // 모델 하나의 점수. 산정 불가면 scorableYn "N"이고 나머지 null.
    public record ModelScore(String scorableYn, Integer score, String gradeBandCode, BigDecimal defaultProb) {
    }

    // N-12-3 대안 − 기존. 한쪽이 없으면 둘 다 null.
    public record Comparison(Integer scoreDiff, Boolean gradeChanged) {
    }

    // 그 평가의 등급 구간 (과거 평가도 그때의 구간으로 그린다)
    public record GradeBands(String cutoffVersion, List<GradeBand> bands) {
    }

    public record GradeBand(String gradeBandCode, Integer minScore, Integer maxScore) {
    }

    public record Shap(Integer baseScore, List<Factor> factors) {
    }

    // SHAP 요인 하나 — 화면에는 shapScore(점수 단위 증감)만 보낸다. "작용한 정도"로만 표시한다(원인처럼 설명하지 않는다).
    public record Factor(Integer rank, String featureCode, String featureName, String unitName, String featureValue,
            Integer shapScore, String alternativeYn, String simulatableYn) {
    }

    // MEM-06 진단 내역 목록 — 화면 mock(diagnosisHistoryMockHandlers.js)과 같은 필드 이름
    public record DiagnosisList(List<Diagnosis> items) {
    }

    public record Diagnosis(String diagnosisId, OffsetDateTime calculatedAt, String jobType, Integer existingScore,
            Integer alternativeScore, String grade, Integer alternativeScoreChange, String modelVersion,
            String gradeStatusCode, String notScorableReasonCode) {
    }
}
