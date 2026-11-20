package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.cashflow.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.cashflow.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.cashflow.ExpectedScoreResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareBaseResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationRequest;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse;
import com.baeksuescape.finance.service.CreditCareSimulationService;
import com.baeksuescape.finance.service.ExpectedScoreService;
import com.baeksuescape.finance.service.IncomeVolatilityService;
import org.springframework.http.MediaType;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-170·FP-203 /api/members/me 아래 저장 데이터 API 5개(SIM-01·02, DIAG-07-1·08-1·09)의 경로·쿼리·JSON 필드 이름과
 * 보안 설정(토큰 없음 401, 관리자 403, 주소의 userId 무시)을 보는 웹 계층 테스트.
 * 문서(docs/spec/api/api_spec_c.md)에 적은 필드 이름이 실제 응답과 같은지 여기서 고정한다.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 다른 팀 API 테스트처럼 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MemberFinanceControllerTest {

    private static final String CREDIT_CARE_BASE = "/api/members/me/credit-care-base";
    private static final String CREDIT_CARE_RECALCULATE = "/api/members/me/credit-care-recalculate";
    private static final String INCOME_VOLATILITY = "/api/members/me/income-volatility";
    private static final String CASH_FLOW_FORECAST = "/api/members/me/cash-flow-forecast";
    private static final String EXPECTED_SCORE = "/api/members/me/cash-flow-expected-score";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IncomeVolatilityService incomeVolatilityService;

    @MockBean
    private ExpectedScoreService expectedScoreService;

    @MockBean
    private CreditCareSimulationService creditCareSimulationService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUp() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    // 회원 번호 userId로 로그인한 요청 — 실제와 같은 Authorization: Bearer 토큰을 붙인다.
    private MockHttpServletRequestBuilder loggedIn(MockHttpServletRequestBuilder builder, long userId) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(userId, "ROLE_USER"));
    }

    // 관리자 토큰을 붙인 요청 — /api/members/me/**는 ROLE_USER 전용이라 403이어야 한다.
    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN"));
    }

    // 5개 API 요청 (POST는 빈 JSON 본문)
    private List<MockHttpServletRequestBuilder> allApis() {
        return List.of(
                get(CREDIT_CARE_BASE),
                post(CREDIT_CARE_RECALCULATE).contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{}}"),
                get(INCOME_VOLATILITY),
                get(CASH_FLOW_FORECAST),
                post(EXPECTED_SCORE).contentType(MediaType.APPLICATION_JSON).content("{}"));
    }

    @Test
    @DisplayName("5개 API 모두 토큰이 없으면 보안 설정이 401 UNAUTHORIZED를 내고 서비스를 부르지 않는다")
    void allApis_withoutToken_unauthorized() throws Exception {
        for (MockHttpServletRequestBuilder request : allApis()) {
            mockMvc.perform(request)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        }
        verifyNoInteractions(incomeVolatilityService, expectedScoreService, creditCareSimulationService);
    }

    @Test
    @DisplayName("5개 API 모두 관리자 토큰이면 403 FORBIDDEN이고 서비스를 부르지 않는다 (/api/members/me/**는 ROLE_USER 전용)")
    void allApis_admin_forbidden() throws Exception {
        for (MockHttpServletRequestBuilder request : allApis()) {
            mockMvc.perform(asAdmin(request))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
        verifyNoInteractions(incomeVolatilityService, expectedScoreService, creditCareSimulationService);
    }

    @Test
    @DisplayName("SIM-01: 입력 10개 값은 values 아래 ML-04 키 이름으로, 감점 요인은 SIM-02와 같은 모양으로 나가고 피처값 전체는 없다")
    void getCreditCareBase() throws Exception {
        Map<String, Long> values = new LinkedHashMap<>();
        values.put("TELECOM_ON_TIME_MONTHS", 8L);
        values.put("CARD_LIMIT_AMT", null);
        when(creditCareSimulationService.base(2L)).thenReturn(new CreditCareBaseResponse(
                "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", null, 588, "CAUTION", values,
                List.of(new CreditCareSimulationResponse.ReductionFactor(1, "DQ1200001", "연체 건수", 1.0, -20, null))));

        mockMvc.perform(loggedIn(get(CREDIT_CARE_BASE), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseRequestId").value("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"))
                .andExpect(jsonPath("$.score").value(588))
                .andExpect(jsonPath("$.gradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.values.TELECOM_ON_TIME_MONTHS").value(8))
                .andExpect(jsonPath("$.values.CARD_LIMIT_AMT").value(nullValue()))
                .andExpect(jsonPath("$.topReductionFactors[0].rank").value(1))
                .andExpect(jsonPath("$.topReductionFactors[0].featureCode").value("DQ1200001"))
                .andExpect(jsonPath("$.topReductionFactors[0].featureName").value("연체 건수"))
                .andExpect(jsonPath("$.topReductionFactors[0].featureValue").value(1.0))
                .andExpect(jsonPath("$.topReductionFactors[0].shapScore").value(-20))
                .andExpect(jsonPath("$.topReductionFactors[0].recoverScore").value(nullValue()))
                .andExpect(jsonPath("$.featureSnapshot").doesNotExist());
    }

    @Test
    @DisplayName("SIM-02: changes가 서비스로 전달되고 응답 필드 이름(before·after·delta·topReductionFactors)이 고정된다")
    void recalculateCreditCare() throws Exception {
        when(creditCareSimulationService.recalculate(eq(2L), any())).thenReturn(new CreditCareSimulationResponse(
                "DEV-DUMMY", "CUT-0.1",
                new CreditCareSimulationResponse.ScoreSummary(588, "CAUTION", 0.21),
                new CreditCareSimulationResponse.ScoreSummary(618, "CAUTION", 0.18),
                new CreditCareSimulationResponse.Delta(30, 16, 14),
                List.of(new CreditCareSimulationResponse.ReductionFactor(1, "CL0631905", "카드 한도 사용률", 60.0, -12, 12))));

        mockMvc.perform(loggedIn(post(CREDIT_CARE_RECALCULATE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"changes\":{\"TELECOM_ON_TIME_MONTHS\":12,\"DELINQ_COUNT_12M\":null}}"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.before.score").value(588))
                .andExpect(jsonPath("$.after.gradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.delta.financialEffect").value(16))
                .andExpect(jsonPath("$.delta.alternativeEffect").value(14))
                .andExpect(jsonPath("$.topReductionFactors[0].featureName").value("카드 한도 사용률"))
                .andExpect(jsonPath("$.topReductionFactors[0].recoverScore").value(12))
                .andExpect(jsonPath("$.requestId").doesNotExist())
                .andExpect(jsonPath("$.shap").doesNotExist());

        ArgumentCaptor<CreditCareSimulationRequest> captor = ArgumentCaptor.forClass(CreditCareSimulationRequest.class);
        verify(creditCareSimulationService).recalculate(eq(2L), captor.capture());
        assertEquals(12, captor.getValue().changes().get("TELECOM_ON_TIME_MONTHS"));
        assertTrue(captor.getValue().changes().containsKey("DELINQ_COUNT_12M"));
    }

    @Test
    @DisplayName("SIM-02: 서비스의 400(changes.<키>)·404·503이 공통 오류 형식으로 나간다")
    void recalculateErrors() throws Exception {
        when(creditCareSimulationService.recalculate(eq(2L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.",
                        List.of(new ErrorResponse.FieldErrorItem("changes.DELINQ_COUNT12M", "모르는 항목입니다."))))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다."))
                .thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MODEL_NOT_READY",
                        "점수 계산 서버가 준비 중입니다. 잠시 후 다시 시도해 주세요."));

        mockMvc.perform(loggedIn(post(CREDIT_CARE_RECALCULATE)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{\"DELINQ_COUNT12M\":1}}"), 2L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("changes.DELINQ_COUNT12M"));
        mockMvc.perform(loggedIn(post(CREDIT_CARE_RECALCULATE)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{}}"), 2L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ASSESSMENT_NOT_FOUND"));
        mockMvc.perform(loggedIn(post(CREDIT_CARE_RECALCULATE)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{}}"), 2L))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("MODEL_NOT_READY"));
    }

    @Test
    @DisplayName("DIAG-07-1:불리언 필드는 is 없이 highVolatility로 나간다")
    void getIncomeVolatility_jsonFieldNames() throws Exception {
        IncomeVolatilityResponse response = IncomeVolatilityResponse.builder()
                .meanIncome(2099498L)
                .medianIncome(1903317L)
                .incomeCv(33.68)
                .standardDeviation(707118.75)
                .isHighVolatility(true)
                .peakMonth("2025-11")
                .hasDeficitWarning(false)
                .deficitMonths(List.of())
                .build();
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(2L)).thenReturn(response);

        mockMvc.perform(loggedIn(get(INCOME_VOLATILITY), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meanIncome").value(2099498))
                .andExpect(jsonPath("$.medianIncome").value(1903317))
                .andExpect(jsonPath("$.highVolatility").value(true))
                .andExpect(jsonPath("$.standardDeviation").value(707118.75))
                .andExpect(jsonPath("$.isHighVolatility").doesNotExist())
                .andExpect(jsonPath("$.hasDeficitWarning").value(false))
                .andExpect(jsonPath("$.peakMonth").value("2025-11"));
    }

    @Test
    @DisplayName("DIAG-07-1:저장된 소득이 없으면 404")
    void getIncomeVolatility_notFound() throws Exception {
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(999L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "저장된 소득 데이터가 없습니다."));

        mockMvc.perform(loggedIn(get(INCOME_VOLATILITY), 999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("DIAG-08-1:예측 기간이 3·6·12가 아니면 400, fieldErrors에 forecastMonths")
    void getCashFlowForecast_invalidMonths_badRequest() throws Exception {
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "예측 기간은 3·6·12개월 중 하나여야 합니다.",
                        List.of(new ErrorResponse.FieldErrorItem("forecastMonths", "예측 기간은 3·6·12개월 중 하나여야 합니다."))));

        mockMvc.perform(loggedIn(get(CASH_FLOW_FORECAST).param("forecastMonths", "1000"), 2L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("forecastMonths"));
    }

    @Test
    @DisplayName("DIAG-07-1:주소에 다른 userId를 붙여도 토큰의 회원으로만 조회한다")
    void getIncomeVolatility_ignoresUserIdQuery() throws Exception {
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(2L))
                .thenReturn(IncomeVolatilityResponse.builder().meanIncome(2099498L).build());

        mockMvc.perform(loggedIn(get(INCOME_VOLATILITY).param("userId", "3"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meanIncome").value(2099498));

        verify(incomeVolatilityService).diagnoseSavedIncomeVolatility(2L);
        verify(incomeVolatilityService, never()).diagnoseSavedIncomeVolatility(3L);
    }

    @Test
    @DisplayName("DIAG-08-1:쿼리 조건이 전달되고 deficit 필드로 나간다")
    void getCashFlowForecast_conditionAndFieldNames() throws Exception {
        CashFlowForecastResponse response = CashFlowForecastResponse.builder()
                .pastDeficitMonthsCount(0)
                .monthlyForecasts(List.of(CashFlowForecastResponse.MonthlyForecastItem.builder()
                        .forecastYearMonth("2026-09")
                        .netCashFlow(-10000L)
                        .isDeficit(true)
                        .build()))
                .worstForecastMonth("2026-09")
                .months(List.of(CashFlowForecastResponse.PastMonthItem.builder()
                        .baseMonth("2026-08")
                        .incomeAmount(2061303L)
                        .expenseAmount(1315514L)
                        .build()))
                .baseFixedExpenseAmount(1100000L)
                .baseOtherExpenseAmount(215514L)
                .baseMonthlyLoanPayment(200000L)
                .build();
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any())).thenReturn(response);

        mockMvc.perform(loggedIn(get(CASH_FLOW_FORECAST)
                        .param("incomeChangePercent", "-10")
                        .param("forecastMonths", "3"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyForecasts[0].forecastYearMonth").value("2026-09"))
                .andExpect(jsonPath("$.monthlyForecasts[0].deficit").value(true))
                .andExpect(jsonPath("$.monthlyForecasts[0].isDeficit").doesNotExist())
                .andExpect(jsonPath("$.worstForecastMonth").value("2026-09"))
                // N-21-9 과거 월 실적 — 화면 adapter와 맞춘 이름
                .andExpect(jsonPath("$.months[0].baseMonth").value("2026-08"))
                .andExpect(jsonPath("$.months[0].incomeAmount").value(2061303))
                .andExpect(jsonPath("$.months[0].expenseAmount").value(1315514))
                // N-21-1·2 기준값 3개 (FP-170 11/19, 경환 님 요청)
                .andExpect(jsonPath("$.baseFixedExpenseAmount").value(1100000))
                .andExpect(jsonPath("$.baseOtherExpenseAmount").value(215514))
                .andExpect(jsonPath("$.baseMonthlyLoanPayment").value(200000));

        ArgumentCaptor<CashFlowConditionRequest> captor = ArgumentCaptor.forClass(CashFlowConditionRequest.class);
        verify(incomeVolatilityService).forecastSavedCashFlow(eq(2L), captor.capture());
        assertEquals(-10.0, captor.getValue().getIncomeChangePercent());
        assertEquals(3, captor.getValue().getForecastMonths());
        assertEquals(null, captor.getValue().getIncomeVariationPct(), "보내지 않은 화면 조건은 null(생략)");
    }

    @Test
    @DisplayName("DIAG-08-1:N-21-2 화면 조건 쿼리(incomeVariationPct·fixedExpenseAmount·paymentStatus)가 전달된다")
    void getCashFlowForecast_screenConditionQueries() throws Exception {
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any()))
                .thenReturn(CashFlowForecastResponse.builder().monthlyForecasts(List.of()).build());

        mockMvc.perform(loggedIn(get(CASH_FLOW_FORECAST)
                        .param("forecastMonths", "6")
                        .param("incomeVariationPct", "100")
                        .param("fixedExpenseAmount", "1000000")
                        .param("paymentStatus", "ON_TIME"), 2L))
                .andExpect(status().isOk());

        ArgumentCaptor<CashFlowConditionRequest> captor = ArgumentCaptor.forClass(CashFlowConditionRequest.class);
        verify(incomeVolatilityService).forecastSavedCashFlow(eq(2L), captor.capture());
        assertEquals(100, captor.getValue().getIncomeVariationPct());
        assertEquals(1000000L, captor.getValue().getFixedExpenseAmount());
        assertEquals("ON_TIME", captor.getValue().getPaymentStatus());
    }

    @Test
    @DisplayName("DIAG-09: 본문 조건이 전달되고 JSON 필드 이름이 고정된다")
    void postExpectedScore() throws Exception {
        when(expectedScoreService.expectedScore(eq(2L), any())).thenReturn(new ExpectedScoreResponse(588, "CAUTION", 571,
                "CAUTION", -17, "LGBM-BASE-0.1", "DEV-DUMMY", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", false));

        mockMvc.perform(loggedIn(post(EXPECTED_SCORE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"incomeVariationPct\":0,\"incomeChangePercent\":-10,\"fixedExpenseAmount\":500000,"
                                + "\"paymentStatus\":\"DELAYED\"}"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentScore").value(588))
                .andExpect(jsonPath("$.expectedScore").value(571))
                .andExpect(jsonPath("$.expectedGradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.scoreDiff").value(-17))
                .andExpect(jsonPath("$.modelVersion").value("LGBM-BASE-0.1"))
                .andExpect(jsonPath("$.baseModelVersion").value("DEV-DUMMY"))
                .andExpect(jsonPath("$.baseRequestId").value("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"))
                .andExpect(jsonPath("$.paymentStatusApplied").value(false));

        ArgumentCaptor<CashFlowConditionRequest> captor = ArgumentCaptor.forClass(CashFlowConditionRequest.class);
        verify(expectedScoreService).expectedScore(eq(2L), captor.capture());
        assertEquals(0, captor.getValue().getIncomeVariationPct());
        assertEquals(-10.0, captor.getValue().getIncomeChangePercent());
        assertEquals(500000L, captor.getValue().getFixedExpenseAmount());
        assertEquals("DELAYED", captor.getValue().getPaymentStatus());
    }
}
