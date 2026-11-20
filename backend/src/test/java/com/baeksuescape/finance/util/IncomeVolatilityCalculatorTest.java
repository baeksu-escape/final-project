package com.baeksuescape.finance.util;

import com.baeksuescape.finance.dto.cashflow.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.cashflow.MonthlyIncomeItem;
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
    @DisplayName("N-22-3 중앙값은 평균이 아니라 정렬한 가운데 값이어야 한다")
    void testMedianIncome() {
        List<MonthlyIncomeItem> items = createSample12Months();

        IncomeVolatilityResponse response = IncomeVolatilityCalculator.calculateVolatility(items, 2000000L);

        // 정렬하면 6·7번째 값이 330만·350만 → 중앙값 340만 (평균은 약 341만 6,667원)
        assertEquals(3400000L, response.getMedianIncome());
        assertNotEquals(response.getMeanIncome(), response.getMedianIncome());

        // 홀수 개면 가운데 값 하나
        List<MonthlyIncomeItem> odd = items.subList(0, 3); // 300만, 320만, 350만
        assertEquals(3200000L, IncomeVolatilityCalculator.calculateMedianIncome(odd));
    }

    @Test
    @DisplayName("N-22-5 소득 부족 달 확인 및 다음 비수기 도래 개월 수 검증")
    void testEvaluateDeficitMonths() {
        List<MonthlyIncomeItem> items = createSample12Months();
        long fixedExpense = 2000000L;
        YearMonth lastMonth = YearMonth.of(2026, 8); // 마지막 입력월 8월

        // 1월 소득이 150만원으로 고정지출 200만원보다 적음 (부족액 50만원)
        // 8월 기준으로 1월은 5개월 뒤 (9, 10, 11, 12, 1)
        com.baeksuescape.finance.dto.cashflow.DeficitMonthsResult result =
                IncomeVolatilityCalculator.calculateDeficitMonthsWithTimeline(
                        items, java.math.BigDecimal.valueOf(fixedExpense), lastMonth);

        assertTrue(result.isHasDeficitWarning(), "소득 부족 달 경고가 발생해야 한다.");
        assertEquals(1, result.getDeficitMonthsCount(), "소득 부족 달은 1건이어야 한다.");

        com.baeksuescape.finance.dto.cashflow.DeficitMonthsResult.DeficitMonthDetail item = result.getDeficitItems().get(0);
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

    @Test
    @DisplayName("N-21-2 소득 변동 폭: 평균 + (과거 같은 달 − 평균) × %. 0%는 매달 평균, 100%는 과거 패턴, 200%는 두 배 진폭, 0원 아래로는 안 내려감")
    void testIncomeVariationPct() {
        // 과거 9월 300만, 10월 100만 → 평균 200만. 전망 9·10월
        List<MonthlyIncomeItem> history = List.of(
                MonthlyIncomeItem.builder().yearMonth("2025-09").income(3000000L).build(),
                MonthlyIncomeItem.builder().yearMonth("2025-10").income(1000000L).build());
        long avg = 2000000L;

        CashFlowForecastResponse flat = IncomeVolatilityCalculator.forecastCashFlow(
                history, avg, 0L, 0L, 0.0, 0.0, 0.0, 2, YearMonth.of(2026, 9), 0);
        assertEquals(2000000L, flat.getMonthlyForecasts().get(0).getForecastIncome());
        assertEquals(2000000L, flat.getMonthlyForecasts().get(1).getForecastIncome());

        CashFlowForecastResponse same = IncomeVolatilityCalculator.forecastCashFlow(
                history, avg, 0L, 0L, 0.0, 0.0, 0.0, 2, YearMonth.of(2026, 9), 100);
        assertEquals(3000000L, same.getMonthlyForecasts().get(0).getForecastIncome(), "9월은 과거 9월 그대로");
        assertEquals(1000000L, same.getMonthlyForecasts().get(1).getForecastIncome(), "10월은 과거 10월 그대로");

        CashFlowForecastResponse twice = IncomeVolatilityCalculator.forecastCashFlow(
                history, avg, 0L, 0L, 0.0, 0.0, 0.0, 2, YearMonth.of(2026, 9), 200);
        assertEquals(4000000L, twice.getMonthlyForecasts().get(0).getForecastIncome());
        assertEquals(0L, twice.getMonthlyForecasts().get(1).getForecastIncome(), "200만 + (100만 − 200만) × 2 = 0");

        // 과거에 같은 달이 없으면(11월) 평균을 쓴다. 변동 폭을 안 주면 지금처럼 매달 평균이다.
        CashFlowForecastResponse missing = IncomeVolatilityCalculator.forecastCashFlow(
                history, avg, 0L, 0L, 0.0, 0.0, 0.0, 1, YearMonth.of(2026, 11), 100);
        assertEquals(2000000L, missing.getMonthlyForecasts().get(0).getForecastIncome());
        CashFlowForecastResponse none = IncomeVolatilityCalculator.forecastCashFlow(
                history, avg, 0L, 0L, 0.0, 0.0, 0.0, 1, YearMonth.of(2026, 9));
        assertEquals(2000000L, none.getMonthlyForecasts().get(0).getForecastIncome());

        // 누적 잉여·가장 빠듯한 달은 달별 값으로 계산된다.
        assertEquals(3000000L + 1000000L, same.getTotalAccumulatedSurplus());
        assertEquals("2026-10", same.getWorstForecastMonth());
    }

    @Test
    @DisplayName("N-21-9 과거 월 실적 months: 받은 이력을 오래된 달부터 그대로 담고, 이력이 없으면 빈 목록")
    void testForecastPastMonths() {
        // 순서를 섞어 넣어도 기준월 오름차순으로 나와야 한다.
        List<MonthlyIncomeItem> history = List.of(
                MonthlyIncomeItem.builder().yearMonth("2026-08").income(2061303L).expense(1315514L).build(),
                MonthlyIncomeItem.builder().yearMonth("2026-07").income(1686835L).expense(1315514L).build());

        CashFlowForecastResponse response = IncomeVolatilityCalculator.forecastCashFlow(
                history, 1874069L, 1315514L, 0L, 0.0, 0.0, 0.0, 3, YearMonth.of(2026, 9));

        assertEquals(2, response.getMonths().size());
        assertEquals("2026-07", response.getMonths().get(0).getBaseMonth());
        assertEquals(1686835L, response.getMonths().get(0).getIncomeAmount());
        assertEquals(1315514L, response.getMonths().get(0).getExpenseAmount());
        assertEquals("2026-08", response.getMonths().get(1).getBaseMonth());

        CashFlowForecastResponse empty = IncomeVolatilityCalculator.forecastCashFlow(
                null, 0L, 0L, 0L, 0.0, 0.0, 0.0, 3, YearMonth.of(2026, 9));
        assertTrue(empty.getMonths().isEmpty(), "이력이 없으면 빈 목록이어야 한다.");
    }

    // =========================================================================
    // 옛 함수 정리(11/17) 전후로 결과가 같은지 고정하는 테스트 — 시드 회원 2번(프리랜서) 실제 값
    // =========================================================================

    private List<MonthlyIncomeItem> seedMember2() {
        String[] months = {"2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
                "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"};
        long[] incomes = {1933611L, 1341079L, 3884117L, 1873023L, 2330585L, 2804640L,
                1619240L, 2715365L, 1616535L, 1327643L, 1686835L, 2061303L};
        List<MonthlyIncomeItem> list = new ArrayList<>();
        for (int i = 0; i < months.length; i++) {
            list.add(MonthlyIncomeItem.builder().yearMonth(months[i]).income(incomes[i]).build());
        }
        return list;
    }

    @Test
    @DisplayName("N-22-3~5 시드 회원 2번: 응답의 모든 지표가 api_spec_c.md 예시와 같다")
    void seedMember2_allIndicatorsPinned() {
        IncomeVolatilityResponse r = IncomeVolatilityCalculator.calculateVolatility(seedMember2(), 1315514L);

        assertEquals(2099498L, r.getMeanIncome());
        assertEquals(1903317L, r.getMedianIncome());
        assertEquals(33.68, r.getIncomeCv());
        assertEquals(707118.75, r.getStandardDeviation(), "N-22-3 표준편차(모표준편차, 소수 2자리)");
        assertTrue(r.isHighVolatility());
        assertEquals(99.09, r.getFixedExpenseToLowestIncomeRatio());
        assertEquals(0, r.getZeroIncomeMonthsCount());
        assertEquals(1691927L, r.getRecent3MonthsAverageIncome());
        assertEquals(-407571L, r.getRecent3MonthsDiff());
        assertEquals("2025-11", r.getPeakMonth());
        assertEquals(3884117L, r.getPeakIncome());
        assertEquals("2026-06", r.getOffPeakMonth());
        assertEquals(1327643L, r.getOffPeakIncome());
        assertEquals(2556474L, r.getPeakOffPeakGap());
        assertFalse(r.isHasDeficitWarning());
        assertTrue(r.getDeficitMonths().isEmpty());
        assertNull(r.getNearestDeficitMonth());
        assertEquals(0L, r.getRecommendedReserveAmount());
    }

    @Test
    @DisplayName("N-22-5 부족 달 여러 건: 가까운 달 순서, 준비 금액은 가장 가까운 달의 부족액")
    void multipleDeficitMonths() {
        // 고정지출 300만: 1월(소득 150만, 부족 150만)·2월(소득 200만, 부족 100만). 3월 300만은 같으므로 부족 아님
        IncomeVolatilityResponse r = IncomeVolatilityCalculator.calculateVolatility(createSample12Months(), 3000000L);

        assertTrue(r.isHasDeficitWarning());
        assertEquals(2, r.getDeficitMonths().size());
        assertEquals("2026-01", r.getDeficitMonths().get(0).getYearMonth());
        assertEquals(5, r.getDeficitMonths().get(0).getMonthsUntilNext());
        assertEquals("2026-02", r.getDeficitMonths().get(1).getYearMonth());
        assertEquals(6, r.getDeficitMonths().get(1).getMonthsUntilNext());
        assertEquals("2026-01", r.getNearestDeficitMonth());
        assertEquals(5, r.getMonthsUntilNearest());
        assertEquals(1500000L, r.getRecommendedReserveAmount());

        com.baeksuescape.finance.dto.cashflow.DeficitMonthsResult detail = IncomeVolatilityCalculator.calculateDeficitMonthsWithTimeline(
                createSample12Months(), java.math.BigDecimal.valueOf(3000000L), YearMonth.of(2026, 8));
        assertEquals(0, new java.math.BigDecimal("2500000").compareTo(detail.getTotalShortfallAmount()), "총 부족액 250만");
    }

    @Test
    @DisplayName("N-22-3 소득 0원 달 수와 변동계수, 빈 목록은 0 응답")
    void zeroIncomeAndEmpty() {
        List<MonthlyIncomeItem> items = new ArrayList<>();
        String[] months = {"2026-05", "2026-06", "2026-07", "2026-08"};
        long[] incomes = {2000000L, 0L, 2000000L, 0L};
        for (int i = 0; i < 4; i++) {
            items.add(MonthlyIncomeItem.builder().yearMonth(months[i]).income(incomes[i]).build());
        }
        IncomeVolatilityResponse r = IncomeVolatilityCalculator.calculateVolatility(items, 500000L);
        assertEquals(2, r.getZeroIncomeMonthsCount());
        assertEquals(1000000L, r.getMeanIncome());
        assertEquals(100.0, r.getIncomeCv(), "평균 100만, 모표준편차 100만 → 변동계수 100%");

        IncomeVolatilityResponse empty = IncomeVolatilityCalculator.calculateVolatility(List.of(), 500000L);
        assertEquals(0L, empty.getMeanIncome());
        assertNull(empty.getPeakMonth());
    }
}

