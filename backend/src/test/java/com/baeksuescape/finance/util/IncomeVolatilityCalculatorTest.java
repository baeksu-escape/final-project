package com.baeksuescape.finance.util;

import com.baeksuescape.finance.dto.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.MonthlyIncomeItem;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * N-22 소득 변동성 및 N-21 현금흐름 순수 계산 유틸리티 단위 테스트.
 */
class IncomeVolatilityCalculatorTest {

    private List<MonthlyIncomeItem> createSample12Months() {
        List<MonthlyIncomeItem> list = new ArrayList<>();
        // 2025-09 ~ 2026-08 (12개월)
        long[] incomes = {
                3000000L, 3200000L, 3500000L, 3800000L, // 2025-09 ~ 2025-12
                1500000L, 2000000L, 3000000L, 4000000L, // 2026-01 ~ 2026-04 (1월 최저 150만원)
                4500000L, 4200000L, 5000000L, 3300000L  // 2026-05 ~ 2026-08 (7월 최고 500만원)
        };
        String[] months = {
                "2025-09", "2025-10", "2025-11", "2025-12",
                "2026-01", "2026-02", "2026-03", "2026-04",
                "2026-05", "2026-06", "2026-07", "2026-08"
        };
        for (int i = 0; i < 12; i++) {
            list.add(MonthlyIncomeItem.builder()
                    .yearMonth(months[i])
                    .income(incomes[i])
                    .expense(2000000L) // 고정 지출 200만원
                    .build());
        }
        return list;
    }

    @Test
    @DisplayName("N-22-4 & N-21-7 성수기·비수기 소득 격차 계산 검증")
    void testCalculatePeakOffPeakGap() {
        List<MonthlyIncomeItem> items = createSample12Months();
        IncomeVolatilityCalculator.PeakOffPeakResult result = IncomeVolatilityCalculator.calculatePeakOffPeakGap(items);

        assertEquals(5000000L, result.peakIncome, "최고 소득은 500만원이어야 한다.");
        assertEquals("2026-07", result.peakMonth, "최고 소득 달은 2026-07이어야 한다.");
        assertEquals(1500000L, result.offPeakIncome, "최저 소득은 150만원이어야 한다.");
        assertEquals("2026-01", result.offPeakMonth, "최저 소득 달은 2026-01이어야 한다.");
        assertEquals(3500000L, result.gap, "성수기·비수기 격차는 350만원이어야 한다.");
    }

    @Test
    @DisplayName("N-22-3 변동성 지표 계산 및 12% 초과 판정 검증")
    void testCalculateVolatilityIndicators() {
        List<MonthlyIncomeItem> items = createSample12Months();
        long fixedExpense = 2000000L;

        IncomeVolatilityResponse response = IncomeVolatilityCalculator.calculateVolatility(items, fixedExpense);

        assertNotNull(response);
        assertTrue(response.getMeanIncome() > 0, "평균 소득은 0보다 커야 한다.");
        assertTrue(response.getIncomeCv() > 12.0, "소득 변동계수(CV)가 12%를 초과해야 한다.");
        assertTrue(response.isHighVolatility(), "변동이 큼 배지가 true여야 한다.");
        assertEquals(0, response.getZeroIncomeMonthsCount(), "소득 0원인 달은 없어야 한다.");
        assertEquals(3500000L, response.getPeakOffPeakGap(), "N-22-4 성수기/비수기 격차가 응답에 포함되어야 한다.");
    }

    @Test
    @DisplayName("N-22-5 소득 부족 달 확인 및 다음 비수기 도래 개월 수 검증")
    void testEvaluateDeficitMonths() {
        List<MonthlyIncomeItem> items = createSample12Months();
        long fixedExpense = 2000000L;
        YearMonth lastMonth = YearMonth.of(2026, 8); // 마지막 입력월 8월

        // 1월 소득이 150만원으로 고정지출 200만원보다 적음 (부족액 50만원)
        // 8월 기준으로 1월은 5개월 뒤 (9, 10, 11, 12, 1)
        com.baeksuescape.finance.dto.DeficitMonthsResult result =
                IncomeVolatilityCalculator.calculateDeficitMonthsWithTimeline(
                        items, java.math.BigDecimal.valueOf(fixedExpense), lastMonth);

        assertTrue(result.isHasDeficitWarning(), "소득 부족 달 경고가 발생해야 한다.");
        assertEquals(1, result.getDeficitMonthsCount(), "소득 부족 달은 1건이어야 한다.");

        com.baeksuescape.finance.dto.DeficitMonthsResult.DeficitMonthDetail item = result.getDeficitItems().get(0);
        assertEquals("2026-01", item.getMonthIdentifier());
        assertEquals(0, new java.math.BigDecimal("500000").compareTo(item.getShortfallAmount()), "모자란 금액은 50만원이어야 한다.");
        assertEquals(5, item.getMonthsUntilNext(), "8월 기준 1월은 5개월 뒤에 돌아와야 한다.");

        assertEquals(5, result.getMonthsUntilNearest());
        assertEquals(0, new java.math.BigDecimal("500000").compareTo(result.getRecommendedReserveAmount()));
    }

    @Test
    @DisplayName("N-21-6 최근 12개월 적자 개월 수 계산 검증")
    void testCountPastDeficitMonths() {
        List<MonthlyIncomeItem> items = createSample12Months();
        // 지출이 200만원인데 1월 소득만 150만원이므로 적자 달은 1개월
        int count = IncomeVolatilityCalculator.countPastDeficitMonths(items);
        assertEquals(1, count, "적자 달 수는 1개월이어야 한다.");
    }

    @Test
    @DisplayName("N-21-5 기간별 현금흐름 전망 검증")
    void testForecastCashFlow() {
        List<MonthlyIncomeItem> history = createSample12Months();
        long baseIncome = 3500000L;
        long baseExpense = 1500000L;
        long baseLoan = 500000L;

        CashFlowForecastResponse response = IncomeVolatilityCalculator.forecastCashFlow(
                history, baseIncome, baseExpense, baseLoan,
                -10.0, 5.0, 0.0, 6, YearMonth.of(2026, 9)
        );

        assertNotNull(response);
        assertEquals(6, response.getMonthlyForecasts().size(), "6개월 전망 목록이 생성되어야 한다.");
        assertEquals(1, response.getPastDeficitMonthsCount(), "과거 적자 개월 수는 1개여야 한다.");
        assertEquals(3500000L, response.getPeakOffPeakGap(), "N-21-7 성수기/비수기 격차가 일치해야 한다.");
        assertTrue(response.getTotalAccumulatedSurplus() > 0, "총 누적 잉여금은 0보다 커야 한다.");
    }
}

