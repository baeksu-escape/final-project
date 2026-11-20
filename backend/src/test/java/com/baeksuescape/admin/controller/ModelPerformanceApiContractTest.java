package com.baeksuescape.admin.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.admin.dto.ModelPerformanceDtos.JobReject;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.ModelMetrics;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.PerformanceView;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocCurve;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocPoint;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocView;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.admin.service.ModelPerformanceService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

// N-25 모형 성능 비교 API 계약 (ADM-01·02, FP-184) — 경로·권한·쿼리 기본값·JSON 키·400/409 오류 모양이 api_spec_c.md와 같은지 본다.
// 서비스는 mock으로 대신하고, 보안 필터·쿼리 형식 검사·오류 처리는 실제로 탄다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ModelPerformanceApiContractTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private ModelPerformanceService service;
    // FP-80 /api/admin/** 인터셉터가 '비밀번호 변경 필요' 여부를 이 매퍼로 본다. mock 기본값(null)이라 통과한다.
    @MockBean
    private AdminAccountMapper adminAccountMapper;

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN"));
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"));
    }

    private static ModelMetrics metrics(double auc) {
        return new ModelMetrics("LGBM-BASE-0.1", auc, 61.5, 0.4321, 30.25, 40.0, 65.12);
    }

    @Test
    void 로그인하지_않으면_401_일반_사용자는_403() throws Exception {
        mvc.perform(get("/api/admin/model-performance")).andExpect(status().isUnauthorized());
        mvc.perform(asUser(get("/api/admin/model-performance"))).andExpect(status().isForbidden());
        mvc.perform(asUser(get("/api/admin/model-performance/roc"))).andExpect(status().isForbidden());
    }

    @Test
    void ADM_01_응답_키와_쿼리_기본값() throws Exception {
        given(service.performance("LEGACY", "DELINQ", 700)).willReturn(new PerformanceView("LEGACY", "DELINQ", 700, "VALID", 1800, 174,
                "SEED_MEAN_5", metrics(0.6049), metrics(0.5991), List.of(new JobReject("EMPLOYEE", 1411, 130, 31.5, 29.25))));

        mvc.perform(asAdmin(get("/api/admin/model-performance")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group").value("LEGACY"))
                .andExpect(jsonPath("$.label").value("DELINQ"))
                .andExpect(jsonPath("$.cutoff").value(700))
                .andExpect(jsonPath("$.sampleBasis").value("VALID"))
                .andExpect(jsonPath("$.sampleCount").value(1800))
                .andExpect(jsonPath("$.badCount").value(174))
                .andExpect(jsonPath("$.aucBasis").value("SEED_MEAN_5"))
                .andExpect(jsonPath("$.legacy.modelVersion").value("LGBM-BASE-0.1"))
                .andExpect(jsonPath("$.legacy.auc").value(0.6049))
                .andExpect(jsonPath("$.alternative.auc").value(0.5991))
                .andExpect(jsonPath("$.alternative.accuracy").value(61.5))
                .andExpect(jsonPath("$.alternative.misclassCost").value(0.4321))
                .andExpect(jsonPath("$.alternative.goodRejectRate").value(30.25))
                .andExpect(jsonPath("$.alternative.badApproveRate").value(40.0))
                .andExpect(jsonPath("$.alternative.approvalRate").value(65.12))
                .andExpect(jsonPath("$.byJob[0].jobType").value("EMPLOYEE"))
                .andExpect(jsonPath("$.byJob[0].sampleCount").value(1411))
                .andExpect(jsonPath("$.byJob[0].badCount").value(130))
                .andExpect(jsonPath("$.byJob[0].legacyGoodRejectRate").value(31.5))
                .andExpect(jsonPath("$.byJob[0].alternativeGoodRejectRate").value(29.25));
    }

    @Test
    void ADM_02_ROC_응답_키() throws Exception {
        RocCurve curve = new RocCurve(List.of(new RocPoint(0.0, 0.0), new RocPoint(100.0, 100.0)));
        given(service.roc("THINFILE", "NONFIN")).willReturn(new RocView("THINFILE", "NONFIN", curve, curve));

        mvc.perform(asAdmin(get("/api/admin/model-performance/roc").param("group", "THINFILE").param("label", "NONFIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group").value("THINFILE"))
                .andExpect(jsonPath("$.label").value("NONFIN"))
                .andExpect(jsonPath("$.legacy.points[1].fpr").value(100.0))
                .andExpect(jsonPath("$.alternative.points[1].tpr").value(100.0));
    }

    @Test
    void 컷오프가_숫자가_아니면_400_INVALID_INPUT() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/model-performance").param("cutoff", "abc")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("cutoff"));
    }

    @Test
    void 서비스의_400과_409는_공통_오류_모양으로_나간다() throws Exception {
        given(service.performance("ALL", "DELINQ", 700)).willThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                "고객 집단 값이 올바르지 않습니다.",
                List.of(new FieldErrorItem("group", "고객 집단 값이 올바르지 않습니다."))));
        given(service.roc("LEGACY", "DELINQ")).willThrow(new ApiException(HttpStatus.CONFLICT, "MODEL_EVAL_NOT_READY",
                "지금 사용 중인 모델(DEV-DUMMY)의 평가 표본이 아직 준비되지 않았습니다."));

        mvc.perform(asAdmin(get("/api/admin/model-performance").param("group", "ALL")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("group"));
        mvc.perform(asAdmin(get("/api/admin/model-performance/roc")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MODEL_EVAL_NOT_READY"))
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }
}
