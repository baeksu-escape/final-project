package com.baeksuescape.assessment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FactorRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FeatureRow;
import com.baeksuescape.assessment.dto.AssessmentRows.GradeBandRow;
import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.service.DataInputUsers;

// FP-142 RPT-02·03 리포트, MEM-06 진단 내역 — 저장된 평가를 화면 모양으로 바꾸는 규칙(B팀 명세서 3-2~3-4).
@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    private static final long USER_ID = 7L;

    @Mock
    private AssessmentMapper mapper;
    @Mock
    private DataInputUsers users;

    private ReportService service;

    @BeforeEach
    void setUp() {
        service = new ReportService(mapper, users);
        lenient().when(users.toOffset(any())).thenAnswer(inv -> inv.getArgument(0) == null ? null
                : ((LocalDateTime) inv.getArgument(0)).atZone(ZoneId.of("Asia/Seoul")).toOffsetDateTime());
    }

    private static AssessmentRow scored(String requestId, int day, int trad, String tradGrade, int alt, String altGrade) {
        AssessmentRow row = new AssessmentRow();
        row.setAssessmentId((long) day);
        row.setRequestId(requestId);
        row.setUserId(USER_ID);
        row.setWorkerTypeCode("SELF_EMPLOYED");
        row.setModelVersion("DEV-DUMMY");
        row.setCutoffVersion("CUT-0.1");
        row.setGradeStatusCode("SCORED");
        row.setTradScorableYn("Y");
        row.setTradScore(trad);
        row.setTradGradeBandCode(tradGrade);
        row.setAltScorableYn("Y");
        row.setAltScore(alt);
        row.setAltGradeBandCode(altGrade);
        row.setShapBaseScore(639);
        row.setAssessedAt(LocalDateTime.of(2026, 11, day, 9, 0));
        return row;
    }

    private static AssessmentRow notScorable(String requestId, int day) {
        AssessmentRow row = new AssessmentRow();
        row.setRequestId(requestId);
        row.setUserId(USER_ID);
        row.setModelVersion("DEV-DUMMY");
        row.setGradeStatusCode("NOT_SCORABLE");
        row.setNotScorableReasonCode("MODEL_ERROR");
        row.setTradScorableYn("N");
        row.setAltScorableYn("N");
        row.setAssessedAt(LocalDateTime.of(2026, 11, day, 9, 0));
        return row;
    }

    @Test
    void latestWithoutAssessmentIs404() {
        assertThatThrownBy(() -> service.latest(USER_ID)).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(e.getCode()).isEqualTo("ASSESSMENT_NOT_FOUND");
        });
    }

    @Test
    void reportHasComparisonBandsAndFactorsWithNames() {
        when(mapper.selectLatest(USER_ID)).thenReturn(scored("a", 16, 612, "CAUTION", 701, "STANDARD"));
        GradeBandRow band = new GradeBandRow();
        band.setGradeBandCode("CAUTION");
        band.setMinScore(0);
        band.setMaxScore(664);
        when(mapper.selectGradeBands("CUT-0.1")).thenReturn(List.of(band));
        FactorRow factor = new FactorRow();
        factor.setFeatureRank(1);
        factor.setFeatureCode("telecom_on_time_streak");
        factor.setFeatureName("통신비 정시 납부 기간");
        factor.setUnitName("개월");
        factor.setFeatureValue("12");
        factor.setShapScore(31);
        factor.setAlternativeYn("Y");
        factor.setSimulatableYn("Y");
        when(mapper.selectFactors(16L)).thenReturn(List.of(factor));

        ReportDtos.Report report = service.latest(USER_ID);

        assertThat(report.comparison().scoreDiff()).isEqualTo(89);
        assertThat(report.comparison().gradeChanged()).isTrue();
        assertThat(report.gradeBands().bands()).hasSize(1);
        assertThat(report.shap().factors().get(0).featureName()).isEqualTo("통신비 정시 납부 기간");
        assertThat(report.shap().baseScore()).isEqualTo(639);
    }

    @Test
    void notScorableReportHasNoShapAndNoComparison() {
        when(mapper.selectLatest(USER_ID)).thenReturn(notScorable("b", 16));

        ReportDtos.Report report = service.latest(USER_ID);

        assertThat(report.gradeStatusCode()).isEqualTo("NOT_SCORABLE");
        assertThat(report.shap()).isNull();
        assertThat(report.comparison().scoreDiff()).isNull();
        verify(mapper, never()).selectFactors(any(Long.class));
    }

    private static FeatureRow feature(String code, String name, String alternativeYn) {
        FeatureRow row = new FeatureRow();
        row.setFeatureCode(code);
        row.setFeatureName(name);
        row.setAlternativeYn(alternativeYn);
        return row;
    }

    @Test
    void modelFeaturesSplitTraditionalAndAlternative() {
        // N-12-6: 기존 모델 = 대안 데이터가 아닌 피처, 대안 모델 = 전체 (DIM_FEATURE 순서 그대로)
        AssessmentRow row = scored("a", 16, 612, "CAUTION", 701, "STANDARD");
        row.setFeatureSetVersion("FS-DRAFT");
        when(mapper.selectLatest(USER_ID)).thenReturn(row);
        when(mapper.selectModelFeatures("FS-DRAFT", "DEV-DUMMY")).thenReturn(List.of(
                feature("income_svc_12m_krw", "최근 12개월 소득 합계", "N"),
                feature("telecom_on_time_streak", "통신비 정시 납부 기간", "Y"),
                feature("DQ1200001", "최근 1년 연체 횟수", "N")));

        ReportDtos.ModelFeatures features = service.latest(USER_ID).modelFeatures();

        assertThat(features.alternative()).extracting(ReportDtos.ModelFeature::featureCode)
                .containsExactly("income_svc_12m_krw", "telecom_on_time_streak", "DQ1200001");
        assertThat(features.traditional()).extracting(ReportDtos.ModelFeature::featureCode)
                .containsExactly("income_svc_12m_krw", "DQ1200001");
        assertThat(features.traditional().get(0).name()).isEqualTo("최근 12개월 소득 합계");
    }

    @Test
    void notScorableReportStillHasModelFeaturesByModelVersion() {
        // 산출 불가 평가는 FEATURE_SET_VERSION이 없다 → 모델 버전으로 피처 세트를 찾는다(SQL의 NVL)
        when(mapper.selectLatest(USER_ID)).thenReturn(notScorable("b", 16));
        when(mapper.selectModelFeatures(null, "DEV-DUMMY")).thenReturn(List.of(feature("income_svc_12m_krw", "최근 12개월 소득 합계", "N")));

        ReportDtos.ModelFeatures features = service.latest(USER_ID).modelFeatures();

        assertThat(features.traditional()).hasSize(1);
        assertThat(features.alternative()).hasSize(1);
    }

    @Test
    void noFeatureDictionaryMeansNullModelFeatures() {
        // 피처 사전을 찾지 못하면 null — 화면이 칩 영역을 숨긴다
        when(mapper.selectLatest(USER_ID)).thenReturn(notScorable("b", 16));
        when(mapper.selectModelFeatures(null, "DEV-DUMMY")).thenReturn(List.of());

        assertThat(service.latest(USER_ID).modelFeatures()).isNull();
    }

    @Test
    void otherUsersRequestIdIs404AndBadFormatIs400() {
        String requestId = "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c";
        assertThatThrownBy(() -> service.byRequestId(USER_ID, requestId))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> service.byRequestId(USER_ID, "123"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void diagnosesNewestFirstWithChangeFromPreviousScored() {
        // DB는 최신순으로 준다: 16일(SCORED 720) → 15일(산출 불가) → 14일(SCORED 700) → 13일(SCORED 690)
        when(mapper.selectHistory(USER_ID)).thenReturn(List.of(
                scored("d16", 16, 650, "CAUTION", 720, "STANDARD"),
                notScorable("d15", 15),
                scored("d14", 14, 640, "CAUTION", 700, "STANDARD"),
                scored("d13", 13, 630, "CAUTION", 690, "STANDARD")));

        List<ReportDtos.Diagnosis> items = service.diagnoses(USER_ID).items();

        assertThat(items).extracting(ReportDtos.Diagnosis::diagnosisId).containsExactly("d16", "d15", "d14", "d13");
        assertThat(items.get(0).alternativeScoreChange()).isEqualTo(20);   // 720 − 700 (산출 불가는 건너뜀)
        assertThat(items.get(1).alternativeScoreChange()).isNull();
        assertThat(items.get(1).grade()).isNull();
        assertThat(items.get(2).alternativeScoreChange()).isEqualTo(10);
        assertThat(items.get(3).alternativeScoreChange()).isNull();        // 첫 평가
        assertThat(items.get(0).grade()).isEqualTo("STANDARD");
        assertThat(items.get(0).jobType()).isEqualTo("SELF_EMPLOYED");
    }
}
