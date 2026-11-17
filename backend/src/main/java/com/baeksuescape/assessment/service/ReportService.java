package com.baeksuescape.assessment.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.service.DataInputUsers;

// FP-142 RPT-02 N-12 나의 신용 리포트, RPT-03 N-04-6 진단 내역 상세, MEM-06 N-04-6 진단 내역 목록 — 저장된 평가를 읽기만 한다.
@Service
@Transactional(readOnly = true)
public class ReportService {

    private final AssessmentMapper mapper;
    private final DataInputUsers users;

    public ReportService(AssessmentMapper mapper, DataInputUsers users) {
        this.mapper = mapper;
        this.users = users;
    }

    // RPT-02 내 가장 최근 평가. 하나도 없으면 404 — 화면은 "점수 산출하기" 안내를 보여 준다.
    public ReportDtos.Report latest(long userId) {
        return toReport(found(mapper.selectLatest(userId)));
    }

    // RPT-03 내 평가 한 건. 남의 평가도 404로 답한다(403이면 남의 평가가 있다는 사실이 드러난다).
    public ReportDtos.Report byRequestId(long userId, String requestId) {
        if (requestId == null || !ScoreCalculationService.REQUEST_ID.matcher(requestId).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.",
                    List.of(new FieldErrorItem("requestId", "요청 번호는 소문자 UUID여야 합니다.")));
        }
        return toReport(found(mapper.selectByUserAndRequestId(userId, requestId)));
    }

    // MEM-06 최신순. 변화 = 바로 앞(더 오래된) SCORED 평가 대비 대안 점수 차이. 첫 SCORED와 산출 불가 행은 null.
    public ReportDtos.DiagnosisList diagnoses(long userId) {
        List<AssessmentRow> newestFirst = mapper.selectHistory(userId);
        List<AssessmentRow> oldestFirst = new ArrayList<>(newestFirst);
        Collections.reverse(oldestFirst);
        List<ReportDtos.Diagnosis> items = new ArrayList<>();
        Integer previousScore = null;
        for (AssessmentRow row : oldestFirst) {
            boolean scored = ScoreCalculationService.SCORED.equals(row.getGradeStatusCode());
            Integer change = scored && previousScore != null ? row.getAltScore() - previousScore : null;
            items.add(new ReportDtos.Diagnosis(row.getRequestId(), users.toOffset(row.getAssessedAt()), row.getWorkerTypeCode(),
                    row.getTradScore(), row.getAltScore(), scored ? row.getAltGradeBandCode() : null, change, row.getModelVersion(),
                    row.getGradeStatusCode(), row.getNotScorableReasonCode()));
            if (scored) {
                previousScore = row.getAltScore();
            }
        }
        Collections.reverse(items);
        return new ReportDtos.DiagnosisList(items);
    }

    private static AssessmentRow found(AssessmentRow row) {
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다.");
        }
        return row;
    }

    private ReportDtos.Report toReport(AssessmentRow row) {
        ReportDtos.ModelScore traditional = new ReportDtos.ModelScore(row.getTradScorableYn(), row.getTradScore(),
                row.getTradGradeBandCode(), row.getTradDefaultProb());
        ReportDtos.ModelScore alternative = new ReportDtos.ModelScore(row.getAltScorableYn(), row.getAltScore(),
                row.getAltGradeBandCode(), row.getAltDefaultProb());
        boolean both = row.getTradScore() != null && row.getAltScore() != null;
        ReportDtos.Comparison comparison = new ReportDtos.Comparison(both ? row.getAltScore() - row.getTradScore() : null,
                both ? !Objects.equals(row.getTradGradeBandCode(), row.getAltGradeBandCode()) : null);

        ReportDtos.GradeBands gradeBands = null;
        if (row.getCutoffVersion() != null) {
            gradeBands = new ReportDtos.GradeBands(row.getCutoffVersion(), mapper.selectGradeBands(row.getCutoffVersion()).stream()
                    .map(b -> new ReportDtos.GradeBand(b.getGradeBandCode(), b.getMinScore(), b.getMaxScore())).toList());
        }
        ReportDtos.Shap shap = null;
        if (ScoreCalculationService.SCORED.equals(row.getGradeStatusCode())) {
            shap = new ReportDtos.Shap(row.getShapBaseScore(), mapper.selectFactors(row.getAssessmentId()).stream()
                    .map(f -> new ReportDtos.Factor(f.getFeatureRank(), f.getFeatureCode(), f.getFeatureName(), f.getUnitName(),
                            f.getFeatureValue(), f.getShapScore(), f.getAlternativeYn(), f.getSimulatableYn()))
                    .toList());
        }
        return new ReportDtos.Report(row.getRequestId(), users.toOffset(row.getAssessedAt()), row.getInputBaseMonth(),
                row.getWorkerTypeCode(), row.getGradeStatusCode(), row.getNotScorableReasonCode(), traditional, alternative,
                comparison, gradeBands, shap, row.getAiSummary(), row.getModelVersion(), modelFeatures(row));
    }

    // N-12-6 모델별 피처 칩 — 대안 모델은 피처 사전 전체, 기존 모델은 그중 대안 데이터가 아닌 것(ALTERNATIVE_YN = N).
    // 산출 불가 평가도 "이 모델이 보는 피처"는 같으므로 모델 버전의 피처 세트로 보여 준다. 사전이 없으면 null(화면이 칩을 숨긴다).
    private ReportDtos.ModelFeatures modelFeatures(AssessmentRow row) {
        List<ReportDtos.ModelFeature> all = mapper.selectModelFeatures(row.getFeatureSetVersion(), row.getModelVersion()).stream()
                .map(f -> new ReportDtos.ModelFeature(f.getFeatureCode(), f.getFeatureName(), f.getAlternativeYn()))
                .toList();
        if (all.isEmpty()) {
            return null;
        }
        List<ReportDtos.ModelFeature> traditional = all.stream().filter(f -> "N".equals(f.alternativeYn())).toList();
        return new ReportDtos.ModelFeatures(traditional, all);
    }
}
