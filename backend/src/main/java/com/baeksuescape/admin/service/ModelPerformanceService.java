package com.baeksuescape.admin.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.baeksuescape.admin.dto.ModelPerformanceDtos.JobReject;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.ModelMetrics;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.PerformanceView;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocCurve;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocPoint;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocView;
import com.baeksuescape.admin.dto.ModelPerformanceRows.EvalSampleRow;
import com.baeksuescape.admin.dto.ModelPerformanceRows.SeedMeanAucRow;
import com.baeksuescape.admin.mapper.ModelPerformanceMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

// N-25 모형 성능 비교 (ADM-01·02, FP-184) — ACTIVE 모델의 평가 표본(MODEL_EVAL_SAMPLE)으로 컷오프별 지표·ROC·직군별 오거절률을 계산한다.
// 합성 학습 데이터의 평가 결과라 실제 신용평가가 아니며, 대안 모형이 나쁜 지표도 그대로 돌려준다.
@Service
public class ModelPerformanceService {

    public static final Set<String> GROUPS = Set.of("LEGACY", "THINFILE");
    public static final Set<String> LABELS = Set.of("DELINQ", "NONFIN");
    public static final int CUTOFF_MIN = 600;
    public static final int CUTOFF_MAX = 800;
    // 오분류 비용에서 부도 고객 오승인 1건을 우량 고객 오거절 몇 건으로 보는지 (decisions.md N-25)
    static final int BAD_APPROVE_WEIGHT = 5;
    // ROC 곡선을 그릴 때 기준 점수를 움직이는 간격
    static final int ROC_STEP = 10;
    static final int SCORE_MAX = 1000;

    private final ModelPerformanceMapper mapper;

    public ModelPerformanceService(ModelPerformanceMapper mapper) {
        this.mapper = mapper;
    }

    // N-25-1·2·4 ADM-01 — 컷오프 하나에서 기존·대안 지표 6개와 직군별 우량 고객 오거절률
    public PerformanceView performance(String group, String label, int cutoff) {
        validate(group, label, cutoff);
        String modelVersion = activeModelVersion();
        List<EvalSampleRow> rows = samples(modelVersion, group);
        boolean delinq = "DELINQ".equals(label);
        int[] legacyScores = scores(rows, delinq, true);
        int[] altScores = scores(rows, delinq, false);
        boolean[] bad = badFlags(rows, delinq);

        // AUC는 기존 집단이면 5개 시드 평균(METRICS_JSON), 씬파일이거나 평균이 없으면 이 표본(시드 1개)으로 계산한다
        SeedMeanAucRow seedMean = "LEGACY".equals(group) ? mapper.selectSeedMeanAuc(modelVersion, label) : null;
        boolean useSeedMean = false;
        double legacyAuc;
        double altAuc;
        if (seedMean != null && seedMean.getLegacyAuc() != null && seedMean.getAlternativeAuc() != null) {
            useSeedMean = true;
            legacyAuc = round4(seedMean.getLegacyAuc().doubleValue());
            altAuc = round4(seedMean.getAlternativeAuc().doubleValue());
        } else {
            legacyAuc = auc(legacyScores, bad);
            altAuc = auc(altScores, bad);
        }

        boolean hasTrain = rows.stream().anyMatch(r -> "TRAIN".equals(r.getSplitCode()));
        return new PerformanceView(group, label, cutoff, hasTrain ? "TRAIN_VALID" : "VALID", rows.size(), count(bad),
                useSeedMean ? "SEED_MEAN_5" : "SINGLE_SEED",
                metrics(modelVersion, legacyAuc, legacyScores, bad, cutoff),
                metrics(modelVersion, altAuc, altScores, bad, cutoff),
                byJob(rows, legacyScores, altScores, bad, cutoff));
    }

    // N-25-3 ADM-02 — 기존·대안 모형의 ROC 곡선 점
    public RocView roc(String group, String label) {
        validate(group, label, CUTOFF_MIN);
        String modelVersion = activeModelVersion();
        List<EvalSampleRow> rows = samples(modelVersion, group);
        boolean delinq = "DELINQ".equals(label);
        boolean[] bad = badFlags(rows, delinq);
        return new RocView(group, label, new RocCurve(rocPoints(scores(rows, delinq, true), bad)),
                new RocCurve(rocPoints(scores(rows, delinq, false), bad)));
    }

    // 쿼리 값 검사 — 틀린 칸을 모두 모아 400 INVALID_INPUT(field = 쿼리 이름)
    private void validate(String group, String label, int cutoff) {
        List<FieldErrorItem> errors = new ArrayList<>();
        if (!GROUPS.contains(group)) errors.add(new FieldErrorItem("group", "고객 집단 값이 올바르지 않습니다."));
        if (!LABELS.contains(label)) errors.add(new FieldErrorItem("label", "비교 라벨 값이 올바르지 않습니다."));
        if (cutoff < CUTOFF_MIN || cutoff > CUTOFF_MAX) {
            errors.add(new FieldErrorItem("cutoff", "컷오프는 " + CUTOFF_MIN + "~" + CUTOFF_MAX + "점 사이로 넣어 주세요."));
        }
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", errors.get(0).message(), errors);
    }

    // 비교할 모델 = MODEL_REGISTRY ACTIVE (B팀 명세서 ML-03 "DB의 ACTIVE가 스위치"). 없으면 409
    private String activeModelVersion() {
        String modelVersion = mapper.selectActiveModelVersion();
        if (modelVersion == null) {
            throw new ApiException(HttpStatus.CONFLICT, "MODEL_EVAL_NOT_READY", "지금 사용 중인 모델이 없어 성능을 비교할 수 없습니다.");
        }
        return modelVersion;
    }

    // ACTIVE 모델의 평가 표본. 아직 적재하지 않았으면 409 (지금 상태로는 처리할 수 없음)
    private List<EvalSampleRow> samples(String modelVersion, String group) {
        List<EvalSampleRow> rows = mapper.selectEvalSamples(modelVersion, group);
        if (rows == null || rows.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "MODEL_EVAL_NOT_READY",
                    "지금 사용 중인 모델(" + modelVersion + ")의 평가 표본이 아직 준비되지 않았습니다.");
        }
        return rows;
    }

    // 라벨·모형에 맞는 점수 열 — 같은 라벨로 학습한 기존·대안 점수끼리 비교한다(피처 정의서 C20)
    private static int[] scores(List<EvalSampleRow> rows, boolean delinq, boolean legacy) {
        return rows.stream().mapToInt(r -> delinq ? (legacy ? r.getScoreLegacyDelinq() : r.getScoreAltDelinq())
                : (legacy ? r.getScoreLegacyNonfin() : r.getScoreAltNonfin())).toArray();
    }

    private static boolean[] badFlags(List<EvalSampleRow> rows, boolean delinq) {
        boolean[] bad = new boolean[rows.size()];
        for (int i = 0; i < bad.length; i++) {
            Integer value = delinq ? rows.get(i).getLabelAnyDelinquency12m() : rows.get(i).getLabelNonfinEffect12m();
            bad[i] = value != null && value == 1;
        }
        return bad;
    }

    // N-25-2 지표 6개 — 점수 ≥ 컷오프면 승인, 미만이면 거절(부도로 예측)
    static ModelMetrics metrics(String modelVersion, double auc, int[] scores, boolean[] bad, int cutoff) {
        int n = scores.length;
        int goodTotal = 0, badTotal = 0, goodReject = 0, badApprove = 0;
        for (int i = 0; i < n; i++) {
            boolean approve = scores[i] >= cutoff;
            if (bad[i]) {
                badTotal++;
                if (approve) badApprove++;
            } else {
                goodTotal++;
                if (!approve) goodReject++;
            }
        }
        int approved = (goodTotal - goodReject) + badApprove;
        int correct = (goodTotal - goodReject) + (badTotal - badApprove);
        double cost = n == 0 ? 0 : round4((goodReject + BAD_APPROVE_WEIGHT * (double) badApprove) / n);
        return new ModelMetrics(modelVersion, auc, percent(correct, n), cost, percent(goodReject, goodTotal), percent(badApprove, badTotal),
                percent(approved, n));
    }

    // N-25-4 직군별 우량 고객 오거절률 — 표본이 직군 표시 순서로 와서 처음 나온 순서를 그대로 쓴다
    static List<JobReject> byJob(List<EvalSampleRow> rows, int[] legacyScores, int[] altScores, boolean[] bad, int cutoff) {
        Map<String, List<Integer>> indexByJob = new LinkedHashMap<>();
        for (int i = 0; i < rows.size(); i++) {
            indexByJob.computeIfAbsent(rows.get(i).getWorkerTypeCode(), key -> new ArrayList<>()).add(i);
        }
        List<JobReject> result = new ArrayList<>();
        indexByJob.forEach((jobType, indexes) -> {
            int goodTotal = 0, badCount = 0, legacyReject = 0, altReject = 0;
            for (int i : indexes) {
                if (bad[i]) {
                    badCount++;
                    continue;
                }
                goodTotal++;
                if (legacyScores[i] < cutoff) legacyReject++;
                if (altScores[i] < cutoff) altReject++;
            }
            result.add(new JobReject(jobType, indexes.size(), badCount, percent(legacyReject, goodTotal), percent(altReject, goodTotal)));
        });
        return result;
    }

    // ROC-AUC — 불량 고객과 우량 고객을 한 명씩 골랐을 때 불량 쪽 점수가 더 낮을 확률(같으면 0.5). 0~1, 소수 넷째 자리
    static double auc(int[] scores, boolean[] bad) {
        double wins = 0;
        long pairs = 0;
        for (int i = 0; i < scores.length; i++) {
            if (!bad[i]) continue;
            for (int j = 0; j < scores.length; j++) {
                if (bad[j]) continue;
                pairs++;
                if (scores[i] < scores[j]) wins += 1;
                else if (scores[i] == scores[j]) wins += 0.5;
            }
        }
        return pairs == 0 ? 0 : round4(wins / pairs);
    }

    // ROC 점 — 기준 점수 t를 0부터 10점씩 올리며 '점수 < t면 거절'로 볼 때의 (우량 거절률, 불량 거절률). (0,0)에서 (100,100)까지
    static List<RocPoint> rocPoints(int[] scores, boolean[] bad) {
        int badTotal = count(bad);
        int goodTotal = scores.length - badTotal;
        List<RocPoint> points = new ArrayList<>();
        for (int t = 0; t <= SCORE_MAX + ROC_STEP; t += ROC_STEP) {
            int goodReject = 0, badReject = 0;
            for (int i = 0; i < scores.length; i++) {
                if (scores[i] >= t) continue;
                if (bad[i]) badReject++;
                else goodReject++;
            }
            points.add(new RocPoint(percent(goodReject, goodTotal), percent(badReject, badTotal)));
        }
        return points;
    }

    private static int count(boolean[] flags) {
        int n = 0;
        for (boolean flag : flags) if (flag) n++;
        return n;
    }

    // 비율을 % 소수 둘째 자리로 (분모 0이면 0)
    static double percent(int part, int whole) {
        return whole == 0 ? 0 : Math.round(part * 10000.0 / whole) / 100.0;
    }

    private static double round4(double value) {
        return Math.round(value * 10000) / 10000.0;
    }
}
