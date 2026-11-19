package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.cashflow.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.cashflow.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.cashflow.ExpectedScoreResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityResponse;
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

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
 * FP-203 저장 데이터 기반 GET API의 경로·쿼리·JSON 필드 이름과 로그인 회원 확인(토큰 없으면 401, 주소의 userId 무시)을 보는 웹 계층 테스트.
 * 문서(docs/spec/api/api_spec_c.md)에 적은 필드 이름이 실제 응답과 같은지 여기서 고정한다.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 다른 팀 API 테스트처럼 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IncomeVolatilityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IncomeVolatilityService incomeVolatilityService;

    @MockBean
    private ExpectedScoreService expectedScoreService;

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

    @Test
    @DisplayName("GET /api/diagnosis/income-volatility: 불리언 필드는 is 없이 highVolatility로 나간다")
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

        mockMvc.perform(loggedIn(get("/api/diagnosis/income-volatility"), 2L))
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
    @DisplayName("GET /api/diagnosis/income-volatility: 저장된 소득이 없으면 404")
    void getIncomeVolatility_notFound() throws Exception {
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(999L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "저장된 소득 데이터가 없습니다."));

        mockMvc.perform(loggedIn(get("/api/diagnosis/income-volatility"), 999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("GET 저장 데이터 API 2개: 토큰이 없으면 401 UNAUTHORIZED이고 조회하지 않는다")
    void savedDataApis_withoutToken_unauthorized() throws Exception {
        mockMvc.perform(get("/api/diagnosis/income-volatility").param("userId", "2"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(get("/api/diagnosis/cash-flow/forecast").param("userId", "2"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(incomeVolatilityService);
    }

    @Test
    @DisplayName("GET /api/diagnosis/cash-flow/forecast: 예측 기간이 3·6·12가 아니면 400, fieldErrors에 forecastMonths")
    void getCashFlowForecast_invalidMonths_badRequest() throws Exception {
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "예측 기간은 3·6·12개월 중 하나여야 합니다.",
                        List.of(new ErrorResponse.FieldErrorItem("forecastMonths", "예측 기간은 3·6·12개월 중 하나여야 합니다."))));

        mockMvc.perform(loggedIn(get("/api/diagnosis/cash-flow/forecast").param("forecastMonths", "1000"), 2L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("forecastMonths"));
    }

    @Test
    @DisplayName("GET /api/diagnosis/income-volatility: 주소에 다른 userId를 붙여도 토큰의 회원으로만 조회한다")
    void getIncomeVolatility_ignoresUserIdQuery() throws Exception {
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(2L))
                .thenReturn(IncomeVolatilityResponse.builder().meanIncome(2099498L).build());

        mockMvc.perform(loggedIn(get("/api/diagnosis/income-volatility").param("userId", "3"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meanIncome").value(2099498));

        verify(incomeVolatilityService).diagnoseSavedIncomeVolatility(2L);
        verify(incomeVolatilityService, never()).diagnoseSavedIncomeVolatility(3L);
    }

    @Test
    @DisplayName("GET /api/diagnosis/cash-flow/forecast: 쿼리 조건이 전달되고 deficit 필드로 나간다")
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
                .build();
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any())).thenReturn(response);

        mockMvc.perform(loggedIn(get("/api/diagnosis/cash-flow/forecast")
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
                .andExpect(jsonPath("$.months[0].expenseAmount").value(1315514));

        ArgumentCaptor<CashFlowConditionRequest> captor = ArgumentCaptor.forClass(CashFlowConditionRequest.class);
        verify(incomeVolatilityService).forecastSavedCashFlow(eq(2L), captor.capture());
        assertEquals(-10.0, captor.getValue().getIncomeChangePercent());
        assertEquals(3, captor.getValue().getForecastMonths());
        assertEquals(null, captor.getValue().getIncomeVariationPct(), "보내지 않은 화면 조건은 null(생략)");
    }

    @Test
    @DisplayName("GET /api/diagnosis/cash-flow/forecast: N-21-2 화면 조건 쿼리(incomeVariationPct·fixedExpenseAmount·paymentStatus)가 전달된다")
    void getCashFlowForecast_screenConditionQueries() throws Exception {
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any()))
                .thenReturn(CashFlowForecastResponse.builder().monthlyForecasts(List.of()).build());

        mockMvc.perform(loggedIn(get("/api/diagnosis/cash-flow/forecast")
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
    @DisplayName("POST /api/diagnosis/cash-flow/expected-score (DIAG-09): 토큰 없으면 401, 본문 조건이 전달되고 JSON 필드 이름이 고정된다")
    void postExpectedScore() throws Exception {
        mockMvc.perform(post("/api/diagnosis/cash-flow/expected-score")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(expectedScoreService);

        when(expectedScoreService.expectedScore(eq(2L), any())).thenReturn(new ExpectedScoreResponse(588, "CAUTION", 571,
                "CAUTION", -17, "LGBM-BASE-0.1", "DEV-DUMMY", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", false));

        mockMvc.perform(loggedIn(post("/api/diagnosis/cash-flow/expected-score")
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
