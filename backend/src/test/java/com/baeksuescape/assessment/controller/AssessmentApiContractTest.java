package com.baeksuescape.assessment.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.dto.ScoreDtos;
import com.baeksuescape.assessment.service.ReportService;
import com.baeksuescape.assessment.service.ScoreCalculationService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-142 RPT-01·02·03, MEM-06 API 계약 — 경로·로그인·상태 코드·JSON 키가 화면 mock·B팀 명세서와 같은지 본다.
// 서비스는 가짜로 대신하고, 보안 필터·오류 처리는 실제로 탄다(기존 DataInputApiContractTest와 같은 방식).
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AssessmentApiContractTest {

    private static final String REQUEST_ID = "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c";
    private static final OffsetDateTime AT = OffsetDateTime.parse("2026-11-16T10:00:00+09:00");

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private ScoreCalculationService scoreCalculationService;
    @MockBean
    private ReportService reportService;

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"));
    }

    @Test
    void allFourPathsNeedLogin() throws Exception {
        mvc.perform(post("/api/members/me/score-calculation")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/report/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/report/" + REQUEST_ID)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/members/me/diagnoses")).andExpect(status().isUnauthorized());
    }

    @Test
    void scoreCalculationReturnsScreenShape() throws Exception {
        given(scoreCalculationService.calculate(7L, REQUEST_ID)).willReturn(new ScoreDtos.ScoreResponse(AT, REQUEST_ID, "SCORED", null,
                new ScoreDtos.AlternativeResult(742, "STANDARD"), new ScoreDtos.TraditionalResult("Y", 655, "CAUTION")));

        mvc.perform(asUser(post("/api/members/me/score-calculation")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":\"" + REQUEST_ID + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculatedAt").exists())
                .andExpect(jsonPath("$.requestId").value(REQUEST_ID))
                .andExpect(jsonPath("$.gradeStatusCode").value("SCORED"))
                .andExpect(jsonPath("$.notScorableReasonCode").value((Object) null))
                .andExpect(jsonPath("$.alternative.score").value(742))
                .andExpect(jsonPath("$.alternative.gradeBandCode").value("STANDARD"))
                .andExpect(jsonPath("$.traditional.scorableYn").value("Y"));
    }

    @Test
    void incompleteInputIs409WithCode() throws Exception {
        given(scoreCalculationService.calculate(7L, REQUEST_ID))
                .willThrow(new ApiException(HttpStatus.CONFLICT, "INPUT_INCOMPLETE", "입력 완료 현황 6개 항목을 모두 채워 주세요."));

        mvc.perform(asUser(post("/api/members/me/score-calculation")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":\"" + REQUEST_ID + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INPUT_INCOMPLETE"));
    }

    @Test
    void reportNotFoundIs404WithCode() throws Exception {
        given(reportService.latest(7L)).willThrow(new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다."));

        mvc.perform(asUser(get("/api/report/me")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ASSESSMENT_NOT_FOUND"));
    }

    @Test
    void reportHidesInternalFields() throws Exception {
        ReportDtos.Report report = new ReportDtos.Report(REQUEST_ID, AT, "2026-10", "SELF_EMPLOYED", "SCORED", null,
                new ReportDtos.ModelScore("Y", 612, "CAUTION", null), new ReportDtos.ModelScore("Y", 701, "STANDARD", null),
                new ReportDtos.Comparison(89, true),
                new ReportDtos.GradeBands("CUT-0.1", List.of(new ReportDtos.GradeBand("CAUTION", 0, 664))),
                new ReportDtos.Shap(639, List.of(new ReportDtos.Factor(1, "telecom_on_time_streak", "통신비 정시 납부 기간", "개월", "12", 31,
                        "Y", "Y"))),
                null, "DEV-DUMMY",
                new ReportDtos.ModelFeatures(List.of(new ReportDtos.ModelFeature("DQ1200001", "최근 1년 연체 횟수", "N")),
                        List.of(new ReportDtos.ModelFeature("DQ1200001", "최근 1년 연체 횟수", "N"),
                                new ReportDtos.ModelFeature("telecom_on_time_streak", "통신비 정시 납부 기간", "Y"))));
        given(reportService.byRequestId(7L, REQUEST_ID)).willReturn(report);

        mvc.perform(asUser(get("/api/report/" + REQUEST_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shap.factors[0].featureName").value("통신비 정시 납부 기간"))
                .andExpect(jsonPath("$.shap.factors[0].shapValue").doesNotExist())
                .andExpect(jsonPath("$.assessmentId").doesNotExist())
                .andExpect(jsonPath("$.featureSnapshot").doesNotExist())
                .andExpect(jsonPath("$.gradeBands.bands[0].maxScore").value(664))
                // N-12-6 화면(ScoreComparisonCard)이 읽는 필드 이름
                .andExpect(jsonPath("$.modelFeatures.traditional[0].featureCode").value("DQ1200001"))
                .andExpect(jsonPath("$.modelFeatures.alternative[1].name").value("통신비 정시 납부 기간"))
                .andExpect(jsonPath("$.modelFeatures.alternative[1].alternativeYn").value("Y"));
    }

    @Test
    void diagnosesUseMockFieldNames() throws Exception {
        given(reportService.diagnoses(7L)).willReturn(new ReportDtos.DiagnosisList(List.of(new ReportDtos.Diagnosis(REQUEST_ID, AT,
                "SELF_EMPLOYED", 655, 742, "STANDARD", 12, "DEV-DUMMY", "SCORED", null))));

        mvc.perform(asUser(get("/api/members/me/diagnoses")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].diagnosisId").value(REQUEST_ID))
                .andExpect(jsonPath("$.items[0].jobType").value("SELF_EMPLOYED"))
                .andExpect(jsonPath("$.items[0].existingScore").value(655))
                .andExpect(jsonPath("$.items[0].alternativeScore").value(742))
                .andExpect(jsonPath("$.items[0].grade").value("STANDARD"))
                .andExpect(jsonPath("$.items[0].alternativeScoreChange").value(12))
                .andExpect(jsonPath("$.items[0].modelVersion").value("DEV-DUMMY"))
                .andExpect(jsonPath("$.items[0].gradeStatusCode").value("SCORED"));
    }
}
