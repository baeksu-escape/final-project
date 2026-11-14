package com.baeksuescape.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

// N-12-6·N-14-4 저장된 점수 비교와 SHAP를 전달한다. 미산출 값은 NULL을 유지한다.
@Getter
@Setter
public class ReportResponse {
    private String requestId;
    // N-12-1 시간대 없는 저장 시각이다. 시간대·오프셋 변환 계약은 미정이며 임의로 보정하지 않는다.
    private LocalDateTime assessedAt;
    private String inputBaseMonth;
    private String workerTypeCode;
    private String gradeStatusCode;
    private String notScorableReasonCode;
    private ModelResult traditional;
    private ModelResult alternative;
    private Comparison comparison;
    private GradeBands gradeBands;
    private Shap shap;
    private String aiSummary;
    private String modelVersion;

    // N-12-6 한 모델의 저장된 산출 결과다.
    public record ModelResult(String scorableYn, Integer score, String gradeBandCode, BigDecimal defaultProb) {}
    // N-12-3 점수 차이는 대안-기존이며 음수도 보존한다. 비교에 필요한 값이 없으면 NULL이다.
    public record Comparison(Integer scoreDiff, Boolean gradeChanged) {}
    // N-12-6 평가 당시 등급 경계를 묶는다.
    public record GradeBands(String cutoffVersion, List<GradeBand> bands) {}
    // N-14-4 저장된 기준점과 전체 영향도 목록이다. 표시 개수는 여기서 제한하지 않는다.
    public record Shap(Integer baseScore, List<Factor> factors) {}

    // N-12-6 등급 경계 조회 값이다.
    @Getter
    @Setter
    public static class GradeBand {
        private String gradeBandCode;
        private Integer minScore;
        private Integer maxScore;
    }

    // N-14-1 평가 버전의 피처 사전과 연결한 영향도 조회 값이다.
    @Getter
    @Setter
    public static class Factor {
        private Integer rank;
        private String featureCode;
        private String featureName;
        private String unitName;
        private String featureValue;
        private Integer shapScore;
        private String alternativeYn;
        private String simulatableYn;
    }
}
