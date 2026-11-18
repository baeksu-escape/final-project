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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    @DisplayName("POST 진단: 본문의 월별 소득·고정지출로 계산한다")
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
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("POST 진단: 본문이 없거나 월별 소득이 비어 있으면 400 INVALID_INPUT (field monthlyIncomes)")
    void diagnoseIncomeVolatility_emptyBody_badRequest() {
        assertInvalid(() -> service.diagnoseIncomeVolatility(null), "monthlyIncomes");
        assertInvalid(() -> service.diagnoseIncomeVolatility(IncomeVolatilityRequest.builder().build()), "monthlyIncomes");
        assertInvalid(() -> service.diagnoseIncomeVolatility(
                IncomeVolatilityRequest.builder().monthlyIncomes(List.of()).build()), "monthlyIncomes");
    }

    @Test
    @DisplayName("POST 전망: 본문이 없으면 400 INVALID_INPUT")
    void forecastCashFlow_nullBody_badRequest() {
        ApiException ex = assertThrows(ApiException.class, () -> service.forecastCashFlow(null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_INPUT", ex.getCode());
    }

    @Test
    @DisplayName("N-21-2 예측 기간: 3·6·12만 받고 그 밖의 값(1·7·24·1000·-1)은 400 (field forecastMonths)")
    void forecastMonths_onlyThreeSixTwelve() {
        for (int months : new int[] {3, 6, 12}) {
            CashFlowForecastResponse response = service.forecastCashFlow(forecastRequest(months));
            assertEquals(months, response.getMonthlyForecasts().size());
        }
        for (int months : new int[] {1, 7, 24, 1000, -1}) {
            assertInvalid(() -> service.forecastCashFlow(forecastRequest(months)), "forecastMonths");
        }
    }

    @Test
    @DisplayName("N-21-2 예측 기간: 저장 데이터 전망(GET)도 같은 규칙 — 1000개월이면 400이고 DB를 읽기 전에 막는다")
    void forecastSavedCashFlow_invalidMonths_badRequest() {
        CashFlowConditionRequest condition = CashFlowConditionRequest.builder().forecastMonths(1000).build();

        assertInvalid(() -> service.forecastSavedCashFlow(2L, condition), "forecastMonths");
        verifyNoInteractions(mapper);
    }

    /** 1개월 이력 + 기준값으로 예측 기간만 바꿔 보는 POST 전망 요청 */
    private CashFlowForecastRequest forecastRequest(int forecastMonths) {
        return CashFlowForecastRequest.builder()
                .past12MonthsHistory(List.of(MonthlyIncomeItem.builder().yearMonth("2026-08").income(3000000L).build()))
                .baseMonthlyIncome(3000000L)
                .baseMonthlyFixedExpense(2000000L)
                .forecastMonths(forecastMonths)
                .build();
    }

    /** 400 INVALID_INPUT이고 fieldErrors 첫 칸이 field인지 확인한다 */
    private void assertInvalid(org.junit.jupiter.api.function.Executable call, String field) {
        ApiException ex = assertThrows(ApiException.class, call);
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("INVALID_INPUT", ex.getCode());
        assertEquals(field, ex.getFieldErrors().get(0).field());
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

        // N-21-9 과거 월 실적도 서버가 월급을 12개월로 펼쳐서 준다(2025-09 ~ 2026-08, 매달 같은 월급·지출 합계).
        assertEquals(12, forecast.getMonths().size());
        assertEquals("2025-09", forecast.getMonths().get(0).getBaseMonth());
        assertEquals("2026-08", forecast.getMonths().get(11).getBaseMonth());
        assertTrue(forecast.getMonths().stream().allMatch(m -> m.getIncomeAmount() == 2404634L && m.getExpenseAmount() == 1461547L));
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

        // 고정지출을 따로 보내지 않았으므로 저장된 고정지출(FIXED)은 읽지 않는다.
        verify(mapper, never()).selectLatestFixedExpense(2L);

        // N-21-9 과거 월 실적: 저장된 12개월 소득 그대로, 지출은 월 지출 합계(매달 같은 값)
        assertEquals(12, response.getMonths().size());
        assertEquals("2025-09", response.getMonths().get(0).getBaseMonth());
        assertEquals(1933611L, response.getMonths().get(0).getIncomeAmount());
        assertEquals(1315514L, response.getMonths().get(0).getExpenseAmount());
        assertEquals("2026-08", response.getMonths().get(11).getBaseMonth());
        assertEquals(2061303L, response.getMonths().get(11).getIncomeAmount());
    }

    @Test
    @DisplayName("N-21-2 화면 조건: 소득 변동 폭 100%면 과거 같은 달 소득, 고정지출을 보내면 FIXED 자리만 그 값으로 바꾼다")
    void testForecastSavedCashFlow_screenConditions() {
        when(mapper.selectRecentIncomeMonths(2L)).thenReturn(freelancerRows());
        when(mapper.selectLatestTotalExpense(2L)).thenReturn(1500000L);   // 고정 1,315,514 + 기타 184,486
        when(mapper.selectLatestFixedExpense(2L)).thenReturn(1315514L);
        when(mapper.selectLatestLoanMonthlyPayment(2L)).thenReturn(200000L);

        CashFlowConditionRequest condition = CashFlowConditionRequest.builder()
                .forecastMonths(3)
                .incomeVariationPct(100)
                .fixedExpenseAmount(1000000L)
                .paymentStatus("DELAYED")
                .build();
        CashFlowForecastResponse response = service.forecastSavedCashFlow(2L, condition);

        // 전망 2026-09·10·11 → 과거 2025-09·10·11 소득 그대로(변동 폭 100%)
        assertEquals(1933611L, response.getMonthlyForecasts().get(0).getForecastIncome());
        assertEquals(1341079L, response.getMonthlyForecasts().get(1).getForecastIncome());
        assertEquals(3884117L, response.getMonthlyForecasts().get(2).getForecastIncome());
        // 월 지출 = 입력 고정지출 100만 + (지출 합계 150만 − 저장 고정지출 1,315,514) = 1,184,486
        assertEquals(1184486L, response.getMonthlyForecasts().get(0).getForecastExpense());
        // 과거 실적의 지출은 저장값(월 지출 합계) 그대로다.
        assertEquals(1500000L, response.getMonths().get(0).getExpenseAmount());
    }

    @Test
    @DisplayName("N-21-2 화면 조건 범위 밖이면 400 INVALID_INPUT이고 DB를 읽기 전에 막는다")
    void testForecastSavedCashFlow_invalidScreenConditions() {
        assertInvalid(() -> service.forecastSavedCashFlow(2L,
                CashFlowConditionRequest.builder().incomeVariationPct(201).build()), "incomeVariationPct");
        assertInvalid(() -> service.forecastSavedCashFlow(2L,
                CashFlowConditionRequest.builder().incomeVariationPct(-1).build()), "incomeVariationPct");
        assertInvalid(() -> service.forecastSavedCashFlow(2L,
                CashFlowConditionRequest.builder().fixedExpenseAmount(-1L).build()), "fixedExpenseAmount");
        assertInvalid(() -> service.forecastSavedCashFlow(2L,
                CashFlowConditionRequest.builder().paymentStatus("LATE").build()), "paymentStatus");
        verifyNoInteractions(mapper);
    }
}
