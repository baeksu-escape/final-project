package com.baeksuescape.assessment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.baeksuescape.assessment.client.PredictionClient;
import com.baeksuescape.assessment.client.PredictionClient.PredictionFailedException;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FactorRow;
import com.baeksuescape.assessment.dto.ScoreDtos;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.DataInputUsers;
import com.baeksuescape.user.service.FinancialInputService;
import com.fasterxml.jackson.databind.ObjectMapper;

// FP-142 RPT-01 점수 산출 판정 흐름(B팀 명세서 2장) — DB·FastAPI는 가짜(mock)로 대신하고 판정·저장 순서만 본다.
@ExtendWith(MockitoExtension.class)
class ScoreCalculationServiceTest {

    private static final String REQUEST_ID = "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c";
    private static final long USER_ID = 7L;
    // 실제 서버 시계처럼 나노초까지 있는 시각 (DB 자릿수보다 길다)
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 16, 10, 0, 0, 891_122_500);

    @Mock
    private AssessmentMapper mapper;
    @Mock
    private ScoreInputAssembler assembler;
    @Mock
    private PredictionClient prediction;
    @Mock
    private FinancialInputService financialInput;
    @Mock
    private DataInputUsers users;

    private ScoreCalculationService service;

    @BeforeEach
    void setUp() {
        service = new ScoreCalculationService(mapper, assembler, prediction, financialInput, users, new ObjectMapper());
        lenient().when(users.now()).thenReturn(NOW);
        lenient().when(users.toOffset(any())).thenAnswer(inv -> inv.getArgument(0) == null ? null
                : ((LocalDateTime) inv.getArgument(0)).atZone(ZoneId.of("Asia/Seoul")).toOffsetDateTime());
        lenient().when(users.requireUserWithJob(USER_ID)).thenReturn(user());
        lenient().when(mapper.selectActiveModelVersion()).thenReturn("DEV-DUMMY");
        lenient().when(mapper.selectSetting("INPUT_MAX_AGE_MONTHS")).thenReturn("3");
        lenient().when(assembler.build(anyString(), anyString(), any(), anyString(), anyInt())).thenReturn(mlRequest(12, 12));
        // 저장하면 DB가 ASSESSMENT_ID를 채워 준다
        lenient().doAnswer(inv -> {
            ((AssessmentRow) inv.getArgument(0)).setAssessmentId(100L);
            return 1;
        }).when(mapper).insertAssessment(any());
    }

    // ML-03 요청 본문 중 소득·대안 데이터 검사에 쓰는 부분 — 통신비·공과금은 1달씩 있다(빈 목록 검사에 걸리지 않게)
    private static Map<String, Object> mlRequest(int required, int months) {
        return mlRequest(required, months, List.of(bill()), List.of(bill()), List.of(), List.of());
    }

    private static Map<String, Object> bill() {
        return Map.of("billMonth", "2026-10", "paymentStatusCode", "ON_TIME");
    }

    // 대안 데이터 4종(통신비·공과금·간편결제·보험) 목록을 직접 정한 요청
    private static Map<String, Object> mlRequest(int required, int months, List<Object> telecom, List<Object> utility,
            List<Object> easypay, List<Object> socialInsurance) {
        List<Map<String, Object>> incomes = new ArrayList<>();
        for (int i = 0; i < months; i++) {
            incomes.add(Map.of("baseMonth", String.format("2026-%02d", (i % 12) + 1), "incomeAmt", 1_000_000));
        }
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("requestId", REQUEST_ID);
        request.put("applicant", Map.of("workerTypeCode", "SELF_EMPLOYED", "requiredIncomeMonths", required));
        request.put("incomeMonths", incomes);
        Map<String, Object> alt = new LinkedHashMap<>();
        alt.put("telecom", telecom);
        alt.put("utility", utility);
        alt.put("easypay", easypay);
        alt.put("socialInsurance", socialInsurance);
        request.put("alternativeData", alt);
        return request;
    }

    private static UserAccount user() {
        UserAccount user = new UserAccount();
        user.setUserId(USER_ID);
        user.setWorkerTypeCode("SELF_EMPLOYED");
        user.setBirthYear(1992);   // 2026년 기준 34세 → 30S
        return user;
    }

    private void inputs(boolean complete, String baseMonth) {
        Map<String, Boolean> sections = new LinkedHashMap<>();
        for (String key : List.of("income", "workPeriod", "assets", "loans", "fixedExpense")) {
            sections.put(key, true);
        }
        sections.put("assets", complete);
        Map<String, Boolean> alt = new LinkedHashMap<>();
        for (String key : List.of("telecom", "utility", "easypay", "nationalPension", "healthInsurance")) {
            alt.put(key, true);
        }
        when(financialInput.load(USER_ID)).thenReturn(new DataInputDtos.FinancialInputResponse(null,
                new DataInputDtos.InputStatus(sections, alt), Map.of(), List.of("2026-09", baseMonth)));
    }

    // FastAPI ML-03 응답 모양(명세서 4-3) — 요인 n개, baseScore + Σ shapScore = 대안 점수
    private static Map<String, Object> fastApiResult(int factorCount) {
        List<Map<String, Object>> factors = new ArrayList<>();
        for (int i = 1; i <= factorCount; i++) {
            factors.add(new LinkedHashMap<>(Map.of("rank", i, "featureCode", "f" + i, "featureValue", "1", "shapValue", 0.01, "shapScore", 0)));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", REQUEST_ID);
        result.put("modelVersion", "DEV-DUMMY");
        result.put("featureSetVersion", "FS-DRAFT");
        result.put("cutoffVersion", "CUT-0.1");
        result.put("traditional", Map.of("scorableYn", "Y", "score", 602, "gradeBandCode", "CAUTION", "defaultProb", 0.21481));
        result.put("alternative", Map.of("scorableYn", "Y", "score", 639, "gradeBandCode", "CAUTION", "defaultProb", 0.125));
        result.put("shap", Map.of("baseScore", 639, "factors", factors));
        result.put("featureSnapshot", Map.of("telecom_late_months", 1));
        return result;
    }

    @Test
    void requestIdMustBeLowercaseUuid() {
        assertThatThrownBy(() -> service.calculate(USER_ID, REQUEST_ID.toUpperCase()))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getCode()).isEqualTo("INVALID_INPUT");
                });
        assertThatThrownBy(() -> service.calculate(USER_ID, null)).isInstanceOf(ApiException.class);
    }

    @Test
    void sameRequestIdSameUserReturnsFirstResultWithoutCallingModel() {
        AssessmentRow saved = new AssessmentRow();
        saved.setRequestId(REQUEST_ID);
        saved.setUserId(USER_ID);
        saved.setGradeStatusCode("SCORED");
        saved.setAltScore(700);
        saved.setAltGradeBandCode("STANDARD");
        saved.setTradScorableYn("Y");
        when(mapper.selectByRequestId(REQUEST_ID)).thenReturn(saved);

        ScoreDtos.ScoreResponse response = service.calculate(USER_ID, REQUEST_ID);

        assertThat(response.alternative().score()).isEqualTo(700);
        verify(prediction, never()).score(any());
        verify(mapper, never()).insertAssessment(any());
    }

    @Test
    void sameRequestIdOtherUserIsConflict() {
        AssessmentRow other = new AssessmentRow();
        other.setUserId(99L);
        when(mapper.selectByRequestId(REQUEST_ID)).thenReturn(other);

        assertThatThrownBy(() -> service.calculate(USER_ID, REQUEST_ID))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("REQUEST_ID_CONFLICT"));
    }

    @Test
    void incompleteInputIs409AndSavesNothing() {
        inputs(false, "2026-10");

        assertThatThrownBy(() -> service.calculate(USER_ID, REQUEST_ID))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getCode()).isEqualTo("INPUT_INCOMPLETE");
                });
        verify(mapper, never()).insertAssessment(any());
    }

    @Test
    void staleInputSavesNotScorableWithoutCallingModel() {
        inputs(true, "2026-07");   // 11월 기준 4개월 전 > 3

        ScoreDtos.ScoreResponse response = service.calculate(USER_ID, REQUEST_ID);

        assertThat(response.gradeStatusCode()).isEqualTo("NOT_SCORABLE");
        assertThat(response.notScorableReasonCode()).isEqualTo("STALE_INPUT");
        assertThat(response.alternative()).isNull();
        verify(prediction, never()).score(any());
        ArgumentCaptor<AssessmentRow> row = ArgumentCaptor.forClass(AssessmentRow.class);
        verify(mapper).insertAssessment(row.capture());
        assertThat(row.getValue().getTradScorableYn()).isEqualTo("N");
        assertThat(row.getValue().getAltScorableYn()).isEqualTo("N");
        assertThat(row.getValue().getModelVersion()).isEqualTo("DEV-DUMMY");
    }

    @Test
    void withoutDbSettingDefaultIsSixMonths() {
        // APP_SETTING 값이 없으면 DDL 기준값과 같은 6개월(11/16 3→6) — 6개월 전은 허용
        when(mapper.selectSetting("INPUT_MAX_AGE_MONTHS")).thenReturn(null);
        inputs(true, "2026-05");
        when(prediction.score(any())).thenReturn(fastApiResult(2));

        assertThat(service.calculate(USER_ID, REQUEST_ID).gradeStatusCode()).isEqualTo("SCORED");
    }

    @Test
    void threeMonthsOldIsStillScorable() {
        inputs(true, "2026-08");   // 정확히 3개월 전은 허용
        when(prediction.score(any())).thenReturn(fastApiResult(2));

        assertThat(service.calculate(USER_ID, REQUEST_ID).gradeStatusCode()).isEqualTo("SCORED");
    }

    @Test
    void modelFailsTwiceSavesModelError() {
        inputs(true, "2026-10");
        when(prediction.score(any())).thenThrow(new PredictionFailedException("timeout", true));

        ScoreDtos.ScoreResponse response = service.calculate(USER_ID, REQUEST_ID);

        assertThat(response.notScorableReasonCode()).isEqualTo("MODEL_ERROR");
        verify(prediction, times(2)).score(any());   // 처음 + 1번 다시
        verify(mapper, never()).insertFactor(any());
    }

    @Test
    void modelRejectsInputIsNotRetriedAndSavesModelError() {
        // FastAPI 4xx(422 입력 오류)는 다시 보내도 같아서 재시도하지 않는다 (B팀 명세서 4-3, 재욱 검토 1번)
        inputs(true, "2026-10");
        when(prediction.score(any())).thenThrow(new PredictionFailedException("HTTP 422", false));

        assertThat(service.calculate(USER_ID, REQUEST_ID).notScorableReasonCode()).isEqualTo("MODEL_ERROR");
        verify(prediction, times(1)).score(any());
    }

    @Test
    void incomeMonthsShortIs409BeforeCallingModel() {
        // 자영업자인데 소득이 3개월치뿐이면 FastAPI를 부르지 않고 409 (재욱 검토 1번)
        inputs(true, "2026-10");
        when(assembler.build(anyString(), anyString(), any(), anyString(), anyInt())).thenReturn(mlRequest(12, 3));

        assertThatThrownBy(() -> service.calculate(USER_ID, REQUEST_ID))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INPUT_INCOMPLETE"));
        verify(prediction, never()).score(any());
        verify(mapper, never()).insertAssessment(any());
    }

    @Test
    void emptyTelecomSavesAltDataEmptyWithoutCallingModel() {
        // 피처 정의서 8-5 (다): 통신비 기관 기록이 0건이면 점수를 내지 않고 ALT_DATA_EMPTY로 저장한다
        inputs(true, "2026-10");
        when(assembler.build(anyString(), anyString(), any(), anyString(), anyInt()))
                .thenReturn(mlRequest(12, 12, List.of(), List.of(bill()), List.of(), List.of()));

        ScoreDtos.ScoreResponse response = service.calculate(USER_ID, REQUEST_ID);

        assertThat(response.gradeStatusCode()).isEqualTo("NOT_SCORABLE");
        assertThat(response.notScorableReasonCode()).isEqualTo("ALT_DATA_EMPTY");
        verify(prediction, never()).score(any());
        verify(mapper).insertAssessment(any());
        verify(mapper, never()).insertFactor(any());
    }

    @Test
    void emptyUtilitySavesAltDataEmpty() {
        inputs(true, "2026-10");
        when(assembler.build(anyString(), anyString(), any(), anyString(), anyInt()))
                .thenReturn(mlRequest(12, 12, List.of(bill()), List.of(), List.of(), List.of()));

        assertThat(service.calculate(USER_ID, REQUEST_ID).notScorableReasonCode()).isEqualTo("ALT_DATA_EMPTY");
        verify(prediction, never()).score(any());
    }

    @Test
    void emptyEasypayAndInsuranceStillScored() {
        // 간편결제 0건·보험 기록 없음은 학습에도 있는 경우라 막지 않는다(8-5)
        inputs(true, "2026-10");
        when(assembler.build(anyString(), anyString(), any(), anyString(), anyInt()))
                .thenReturn(mlRequest(12, 12, List.of(bill()), List.of(bill()), List.of(), List.of()));
        when(prediction.score(any())).thenReturn(fastApiResult(2));

        assertThat(service.calculate(USER_ID, REQUEST_ID).gradeStatusCode()).isEqualTo("SCORED");
    }

    @Test
    void missingBirthYearIs409NotAgeZero() {
        // 출생연도가 없으면 0살·20대로 저장하지 않고 409 (재욱 검토 2번)
        inputs(true, "2026-10");
        UserAccount noBirth = user();
        noBirth.setBirthYear(null);
        when(users.requireUserWithJob(USER_ID)).thenReturn(noBirth);

        assertThatThrownBy(() -> service.calculate(USER_ID, REQUEST_ID))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INPUT_INCOMPLETE"));
        verify(mapper, never()).insertAssessment(any());
    }

    @Test
    void modelFailsOnceThenSucceeds() {
        inputs(true, "2026-10");
        when(prediction.score(any())).thenThrow(new PredictionFailedException("timeout", true)).thenReturn(fastApiResult(2));

        assertThat(service.calculate(USER_ID, REQUEST_ID).gradeStatusCode()).isEqualTo("SCORED");
    }

    @Test
    void scoredSavesAssessmentAndAllFactorsWithSameId() {
        inputs(true, "2026-10");
        when(prediction.score(any())).thenReturn(fastApiResult(39));

        ScoreDtos.ScoreResponse response = service.calculate(USER_ID, REQUEST_ID);

        assertThat(response.gradeStatusCode()).isEqualTo("SCORED");
        assertThat(response.alternative().score()).isEqualTo(639);
        assertThat(response.traditional().score()).isEqualTo(602);
        assertThat(response.calculatedAt()).isNotNull();

        ArgumentCaptor<AssessmentRow> row = ArgumentCaptor.forClass(AssessmentRow.class);
        verify(mapper).insertAssessment(row.capture());
        AssessmentRow saved = row.getValue();
        assertThat(saved.getFeatureSetVersion()).isEqualTo("FS-DRAFT");
        assertThat(saved.getCutoffVersion()).isEqualTo("CUT-0.1");
        assertThat(saved.getAgeBandCode()).isEqualTo("30S");
        assertThat(saved.getInputBaseMonth()).isEqualTo("2026-10");
        assertThat(saved.getShapBaseScore()).isEqualTo(639);
        assertThat(saved.getFeatureSnapshot()).contains("telecom_late_months");
        // 저장 시각은 DB 자릿수(마이크로초)로 맞춰서, 같은 requestId로 다시 보냈을 때 응답 시각이 같다
        assertThat(saved.getAssessedAt().getNano()).isEqualTo(891_122_000);

        ArgumentCaptor<FactorRow> factor = ArgumentCaptor.forClass(FactorRow.class);
        verify(mapper, times(39)).insertFactor(factor.capture());
        assertThat(factor.getAllValues()).allSatisfy(f -> {
            assertThat(f.getAssessmentId()).isEqualTo(100L);
            assertThat(f.getFeatureSetVersion()).isEqualTo("FS-DRAFT");
        });
        verify(assembler).build(eq(REQUEST_ID), eq("DEV-DUMMY"), any(), eq("2026-10"), eq(34));
    }

    @Test
    void ageBandEdges() {
        assertThat(ScoreCalculationService.ageBandCode(20)).isEqualTo("20S");
        assertThat(ScoreCalculationService.ageBandCode(29)).isEqualTo("20S");
        assertThat(ScoreCalculationService.ageBandCode(30)).isEqualTo("30S");
        assertThat(ScoreCalculationService.ageBandCode(49)).isEqualTo("40S");
        assertThat(ScoreCalculationService.ageBandCode(50)).isEqualTo("50_PLUS");
    }
}
