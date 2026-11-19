package com.baeksuescape.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import com.baeksuescape.assessment.client.PredictionClient;
import com.baeksuescape.assessment.client.PredictionClient.SimulationFailedException;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FeatureRow;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.finance.dto.CreditCareBaseResponse;
import com.baeksuescape.finance.dto.CreditCareSimulationRequest;
import com.baeksuescape.finance.dto.CreditCareSimulationResponse;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.mapper.FinancialInputMapper;
import com.baeksuescape.user.service.DataInputUsers;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * FP-170 N-18 시뮬레이터 서비스 테스트 — 출발 평가(최근 SCORED) 선택, SIM-01 값 꺼내기, SIM-02 입력 검사·ML-04 요청·응답·오류 변환.
 * DB·FastAPI 없이 Mockito로 확인한다.
 */
class CreditCareSimulationServiceTest {

    private static final long USER_ID = 2L;
    private static final String BASE_REQUEST_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    private AssessmentMapper assessmentMapper;
    private FinancialInputMapper inputMapper;
    private PredictionClient predictionClient;
    private CreditCareSimulationService service;

    @BeforeEach
    void setUp() {
        assessmentMapper = mock(AssessmentMapper.class);
        inputMapper = mock(FinancialInputMapper.class);
        predictionClient = mock(PredictionClient.class);
        DataInputUsers users = mock(DataInputUsers.class);
        service = new CreditCareSimulationService(assessmentMapper, inputMapper, predictionClient, users, new ObjectMapper());
    }

    private static AssessmentRow scoredRow() {
        AssessmentRow row = new AssessmentRow();
        row.setRequestId(BASE_REQUEST_ID);
        row.setModelVersion("DEV-DUMMY");
        row.setFeatureSetVersion("FS-DRAFT");
        row.setInputBaseMonth("2026-08");
        row.setGradeStatusCode("SCORED");
        row.setAltScore(588);
        row.setAltGradeBandCode("CAUTION");
        row.setAssessedAt(LocalDateTime.of(2026, 11, 17, 10, 0));
        row.setFeatureSnapshot("{\"telecom_on_time_streak\": 8, \"utility_late_months\": 1, \"DQ1200001\": 0, "
                + "\"CF1231605\": 0, \"L22000900\": 1, \"debt_balance_krw\": 12000000, \"LA0099212\": 0, "
                + "\"dp_payment_count_12m\": 276, \"CL0631905\": 30.0, \"income_cv\": 0.33}");
        return row;
    }

    @Test
    @DisplayName("점수가 나온 평가가 없으면 SIM-01·02 모두 404 ASSESSMENT_NOT_FOUND")
    void noScoredAssessment() {
        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(null);

        ApiException base = assertThrows(ApiException.class, () -> service.base(USER_ID));
        assertEquals(HttpStatus.NOT_FOUND, base.getStatus());
        assertEquals("ASSESSMENT_NOT_FOUND", base.getCode());

        ApiException recalc = assertThrows(ApiException.class,
                () -> service.recalculate(USER_ID, new CreditCareSimulationRequest(Map.of())));
        assertEquals("ASSESSMENT_NOT_FOUND", recalc.getCode());
        verify(predictionClient, never()).simulate(any());
    }

    @Test
    @DisplayName("SIM-01: 피처값에서 8개, 간편결제는 12개월 값 ÷ 12, 카드 2개는 그 기준월 직접 입력에서 꺼낸다")
    void baseValues() {
        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(scoredRow());
        CreditRow credit = new CreditRow();
        credit.setCardLimitAmt(5000000L);
        credit.setCardMonthlySpendAmt(1500000L);
        when(inputMapper.selectManualCredit(USER_ID, LocalDate.of(2026, 8, 31))).thenReturn(credit);

        CreditCareBaseResponse response = service.base(USER_ID);

        assertEquals(BASE_REQUEST_ID, response.baseRequestId());
        assertEquals(588, response.score());
        assertEquals("CAUTION", response.gradeBandCode());
        Map<String, Long> values = response.values();
        assertEquals(10, values.size());
        assertEquals(8L, values.get("TELECOM_ON_TIME_MONTHS"));
        assertEquals(1L, values.get("UTILITY_LATE_MONTHS"));
        assertEquals(1L, values.get("NEW_LOAN_COUNT_3M"));
        assertEquals(12000000L, values.get("LOAN_BALANCE_AMT"));
        assertEquals(23L, values.get("EASYPAY_MONTHLY_COUNT"));
        assertEquals(5000000L, values.get("CARD_LIMIT_AMT"));
        assertEquals(1500000L, values.get("CARD_MONTHLY_SPEND_AMT"));
        assertFalse(values.containsKey("income_cv"), "피처값 전체를 내보내지 않는다");
    }

    @Test
    @DisplayName("SIM-01: 값이 없는 피처·카드 입력이 없으면 null (0으로 바꾸지 않음)")
    void baseNullValues() {
        AssessmentRow row = scoredRow();
        row.setFeatureSnapshot("{\"telecom_on_time_streak\": null}");
        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(row);

        Map<String, Long> values = service.base(USER_ID).values();

        assertNull(values.get("TELECOM_ON_TIME_MONTHS"));
        assertNull(values.get("EASYPAY_MONTHLY_COUNT"));
        assertNull(values.get("CARD_LIMIT_AMT"));
    }

    @Test
    @DisplayName("SIM-02 검사: 모르는 키·음수·소수·문자·12 초과·카드 한쪽만을 모두 모아 400으로 알린다")
    void validateAll() {
        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("DELINQ_COUNT12M", 1);
        changes.put("LOAN_BALANCE_AMT", -1);
        changes.put("NEW_LOAN_COUNT_3M", 1.5);
        changes.put("CASH_ADVANCE_MONTHS", "2");
        changes.put("TELECOM_ON_TIME_MONTHS", 13);
        changes.put("CARD_LIMIT_AMT", 5000000);

        ApiException e = assertThrows(ApiException.class, () -> CreditCareSimulationService.validateChanges(changes));

        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("INVALID_INPUT", e.getCode());
        Map<String, String> byField = new HashMap<>();
        for (FieldErrorItem item : e.getFieldErrors()) {
            byField.merge(item.field(), item.message(), (a, b) -> a + " / " + b);
        }
        assertEquals("모르는 항목입니다.", byField.get("changes.DELINQ_COUNT12M"));
        assertEquals("0 이상의 정수를 입력해 주세요.", byField.get("changes.LOAN_BALANCE_AMT"));
        assertEquals("0 이상의 정수를 입력해 주세요.", byField.get("changes.NEW_LOAN_COUNT_3M"));
        assertEquals("0 이상의 정수를 입력해 주세요.", byField.get("changes.CASH_ADVANCE_MONTHS"));
        assertEquals("0~12 사이로 입력해 주세요.", byField.get("changes.TELECOM_ON_TIME_MONTHS"));
        assertEquals("카드 한도와 월 카드 사용액은 함께 보내야 합니다.", byField.get("changes.CARD_LIMIT_AMT"));
    }

    @Test
    @DisplayName("SIM-02 검사: null은 뺀 것과 같고, 경계값 0·12와 카드 둘 다는 통과한다")
    void validatePasses() {
        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("TELECOM_ON_TIME_MONTHS", 12);
        changes.put("UTILITY_LATE_MONTHS", 0);
        changes.put("EASYPAY_MONTHLY_COUNT", null);
        changes.put("CARD_LIMIT_AMT", 0);
        changes.put("CARD_MONTHLY_SPEND_AMT", 1000000L);

        Map<String, Object> cleaned = CreditCareSimulationService.validateChanges(changes);

        assertEquals(4, cleaned.size());
        assertFalse(cleaned.containsKey("EASYPAY_MONTHLY_COUNT"));
        assertTrue(CreditCareSimulationService.validateChanges(null).isEmpty());
    }

    @Test
    @DisplayName("SIM-02: 저장된 평가의 버전·피처값으로 ML-04 요청을 만들고 requestId는 매번 새로, shap은 빼고 featureName을 붙인다")
    @SuppressWarnings("unchecked")
    void recalculate() {
        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(scoredRow());
        FeatureRow feature = new FeatureRow();
        feature.setFeatureCode("CL0631905");
        feature.setFeatureName("카드 한도 사용률");
        when(assessmentMapper.selectModelFeatures("FS-DRAFT", "DEV-DUMMY")).thenReturn(List.of(feature));
        Map<String, Object> ml04 = new HashMap<>();
        ml04.put("requestId", "x");
        ml04.put("modelVersion", "DEV-DUMMY");
        ml04.put("cutoffVersion", "CUT-0.1");
        ml04.put("before", Map.of("score", 588, "gradeBandCode", "CAUTION", "defaultProb", 0.21));
        ml04.put("after", Map.of("score", 618, "gradeBandCode", "CAUTION", "defaultProb", 0.18));
        ml04.put("delta", Map.of("total", 30, "financialEffect", 16, "alternativeEffect", 14));
        ml04.put("topReductionFactors", List.of(Map.of("rank", 1, "featureCode", "CL0631905", "featureValue", 60.0,
                "shapScore", -12, "recoverScore", 12)));
        ml04.put("shap", Map.of("factors", List.of()));
        when(predictionClient.simulate(any())).thenReturn(ml04);

        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("TELECOM_ON_TIME_MONTHS", 12);
        changes.put("DELINQ_COUNT_12M", null);
        CreditCareSimulationResponse response = service.recalculate(USER_ID, new CreditCareSimulationRequest(changes));
        service.recalculate(USER_ID, new CreditCareSimulationRequest(changes));

        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(predictionClient, org.mockito.Mockito.times(2)).simulate(captor.capture());
        Map<String, Object> sent = captor.getAllValues().get(0);
        Map<String, Object> baseAssessment = (Map<String, Object>) sent.get("baseAssessment");
        assertEquals(BASE_REQUEST_ID, baseAssessment.get("requestId"));
        assertEquals("DEV-DUMMY", baseAssessment.get("modelVersion"));
        assertEquals("FS-DRAFT", baseAssessment.get("featureSetVersion"));
        assertEquals(8, ((Map<String, Object>) baseAssessment.get("featureSnapshot")).get("telecom_on_time_streak"));
        assertEquals(Map.of("TELECOM_ON_TIME_MONTHS", 12L), sent.get("changes"));
        assertNotEquals(sent.get("requestId"), captor.getAllValues().get(1).get("requestId"));
        assertTrue(((String) sent.get("requestId")).matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"));

        assertEquals(588, response.before().score());
        assertEquals(618, response.after().score());
        assertEquals(0.18, response.after().defaultProb());
        assertEquals(30, response.delta().total());
        assertEquals(response.delta().total(), response.delta().financialEffect() + response.delta().alternativeEffect());
        assertEquals("카드 한도 사용률", response.topReductionFactors().get(0).featureName());
        assertEquals(12, response.topReductionFactors().get(0).recoverScore());
    }

    @Test
    @DisplayName("SIM-02 검사에 걸리면 ML-04를 부르지 않는다")
    void invalidDoesNotCall() {
        assertThrows(ApiException.class,
                () -> service.recalculate(USER_ID, new CreditCareSimulationRequest(Map.of("UNKNOWN", 1))));
        verify(predictionClient, never()).simulate(any());
    }

    @Test
    @DisplayName("ML-04 실패 변환: 422→400(fieldErrors 유지), 409→409, 503→503")
    void errorMapping() {
        List<FieldErrorItem> fields = List.of(new FieldErrorItem("changes.CARD_LIMIT_AMT", "함께 보내야 합니다."));
        ApiException invalid = CreditCareSimulationService.toApiException(new SimulationFailedException(422, "INVALID_INPUT", fields));
        assertEquals(HttpStatus.BAD_REQUEST, invalid.getStatus());
        assertEquals("INVALID_INPUT", invalid.getCode());
        assertEquals(fields, invalid.getFieldErrors());

        ApiException mismatch = CreditCareSimulationService.toApiException(new SimulationFailedException(409, "VERSION_MISMATCH", List.of()));
        assertEquals(HttpStatus.CONFLICT, mismatch.getStatus());
        assertEquals("VERSION_MISMATCH", mismatch.getCode());

        ApiException notReady = CreditCareSimulationService.toApiException(new SimulationFailedException(503, "MODEL_NOT_READY", List.of()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, notReady.getStatus());
        assertEquals("MODEL_NOT_READY", notReady.getCode());
    }

    @Test
    @DisplayName("ML-04가 실패하면 서비스가 화면용 오류로 바꿔 던진다 (저장 없음)")
    void recalculateFailure() {
        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(scoredRow());
        when(predictionClient.simulate(any())).thenThrow(new SimulationFailedException(503, "MODEL_NOT_READY", List.of()));

        ApiException e = assertThrows(ApiException.class,
                () -> service.recalculate(USER_ID, new CreditCareSimulationRequest(Map.of())));

        assertEquals("MODEL_NOT_READY", e.getCode());
        verify(assessmentMapper, never()).insertAssessment(any());
    }
}
