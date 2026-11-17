package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.CashFlowForecastRequest;
import com.baeksuescape.finance.dto.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.IncomeMonthRow;
import com.baeksuescape.finance.dto.IncomeVolatilityRequest;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.MonthlyIncomeItem;
import com.baeksuescape.finance.mapper.IncomeVolatilityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import com.baeksuescape.global.exception.ApiException;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * N-22·N-21 서비스 단위 테스트 (FP-183·FP-203). 계산 자체는 IncomeVolatilityCalculatorTest가 맡고,
 * 여기서는 요청 본문·저장 데이터를 계산 입력으로 바꾸는 부분을 본다. mapper는 가짜(Mockito)로 대신한다.
 */
class IncomeVolatilityServiceTest {

    private IncomeVolatilityService service;
    private IncomeVolatilityMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = mock(IncomeVolatilityMapper.class);
        service = new IncomeVolatilityService(mapper);
    }

    // =========================================================================
    // 요청 본문 기반 계산 (POST) — DB를 읽지 않으므로 mapper를 부르지 않는다
    // =========================================================================

    @Test
    @DisplayName("POST 진단: 본문의 월별 소득·고정지출로 계산하고, 본문이 없으면 빈 응답")
    void diagnoseIncomeVolatility_fromRequestBody() {
        IncomeVolatilityRequest request = IncomeVolatilityRequest.builder()
                .monthlyIncomes(List.of(
                        MonthlyIncomeItem.builder().yearMonth("2026-07").income(1000000L).build(),
                        MonthlyIncomeItem.builder().yearMonth("2026-08").income(3000000L).build()))
                .monthlyFixedExpense(2000000L)
                .build();

        IncomeVolatilityResponse response = service.diagnoseIncomeVolatility(request);

        assertEquals(2000000L, response.getMeanIncome());
        assertEquals(2000000L, response.getPeakOffPeakGap());
        assertTrue(response.isHasDeficitWarning(), "7월 소득 100만 < 고정지출 200만");
        assertEquals("2026-07", response.getNearestDeficitMonth());
        assertEquals(0L, service.diagnoseIncomeVolatility(null).getMeanIncome());
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("POST 전망: 과거 이력 마지막 달 다음부터 기간만큼, 기간이 0이면 6개월")
    void forecastCashFlow_fromRequestBody() {
        CashFlowForecastRequest request = CashFlowForecastRequest.builder()
                .past12MonthsHistory(List.of(
                        MonthlyIncomeItem.builder().yearMonth("2026-08").income(3000000L).expense(2000000L).build()))
                .baseMonthlyIncome(3000000L)
                .baseMonthlyFixedExpense(2000000L)
                .baseLoanMonthlyPayment(500000L)
                .forecastMonths(0)
                .build();

        CashFlowForecastResponse response = service.forecastCashFlow(request);

        assertEquals(6, response.getMonthlyForecasts().size());
        assertEquals("2026-09", response.getMonthlyForecasts().get(0).getForecastYearMonth());
        assertEquals(500000L, response.getMonthlyForecasts().get(0).getNetCashFlow());
        assertEquals(3000000L, response.getTotalAccumulatedSurplus());
        verifyNoInteractions(mapper);
    }

    // =========================================================================
    // [FP-203] 저장 데이터(DB) 기반 진단·전망 — mapper는 가짜(Mockito)로 대신한다
    // =========================================================================

    private IncomeMonthRow incomeRow(String yearMonth, long income, String kindCode) {
        IncomeMonthRow row = new IncomeMonthRow();
        row.setYearMonth(yearMonth);
        row.setIncome(income);
        row.setIncomeKindCode(kindCode);
        return row;
    }

    /** 시드 회원 2번(프리랜서)과 같은 12개월 소득 */
    private List<IncomeMonthRow> freelancerRows() {
        String[] months = {"2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
                "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"};
        long[] incomes = {1933611L, 1341079L, 3884117L, 1873023L, 2330585L, 2804640L,
                1619240L, 2715365L, 1616535L, 1327643L, 1686835L, 2061303L};
        List<IncomeMonthRow> rows = new java.util.ArrayList<>();
        for (int i = 0; i < months.length; i++) {
            rows.add(incomeRow(months[i], incomes[i], "MONTHLY_INCOME"));
        }
        return rows;
    }

    @Test
    @DisplayName("FP-203: 저장된 프리랜서 12개월 소득과 FIXED 고정지출로 변동성을 진단한다")
    void testDiagnoseSavedIncomeVolatility_Freelancer() {
        when(mapper.selectRecentIncomeMonths(2L)).thenReturn(freelancerRows());
        when(mapper.selectLatestFixedExpense(2L)).thenReturn(1315514L);

        IncomeVolatilityResponse response = service.diagnoseSavedIncomeVolatility(2L);

        assertEquals("2025-11", response.getPeakMonth());
        assertEquals(3884117L, response.getPeakIncome());
        assertEquals("2026-06", response.getOffPeakMonth());
        assertEquals(1327643L, response.getOffPeakIncome());
        // 정렬 후 가운데 두 값 1,873,023과 1,933,611의 평균
        assertEquals(1903317L, response.getMedianIncome());
        assertTrue(response.isHighVolatility(), "소득 편차가 커서 변동이 큼이어야 한다.");
        assertFalse(response.isHasDeficitWarning(), "모든 달 소득이 고정지출보다 커서 부족 달이 없어야 한다.");
    }

    @Test
    @DisplayName("FP-203: 급여소득자는 월급 1행을 마지막 기준월까지 12개월로 펼친다")
    void testDiagnoseSavedIncomeVolatility_SalaryExpandedTo12Months() {
        when(mapper.selectRecentIncomeMonths(1L))
                .thenReturn(List.of(incomeRow("2026-08", 2404634L, "SALARY")));
        when(mapper.selectLatestFixedExpense(1L)).thenReturn(1461547L);

        IncomeVolatilityResponse response = service.diagnoseSavedIncomeVolatility(1L);

        assertEquals(2404634L, response.getMeanIncome());
        assertEquals(2404634L, response.getMedianIncome());
        assertEquals(0.0, response.getIncomeCv(), "월급이 같으면 변동계수는 0이어야 한다.");
        assertEquals(0L, response.getPeakOffPeakGap());

        // 전망 이력도 12개월(2025-09 ~ 2026-08)이므로 전망은 2026-09부터 시작한다.
        when(mapper.selectLatestTotalExpense(1L)).thenReturn(1461547L);
        when(mapper.selectLatestLoanMonthlyPayment(1L)).thenReturn(0L);
        CashFlowForecastResponse forecast = service.forecastSavedCashFlow(1L, null);
        assertEquals("2026-09", forecast.getMonthlyForecasts().get(0).getForecastYearMonth());
    }

    @Test
    @DisplayName("FP-203: 저장된 소득이 없으면 404를 던진다")
    void testDiagnoseSavedIncomeVolatility_NoData_NotFound() {
        when(mapper.selectRecentIncomeMonths(999L)).thenReturn(Collections.emptyList());

        ApiException ex = assertThrows(ApiException.class,
                () -> service.diagnoseSavedIncomeVolatility(999L));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("NOT_FOUND", ex.getCode());
    }

    @Test
    @DisplayName("FP-203: 저장 데이터 전망은 12개월 평균 소득·지출 합계·원리금에 조건을 적용하고 마지막 입력월 다음 달부터 시작한다")
    void testForecastSavedCashFlow() {
        when(mapper.selectRecentIncomeMonths(2L)).thenReturn(freelancerRows());
        when(mapper.selectLatestTotalExpense(2L)).thenReturn(1315514L);
        when(mapper.selectLatestLoanMonthlyPayment(2L)).thenReturn(200000L);

        CashFlowConditionRequest condition = CashFlowConditionRequest.builder()
                .incomeChangePercent(-10.0)
                .forecastMonths(3)
                .build();
        CashFlowForecastResponse response = service.forecastSavedCashFlow(2L, condition);

        assertEquals(3, response.getMonthlyForecasts().size());
        assertEquals("2026-09", response.getMonthlyForecasts().get(0).getForecastYearMonth());
        // 12개월 평균 2,099,498원(합계 25,193,976원 ÷ 12)의 90% = 1,889,548원
        CashFlowForecastResponse.MonthlyForecastItem first = response.getMonthlyForecasts().get(0);
        assertEquals(1889548L, first.getForecastIncome());
        assertEquals(1315514L, first.getForecastExpense());
        assertEquals(200000L, first.getForecastLoanPayment());
        assertEquals(1889548L - 1315514L - 200000L, first.getNetCashFlow());
        assertEquals(3884117L - 1327643L, response.getPeakOffPeakGap(), "N-21-7은 N-22-4와 같은 격차여야 한다.");
    }
}
