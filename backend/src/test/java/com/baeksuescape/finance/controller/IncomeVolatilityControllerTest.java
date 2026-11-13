package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse;
import com.baeksuescape.finance.service.IncomeVolatilityService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-203 저장 데이터 기반 GET API의 경로·쿼리·JSON 필드 이름을 확인하는 웹 계층 테스트.
 * 문서(api_spec.md)에 적은 필드 이름이 실제 응답과 같은지 여기서 고정한다.
 */
@WebMvcTest(IncomeVolatilityController.class)
class IncomeVolatilityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IncomeVolatilityService incomeVolatilityService;

    @Test
    @DisplayName("GET /api/diagnosis/income-volatility: 불리언 필드는 is 없이 highVolatility로 나간다")
    void getIncomeVolatility_jsonFieldNames() throws Exception {
        IncomeVolatilityResponse response = IncomeVolatilityResponse.builder()
                .meanIncome(2099498L)
                .medianIncome(1903317L)
                .incomeCv(33.68)
                .isHighVolatility(true)
                .peakMonth("2025-11")
                .hasDeficitWarning(false)
                .deficitMonths(List.of())
                .build();
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(2L)).thenReturn(response);

        mockMvc.perform(get("/api/diagnosis/income-volatility").param("userId", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meanIncome").value(2099498))
                .andExpect(jsonPath("$.medianIncome").value(1903317))
                .andExpect(jsonPath("$.highVolatility").value(true))
                .andExpect(jsonPath("$.isHighVolatility").doesNotExist())
                .andExpect(jsonPath("$.hasDeficitWarning").value(false))
                .andExpect(jsonPath("$.peakMonth").value("2025-11"));
    }

    @Test
    @DisplayName("GET /api/diagnosis/income-volatility: 저장된 소득이 없으면 404")
    void getIncomeVolatility_notFound() throws Exception {
        when(incomeVolatilityService.diagnoseSavedIncomeVolatility(999L))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "저장된 소득 데이터가 없습니다."));

        mockMvc.perform(get("/api/diagnosis/income-volatility").param("userId", "999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/diagnosis/income-volatility: userId가 없으면 400")
    void getIncomeVolatility_missingUserId() throws Exception {
        mockMvc.perform(get("/api/diagnosis/income-volatility"))
                .andExpect(status().isBadRequest());
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
                .build();
        when(incomeVolatilityService.forecastSavedCashFlow(eq(2L), any())).thenReturn(response);

        mockMvc.perform(get("/api/diagnosis/cash-flow/forecast")
                        .param("userId", "2")
                        .param("incomeChangePercent", "-10")
                        .param("forecastMonths", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyForecasts[0].forecastYearMonth").value("2026-09"))
                .andExpect(jsonPath("$.monthlyForecasts[0].deficit").value(true))
                .andExpect(jsonPath("$.monthlyForecasts[0].isDeficit").doesNotExist())
                .andExpect(jsonPath("$.worstForecastMonth").value("2026-09"));

        ArgumentCaptor<CashFlowConditionRequest> captor = ArgumentCaptor.forClass(CashFlowConditionRequest.class);
        verify(incomeVolatilityService).forecastSavedCashFlow(eq(2L), captor.capture());
        assertEquals(-10.0, captor.getValue().getIncomeChangePercent());
        assertEquals(3, captor.getValue().getForecastMonths());
    }
}
