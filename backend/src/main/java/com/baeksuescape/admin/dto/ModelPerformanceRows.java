package com.baeksuescape.admin.dto;

import java.math.BigDecimal;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// N-25 모형 성능 비교에 쓰는 DB 행 — MODEL_EVAL_SAMPLE(DDL C10)·MODEL_ARTIFACT.METRICS_JSON에서 MyBatis가 채운다.
public final class ModelPerformanceRows {

    private ModelPerformanceRows() {
    }

    // MODEL_EVAL_SAMPLE 한 행 (계산에 쓰는 열만). 점수는 0~1000(높을수록 좋음), 라벨은 1이 불량이다.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class EvalSampleRow {
        private String splitCode;
        private String workerTypeCode;
        private Integer labelAnyDelinquency12m;
        private Integer labelNonfinEffect12m;
        private Integer scoreLegacyDelinq;
        private Integer scoreAltDelinq;
        private Integer scoreLegacyNonfin;
        private Integer scoreAltNonfin;
    }

    // METRICS_JSON same_label_comparison의 5개 시드 평균 AUC (라벨 하나의 기존·대안). 값이 없으면 null
    @Getter
    @Setter
    @NoArgsConstructor
    public static class SeedMeanAucRow {
        private BigDecimal legacyAuc;
        private BigDecimal alternativeAuc;
    }
}
