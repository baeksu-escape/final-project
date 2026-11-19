package com.baeksuescape.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import com.baeksuescape.assessment.client.PredictionClient;
import com.baeksuescape.assessment.client.PredictionClient.PredictionFailedException;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.assessment.service.ScoreInputAssembler;
import com.baeksuescape.finance.dto.cashflow.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.cashflow.ExpectedScoreResponse;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.DataInputDtos.FinancialInputResponse;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.DataInputUsers;
import com.baeksuescape.user.service.FinancialInputService;

/**
 * FP-170 N-21-8 DIAG-09 예상 점수 서비스 테스트 — 소득·지출 조건 반영 식, ML-03 1회 호출(저장 안 함), 현재 점수와의 차이, 오류 변환.
 */
class ExpectedScoreServiceTest {

    private static final long USER_ID = 2L;

    private AssessmentMapper assessmentMapper;
    private ScoreInputAssembler assembler;
    private PredictionClient predictionClient;
    private DataInputUsers users;
    private FinancialInputService financialInput;
    private IncomeVolatilityService incomeVolatilityService;
    private ExpectedScoreService service;

    @BeforeEach
    void setUp() {
        assessmentMapper = mock(AssessmentMapper.class);
        assembler = mock(ScoreInputAssembler.class);
        predictionClient = mock(PredictionClient.class);
        users = mock(DataInputUsers.class);
        financialInput = mock(FinancialInputService.class);
        incomeVolatilityService = mock(IncomeVolatilityService.class);
        service = new ExpectedScoreService(assessmentMapper, assembler, predictionClient, users, financialInput,
                incomeVolatilityService);
    }

    // 소득 3개월(100·200·300만, 평균 200만)과 지출 FIXED 2개(30·10만)·LIVING 1개(20만)인 ML-03 요청
    private static Map<String, Object> request() {
        List<Map<String, Object>> incomes = new ArrayList<>();
        incomes.add(month("2026-06", 1000000L));
        incomes.add(month("2026-07", 2000000L));
        incomes.add(month("2026-08", 3000000L));
        List<Map<String, Object>> expenses = new ArrayList<>();
        expenses.add(expense("FIXED", "주거", 300000L));
        expenses.add(expense("FIXED", "통신", 100000L));
        expenses.add(expense("LIVING", "식비", 200000L));
        Map<String, Object> request = new LinkedHashMap<>();
        // 실제 프리랜서는 12개월이지만, 시험 자료가 3개월이라 필요한 개월 수도 3으로 맞춘다
        request.put("applicant", new LinkedHashMap<>(Map.of("workerTypeCode", "FREELANCER", "requiredIncomeMonths", 3)));
        request.put("incomeMonths", incomes);
        request.put("expenses", expenses);
        return request;
    }

    private static Map<String, Object> month(String baseMonth, long amount) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("baseMonth", baseMonth);
        m.put("incomeKindCode", "MONTHLY_INCOME");
        m.put("incomeAmt", amount);
        return m;
    }

    private static Map<String, Object> expense(String group, String category, long amount) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("expenseGroupCode", group);
        m.put("expenseCategory", category);
        m.put("monthlyAmt", amount);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> incomeAmounts(Map<String, Object> request) {
        return ((List<Map<String, Object>>) request.get("incomeMonths")).stream().map(m -> m.get("incomeAmt")).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> expenseAmounts(Map<String, Object> request) {
        return ((List<Map<String, Object>>) request.get("expenses")).stream().map(m -> m.get("monthlyAmt")).toList();
    }

    private static CashFlowConditionRequest condition(Integer variation, double incomeChange, Long fixed, double expenseChange) {
        CashFlowConditionRequest c = new CashFlowConditionRequest();
        c.setIncomeVariationPct(variation);
        c.setIncomeChangePercent(incomeChange);
        c.setFixedExpenseAmount(fixed);
        c.setExpenseChangePercent(expenseChange);
        return c;
    }

    @Test
    @DisplayName("소득: 변동 폭 생략·100%는 그대로, 0%는 매달 평균, 200%는 평균에서 두 배로 벌어지고 0원 아래는 0")
    void incomeVariation() {
        Map<String, Object> keep = request();
        ExpectedScoreService.applyIncomeCondition(keep, condition(null, 0, null, 0));
        assertEquals(List.of(1000000L, 2000000L, 3000000L), incomeAmounts(keep));

        Map<String, Object> flat = request();
        ExpectedScoreService.applyIncomeCondition(flat, condition(0, 0, null, 0));
        assertEquals(List.of(2000000L, 2000000L, 2000000L), incomeAmounts(flat));

        Map<String, Object> wide = request();
        ExpectedScoreService.applyIncomeCondition(wide, condition(200, 0, null, 0));
        assertEquals(List.of(0L, 2000000L, 4000000L), incomeAmounts(wide));
    }

    @Test
    @DisplayName("소득: 변화율 −10%를 곱하고, 급여소득자(1개월)는 변화율만 적용된다")
    void incomeChangeAndEmployee() {
        Map<String, Object> request = request();
        ExpectedScoreService.applyIncomeCondition(request, condition(100, -10, null, 0));
        assertEquals(List.of(900000L, 1800000L, 2700000L), incomeAmounts(request));

        Map<String, Object> employee = new LinkedHashMap<>();
        employee.put("incomeMonths", new ArrayList<>(List.of(month("2026-08", 3000000L))));
        ExpectedScoreService.applyIncomeCondition(employee, condition(0, 10, null, 0));
        assertEquals(List.of(3300000L), incomeAmounts(employee));
    }

    @Test
    @DisplayName("지출: 고정지출 50만이면 FIXED 30·10만이 비율대로 37.5·12.5만, LIVING은 그대로. 이어서 지출 변화율을 모두에 곱한다")
    void fixedExpenseScaling() {
        Map<String, Object> request = request();
        ExpectedScoreService.applyExpenseCondition(request, condition(null, 0, 500000L, 0));
        assertEquals(List.of(375000L, 125000L, 200000L), expenseAmounts(request));

        Map<String, Object> changed = request();
        ExpectedScoreService.applyExpenseCondition(changed, condition(null, 0, 500000L, 10));
        assertEquals(List.of(412500L, 137500L, 220000L), expenseAmounts(changed));
    }

    @Test
    @DisplayName("지출: 나눠 떨어지지 않으면 반올림 차이를 마지막 FIXED에 둬서 합계가 정확히 맞는다. FIXED가 없으면 1행을 더한다")
    void fixedExpenseRoundingAndMissing() {
        Map<String, Object> request = request();
        ExpectedScoreService.applyExpenseCondition(request, condition(null, 0, 100001L, 0));
        List<Object> amounts = expenseAmounts(request);
        assertEquals(100001L, (Long) amounts.get(0) + (Long) amounts.get(1));

        Map<String, Object> noFixed = new LinkedHashMap<>();
        noFixed.put("expenses", new ArrayList<>(List.of(expense("LIVING", "식비", 200000L))));
        ExpectedScoreService.applyExpenseCondition(noFixed, condition(null, 0, 700000L, 0));
        assertEquals(List.of(200000L, 700000L), expenseAmounts(noFixed));
    }

    private void readyToScore(AssessmentRow current) {
        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(current);
        UserAccount user = new UserAccount();
        user.setUserId(USER_ID);
        user.setWorkerTypeCode("FREELANCER");
        user.setBirthYear(1995);
        when(users.requireUserWithJob(USER_ID)).thenReturn(user);
        when(users.now()).thenReturn(LocalDateTime.of(2026, 11, 18, 10, 0));
        when(financialInput.load(USER_ID)).thenReturn(new FinancialInputResponse(null, null, null, List.of("2026-07", "2026-08")));
        when(assessmentMapper.selectActiveModelVersion()).thenReturn("REAL-V1");
        when(assembler.build(anyString(), eq("REAL-V1"), eq(user), eq("2026-08"), eq(31))).thenAnswer(invocation -> request());
    }

    private static AssessmentRow current() {
        AssessmentRow row = new AssessmentRow();
        row.setRequestId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
        row.setAltScore(588);
        row.setAltGradeBandCode("CAUTION");
        row.setModelVersion("DEV-DUMMY");   // 현재 점수는 옛 모델로, 예상 점수는 ACTIVE(REAL-V1)로 낸 상황
        return row;
    }

    @Test
    @DisplayName("ML-03을 바꾼 입력으로 한 번만 부르고(ACTIVE 모델·새 UUID), 저장된 점수와의 차이를 돌려준다. 저장하지 않는다")
    @SuppressWarnings("unchecked")
    void expectedScore() {
        readyToScore(current());
        when(predictionClient.score(any())).thenReturn(Map.of("modelVersion", "REAL-V1",
                "alternative", Map.of("score", 571, "gradeBandCode", "CAUTION", "defaultProb", 0.24)));

        ExpectedScoreResponse response = service.expectedScore(USER_ID, condition(0, -10, 500000L, 0));
        service.expectedScore(USER_ID, condition(0, -10, 500000L, 0));

        assertEquals(588, response.currentScore());
        assertEquals(571, response.expectedScore());
        assertEquals(-17, response.scoreDiff());
        assertEquals("REAL-V1", response.modelVersion());
        assertEquals("DEV-DUMMY", response.baseModelVersion(), "현재 점수를 낸 모델을 함께 보내 화면이 모델 변경을 안내할 수 있다");
        assertFalse(response.paymentStatusApplied());

        ArgumentCaptor<String> requestIds = ArgumentCaptor.forClass(String.class);
        verify(assembler, times(2)).build(requestIds.capture(), eq("REAL-V1"), any(), eq("2026-08"), eq(31));
        assertNotEquals(requestIds.getAllValues().get(0), requestIds.getAllValues().get(1));

        ArgumentCaptor<Map<String, Object>> sent = ArgumentCaptor.forClass(Map.class);
        verify(predictionClient, times(2)).score(sent.capture());
        assertEquals(List.of(1800000L, 1800000L, 1800000L), incomeAmounts(sent.getAllValues().get(0)));
        assertEquals(List.of(375000L, 125000L, 200000L), expenseAmounts(sent.getAllValues().get(0)));
        verify(assessmentMapper, never()).insertAssessment(any());
    }

    @Test
    @DisplayName("조건 검사에 걸리면 400, 점수가 나온 평가가 없으면 404, 입력 기준월이 없으면 409")
    void errors() {
        CashFlowConditionRequest bad = condition(300, 0, null, 0);
        doThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "소득 변동 폭은 0~200% 정수여야 합니다."))
                .when(incomeVolatilityService).validateScreenConditions(bad);
        assertEquals("INVALID_INPUT", assertThrows(ApiException.class, () -> service.expectedScore(USER_ID, bad)).getCode());

        when(assessmentMapper.selectLatestScored(USER_ID)).thenReturn(null);
        ApiException notFound = assertThrows(ApiException.class, () -> service.expectedScore(USER_ID, null));
        assertEquals(HttpStatus.NOT_FOUND, notFound.getStatus());
        assertEquals("ASSESSMENT_NOT_FOUND", notFound.getCode());

        readyToScore(current());
        when(financialInput.load(USER_ID)).thenReturn(new FinancialInputResponse(null, null, null, List.of()));
        assertEquals("INPUT_INCOMPLETE", assertThrows(ApiException.class, () -> service.expectedScore(USER_ID, null)).getCode());
        verify(predictionClient, never()).score(any());
    }

    @Test
    @DisplayName("소득이 필요한 개월 수보다 적거나 같은 달이 겹치면 ML-03을 부르지 않고 409 INPUT_INCOMPLETE")
    @SuppressWarnings("unchecked")
    void incomeMonthsShort() {
        readyToScore(current());
        when(assembler.build(anyString(), eq("REAL-V1"), any(), eq("2026-08"), eq(31))).thenAnswer(invocation -> {
            Map<String, Object> request = request();
            ((Map<String, Object>) request.get("applicant")).put("requiredIncomeMonths", 12);
            return request;
        });

        ApiException e = assertThrows(ApiException.class, () -> service.expectedScore(USER_ID, null));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals("INPUT_INCOMPLETE", e.getCode());
        assertEquals("소득을 필요한 개월 수만큼 입력해 주세요.", e.getMessage());
        verify(predictionClient, never()).score(any());

        Map<String, Object> duplicated = request();
        ((List<Map<String, Object>>) duplicated.get("incomeMonths")).get(1).put("baseMonth", "2026-06");
        assertThrows(ApiException.class, () -> ExpectedScoreService.checkIncomeMonths(duplicated));
        ExpectedScoreService.checkIncomeMonths(request());   // 3개월·서로 다른 달이면 통과
    }

    @Test
    @DisplayName("ML-03 실패: 4xx(재시도 불가)는 400 INVALID_INPUT, 연결 실패·5xx는 503 MODEL_NOT_READY. 다시 부르지 않는다")
    void predictionFailure() {
        readyToScore(current());
        when(predictionClient.score(any())).thenThrow(new PredictionFailedException("HTTP 422", false));
        ApiException invalid = assertThrows(ApiException.class, () -> service.expectedScore(USER_ID, null));
        assertEquals(HttpStatus.BAD_REQUEST, invalid.getStatus());
        assertEquals("INVALID_INPUT", invalid.getCode());

        doThrow(new PredictionFailedException("ResourceAccessException", true)).when(predictionClient).score(any());
        ApiException notReady = assertThrows(ApiException.class, () -> service.expectedScore(USER_ID, null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, notReady.getStatus());
        assertEquals("MODEL_NOT_READY", notReady.getCode());
        verify(predictionClient, times(2)).score(any());
    }
}
