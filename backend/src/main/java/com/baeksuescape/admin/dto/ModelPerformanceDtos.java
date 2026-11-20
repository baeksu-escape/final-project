package com.baeksuescape.admin.dto;

import java.util.List;

// N-25 모형 성능 비교 응답 (ADM-01·02). 비율·ROC 좌표는 % 소수 둘째 자리, AUC는 0~1 확률이다(API README 3장, 정의서 1장).
public final class ModelPerformanceDtos {

    private ModelPerformanceDtos() {
    }

    // N-25-2 모형 하나의 지표 6개. misclassCost는 (우량 거절 + 부도 승인 × 5) / 전체 인원인 1인당 상대값이다.
    public record ModelMetrics(String modelVersion, double auc, double accuracy, double misclassCost, double goodRejectRate,
            double badApproveRate, double approvalRate) {
    }

    // N-25-4 직군 하나의 우량 고객 오거절률(기존·대안). 직군별은 불량 수가 적어 표본·불량 수를 함께 준다.
    public record JobReject(String jobType, int sampleCount, int badCount, double legacyGoodRejectRate, double alternativeGoodRejectRate) {
    }

    // ADM-01 컷오프 기준 지표 비교 — sampleBasis: VALID|TRAIN_VALID, aucBasis: SEED_MEAN_5|SINGLE_SEED
    public record PerformanceView(String group, String label, int cutoff, String sampleBasis, int sampleCount, int badCount,
            String aucBasis, ModelMetrics legacy, ModelMetrics alternative, List<JobReject> byJob) {
    }

    // ROC 곡선의 점 하나 — fpr: 우량 고객 거절률(%), tpr: 불량 고객 거절률(%)
    public record RocPoint(double fpr, double tpr) {
    }

    public record RocCurve(List<RocPoint> points) {
    }

    // ADM-02 ROC 곡선 — 컷오프와 무관하게 집단·라벨만 받는다
    public record RocView(String group, String label, RocCurve legacy, RocCurve alternative) {
    }
}
