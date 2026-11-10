package com.baeksuescape.finance.util;

import com.baeksuescape.finance.dto.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.CashFlowForecastResponse.MonthlyForecastItem;
import com.baeksuescape.finance.dto.CashFlowForecastResult;
import com.baeksuescape.finance.dto.CashFlowForecastResult.MonthlyFlowDetail;
import com.baeksuescape.finance.dto.DeficitMonthsResult;
import com.baeksuescape.finance.dto.DeficitMonthsResult.DeficitMonthDetail;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse.DeficitMonthItem;
import com.baeksuescape.finance.dto.IncomeVolatilityResult;
import com.baeksuescape.finance.dto.MonthlyIncomeItem;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * N-22 소득 변동성 및 N-21 현금흐름 순수 계산 엔진 유틸리티.
 * FP-184(변동성 지표/격차), FP-185(소득 부족 달), FP-186(현금흐름 전망) 핵심 로직을 수행한다.
 */
public final class IncomeVolatilityCalculator {

    /** 변동성이 크다고 판정하는 변동계수(CV) 임계값 (UI 확정 기준 12.0%) */
    public static final BigDecimal HIGH_VOLATILITY_THRESHOLD_CV = new BigDecimal("12.0");

    private IncomeVolatilityCalculator() {
        // 유틸리티 클래스 인스턴스화 방지
    }

    // =========================================================================
    // [FP-184] 변동성 지표 및 성수기·비수기 소득 격차 계산 (기획서 N-22-3·4 기준)
    // =========================================================================

    /**
     * FP-184 월별 소득 데이터를 받아 변동성 지표(CV)와 성수기·비수기 소득 격차를 계산한다.
     *
     * @param monthlyIncomes 월별 소득 목록 (BigDecimal)
     * @param seasonMonthCount 성수기/비수기 산출용 상위/하위 개월 수 (예: 1이면 최고/최저, 2 이상이면 상/하위 N개월 평균)
     * @return IncomeVolatilityResult 계산 결과 DTO
     */
    public static IncomeVolatilityResult calculateVolatility(List<BigDecimal> monthlyIncomes, int seasonMonthCount) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            throw new IllegalArgumentException("소득 데이터가 비어 있습니다.");
        }

        int count = monthlyIncomes.size();
        if (seasonMonthCount <= 0 || seasonMonthCount > count / 2) {
            seasonMonthCount = 1; // 방어적 기본값: 단일 최고/최저 달
        }

        // 1. 평균 소득 계산
        BigDecimal sum = BigDecimal.ZERO;
        int zeroCount = 0;
        for (BigDecimal income : monthlyIncomes) {
            if (income == null) income = BigDecimal.ZERO;
            sum = sum.add(income);
            if (income.compareTo(BigDecimal.ZERO) == 0) {
                zeroCount++;
            }
        }
        BigDecimal countBD = BigDecimal.valueOf(count);
        BigDecimal mean = sum.divide(countBD, 2, RoundingMode.HALF_UP);

        // 2. 표준편차 및 변동계수(CV) 계산
        BigDecimal varianceSum = BigDecimal.ZERO;
        for (BigDecimal income : monthlyIncomes) {
            if (income == null) income = BigDecimal.ZERO;
            BigDecimal diff = income.subtract(mean);
            varianceSum = varianceSum.add(diff.multiply(diff));
        }
        BigDecimal variance = varianceSum.divide(countBD, 4, RoundingMode.HALF_UP);
        double stdDevDouble = Math.sqrt(variance.doubleValue());
        BigDecimal stdDev = BigDecimal.valueOf(stdDevDouble).setScale(2, RoundingMode.HALF_UP);

        BigDecimal cv = BigDecimal.ZERO;
        if (mean.compareTo(BigDecimal.ZERO) > 0) {
            cv = stdDev.multiply(BigDecimal.valueOf(100))
                    .divide(mean, 2, RoundingMode.HALF_UP);
        }
        boolean isHighVolatility = cv.compareTo(HIGH_VOLATILITY_THRESHOLD_CV) > 0;

        // 3. 성수기·비수기 격차 계산 (상위 N개월 평균 vs 하위 N개월 평균)
        List<BigDecimal> sorted = monthlyIncomes.stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());

        BigDecimal offPeakSum = BigDecimal.ZERO;
        for (int i = 0; i < seasonMonthCount; i++) {
            offPeakSum = offPeakSum.add(sorted.get(i));
        }
        BigDecimal offPeakAvg = offPeakSum.divide(BigDecimal.valueOf(seasonMonthCount), 2, RoundingMode.HALF_UP);

        BigDecimal peakSum = BigDecimal.ZERO;
        for (int i = count - seasonMonthCount; i < count; i++) {
            peakSum = peakSum.add(sorted.get(i));
        }
        BigDecimal peakAvg = peakSum.divide(BigDecimal.valueOf(seasonMonthCount), 2, RoundingMode.HALF_UP);

        BigDecimal gapAmount = peakAvg.subtract(offPeakAvg);
        BigDecimal gapRatio = BigDecimal.ZERO;
        if (offPeakAvg.compareTo(BigDecimal.ZERO) > 0) {
            gapRatio = gapAmount.multiply(BigDecimal.valueOf(100))
                    .divide(offPeakAvg, 2, RoundingMode.HALF_UP);
        }

        return IncomeVolatilityResult.builder()
                .meanIncome(mean)
                .standardDeviation(stdDev)
                .coefficientOfVariation(cv)
                .isHighVolatility(isHighVolatility)
                .peakSeasonAverage(peakAvg)
                .offPeakSeasonAverage(offPeakAvg)
                .gapAmount(gapAmount)
                .gapRatio(gapRatio)
                .zeroIncomeMonthsCount(zeroCount)
                .build();
    }

    // =========================================================================
    // [FP-185] 소득 부족 달 확인 계산 (기획서 N-22-5 기준)
    // =========================================================================

    /**
     * FP-185 기준 금액 미만인 소득 부족 달을 추출하고 총 부족액을 산출한다.
     *
     * @param monthlyIncomes 월별 소득 목록 (BigDecimal)
     * @param thresholdAmount 기준 금액 (생활비 또는 설정 기준, BigDecimal)
     * @return DeficitMonthsResult 부족 달 개수, 목록, 총 부족액
     */
    public static DeficitMonthsResult calculateDeficitMonths(List<BigDecimal> monthlyIncomes, BigDecimal thresholdAmount) {
        if (monthlyIncomes == null || thresholdAmount == null) {
            throw new IllegalArgumentException("입력 파라미터가 null일 수 없습니다.");
        }

        List<DeficitMonthDetail> deficitList = new ArrayList<>();
        BigDecimal totalShortfall = BigDecimal.ZERO;

        for (int i = 0; i < monthlyIncomes.size(); i++) {
            BigDecimal income = monthlyIncomes.get(i);
            if (income == null) income = BigDecimal.ZERO;

            if (income.compareTo(thresholdAmount) < 0) {
                BigDecimal shortfall = thresholdAmount.subtract(income);
                totalShortfall = totalShortfall.add(shortfall);

                deficitList.add(DeficitMonthDetail.builder()
                        .monthIdentifier("Month " + (i + 1))
                        .income(income)
                        .shortfallAmount(shortfall)
                        .monthsUntilNext(null)
                        .build());
            }
        }

        boolean hasWarning = !deficitList.isEmpty();
        return DeficitMonthsResult.builder()
                .thresholdAmount(thresholdAmount)
                .deficitMonthsCount(deficitList.size())
                .totalShortfallAmount(totalShortfall)
                .hasDeficitWarning(hasWarning)
                .deficitItems(deficitList)
                .nearestDeficitMonth(hasWarning ? deficitList.get(0).getMonthIdentifier() : null)
                .monthsUntilNearest(null)
                .recommendedReserveAmount(hasWarning ? deficitList.get(0).getShortfallAmount() : BigDecimal.ZERO)
                .build();
    }

    /**
     * FP-185 (타임라인 포함) 날짜 정보 기반으로 도래 주기까지 계산하는 버전.
     */
    public static DeficitMonthsResult calculateDeficitMonthsWithTimeline(
            List<MonthlyIncomeItem> monthlyIncomes, BigDecimal thresholdAmount, YearMonth lastInputMonth) {
        if (monthlyIncomes == null || thresholdAmount == null || lastInputMonth == null) {
            throw new IllegalArgumentException("입력 파라미터가 null일 수 없습니다.");
        }

        List<DeficitMonthDetail> deficitList = new ArrayList<>();
        BigDecimal totalShortfall = BigDecimal.ZERO;
        int lastMonthValue = lastInputMonth.getMonthValue();

        for (MonthlyIncomeItem item : monthlyIncomes) {
            BigDecimal income = BigDecimal.valueOf(item.getIncome());
            if (income.compareTo(thresholdAmount) < 0) {
                BigDecimal shortfall = thresholdAmount.subtract(income);
                totalShortfall = totalShortfall.add(shortfall);

                int deficitMonthValue = item.toYearMonth().getMonthValue();
                int diff = deficitMonthValue - lastMonthValue;
                int monthsUntilNext = diff <= 0 ? diff + 12 : diff;

                deficitList.add(DeficitMonthDetail.builder()
                        .monthIdentifier(item.getYearMonth())
                        .income(income)
                        .shortfallAmount(shortfall)
                        .monthsUntilNext(monthsUntilNext)
                        .build());
            }
        }

        if (deficitList.isEmpty()) {
            return DeficitMonthsResult.builder()
                    .thresholdAmount(thresholdAmount)
                    .deficitMonthsCount(0)
                    .totalShortfallAmount(BigDecimal.ZERO)
                    .hasDeficitWarning(false)
                    .deficitItems(Collections.emptyList())
                    .nearestDeficitMonth(null)
                    .monthsUntilNearest(null)
                    .recommendedReserveAmount(BigDecimal.ZERO)
                    .build();
        }

        // 가장 가까운 비수기 순으로 정렬
        deficitList.sort(Comparator.comparingInt(DeficitMonthDetail::getMonthsUntilNext));
        DeficitMonthDetail nearest = deficitList.get(0);

        return DeficitMonthsResult.builder()
                .thresholdAmount(thresholdAmount)
                .deficitMonthsCount(deficitList.size())
                .totalShortfallAmount(totalShortfall)
                .hasDeficitWarning(true)
                .deficitItems(deficitList)
                .nearestDeficitMonth(nearest.getMonthIdentifier())
                .monthsUntilNearest(nearest.getMonthsUntilNext())
                .recommendedReserveAmount(nearest.getShortfallAmount())
                .build();
    }

    // =========================================================================
    // [FP-186] 현금흐름 전망 및 적자 개월 수 계산 (기획서 N-21-5~7 기준)
    // =========================================================================

    /**
     * FP-186 예상 수입과 예상 지출을 바탕으로 향후 N개월 순 현금흐름, 연속 적자 개월 수, 누적 적자액을 계산한다.
     *
     * @param expectedIncomes 예상 월별 수입 목록 (BigDecimal)
     * @param expectedExpenses 예상 월별 지출 목록 (BigDecimal)
     * @return CashFlowForecastResult 현금흐름 전망 결과 DTO
     */
    public static CashFlowForecastResult forecastCashFlow(List<BigDecimal> expectedIncomes, List<BigDecimal> expectedExpenses) {
        if (expectedIncomes == null || expectedExpenses == null) {
            throw new IllegalArgumentException("수입 및 지출 데이터가 null일 수 없습니다.");
        }
        if (expectedIncomes.size() != expectedExpenses.size()) {
            throw new IllegalArgumentException("수입과 지출 데이터의 개월 수가 일치해야 합니다.");
        }
        if (expectedIncomes.isEmpty()) {
            throw new IllegalArgumentException("전망 대상 개월 수가 최소 1개월 이상이어야 합니다.");
        }

        int months = expectedIncomes.size();
        List<MonthlyFlowDetail> flows = new ArrayList<>();

        int totalDeficits = 0;
        int currentConsecutive = 0;
        int maxConsecutive = 0;
        BigDecimal totalDeficitAmount = BigDecimal.ZERO;
        BigDecimal totalNetCash = BigDecimal.ZERO;

        String worstMonth = "-";
        BigDecimal worstNet = null;

        for (int i = 0; i < months; i++) {
            BigDecimal inc = expectedIncomes.get(i) != null ? expectedIncomes.get(i) : BigDecimal.ZERO;
            BigDecimal exp = expectedExpenses.get(i) != null ? expectedExpenses.get(i) : BigDecimal.ZERO;
            BigDecimal net = inc.subtract(exp);
            String monthLabel = "Month " + (i + 1);

            boolean isDeficit = net.compareTo(BigDecimal.ZERO) < 0;
            if (isDeficit) {
                totalDeficits++;
                currentConsecutive++;
                if (currentConsecutive > maxConsecutive) {
                    maxConsecutive = currentConsecutive;
                }
                totalDeficitAmount = totalDeficitAmount.add(net.abs());
            } else {
                currentConsecutive = 0;
            }

            totalNetCash = totalNetCash.add(net);

            if (worstNet == null || net.compareTo(worstNet) < 0) {
                worstNet = net;
                worstMonth = monthLabel;
            }

            flows.add(MonthlyFlowDetail.builder()
                    .monthIdentifier(monthLabel)
                    .expectedIncome(inc)
                    .expectedExpense(exp)
                    .netCashFlow(net)
                    .isDeficit(isDeficit)
                    .build());
        }

        return CashFlowForecastResult.builder()
                .monthlyFlows(flows)
                .totalDeficitMonthsCount(totalDeficits)
                .maxConsecutiveDeficitMonths(maxConsecutive)
                .totalDeficitAmount(totalDeficitAmount)
                .totalNetCashFlow(totalNetCash)
                .worstMonth(worstMonth)
                .worstNetCashFlow(worstNet != null ? worstNet : BigDecimal.ZERO)
                .build();
    }

    // =========================================================================
    // 하위 호환 및 통합 인터페이스 (MonthlyIncomeItem 기반)
    // =========================================================================

    public static PeakOffPeakResult calculatePeakOffPeakGap(List<MonthlyIncomeItem> monthlyIncomes) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            return new PeakOffPeakResult(0L, "-", 0L, "-", 0L);
        }

        MonthlyIncomeItem peakItem = monthlyIncomes.stream()
                .max(Comparator.comparingLong(MonthlyIncomeItem::getIncome))
                .orElse(monthlyIncomes.get(0));

        MonthlyIncomeItem offPeakItem = monthlyIncomes.stream()
                .min(Comparator.comparingLong(MonthlyIncomeItem::getIncome))
                .orElse(monthlyIncomes.get(0));

        long gap = peakItem.getIncome() - offPeakItem.getIncome();
        return new PeakOffPeakResult(gap, peakItem.getYearMonth(), peakItem.getIncome(),
                offPeakItem.getYearMonth(), offPeakItem.getIncome());
    }

    public static IncomeVolatilityResponse calculateVolatility(List<MonthlyIncomeItem> monthlyIncomes, long monthlyFixedExpense) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            return IncomeVolatilityResponse.builder().build();
        }

        List<MonthlyIncomeItem> sortedList = monthlyIncomes.stream()
                .sorted(Comparator.comparing(MonthlyIncomeItem::getYearMonth))
                .collect(Collectors.toList());

        List<BigDecimal> bdIncomes = sortedList.stream()
                .map(item -> BigDecimal.valueOf(item.getIncome()))
                .collect(Collectors.toList());

        IncomeVolatilityResult result = calculateVolatility(bdIncomes, 1);
        PeakOffPeakResult peakOffPeak = calculatePeakOffPeakGap(sortedList);

        double fixedExpenseRatio = 0.0;
        if (peakOffPeak.offPeakIncome > 0) {
            fixedExpenseRatio = ((double) monthlyFixedExpense / peakOffPeak.offPeakIncome) * 100.0;
            fixedExpenseRatio = Math.round(fixedExpenseRatio * 100.0) / 100.0;
        }

        YearMonth lastInputMonth = sortedList.get(sortedList.size() - 1).toYearMonth();
        DeficitMonthsResult deficitResult = calculateDeficitMonthsWithTimeline(
                sortedList, BigDecimal.valueOf(monthlyFixedExpense), lastInputMonth);

        List<DeficitMonthItem> legacyDeficitList = deficitResult.getDeficitItems().stream()
                .map(d -> DeficitMonthItem.builder()
                        .yearMonth(d.getMonthIdentifier())
                        .income(d.getIncome().longValue())
                        .shortfallAmount(d.getShortfallAmount().longValue())
                        .monthsUntilNext(d.getMonthsUntilNext() != null ? d.getMonthsUntilNext() : 0)
                        .build())
                .collect(Collectors.toList());

        int count = sortedList.size();
        int recentMonthsCount = Math.min(3, count);
        List<BigDecimal> recent3 = bdIncomes.subList(count - recentMonthsCount, count);
        BigDecimal recentSum = recent3.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        long recent3Mean = recentSum.divide(BigDecimal.valueOf(recentMonthsCount), 0, RoundingMode.HALF_UP).longValue();
        long meanLong = result.getMeanIncome().longValue();

        return IncomeVolatilityResponse.builder()
                .meanIncome(meanLong)
                .medianIncome(meanLong)
                .incomeCv(result.getCoefficientOfVariation().doubleValue())
                .isHighVolatility(result.isHighVolatility())
                .fixedExpenseToLowestIncomeRatio(fixedExpenseRatio)
                .zeroIncomeMonthsCount(result.getZeroIncomeMonthsCount())
                .recent3MonthsAverageIncome(recent3Mean)
                .recent3MonthsDiff(recent3Mean - meanLong)
                .peakMonth(peakOffPeak.peakMonth)
                .peakIncome(peakOffPeak.peakIncome)
                .offPeakMonth(peakOffPeak.offPeakMonth)
                .offPeakIncome(peakOffPeak.offPeakIncome)
                .peakOffPeakGap(peakOffPeak.gap)
                .hasDeficitWarning(deficitResult.isHasDeficitWarning())
                .deficitMonths(legacyDeficitList)
                .nearestDeficitMonth(deficitResult.getNearestDeficitMonth())
                .monthsUntilNearest(deficitResult.getMonthsUntilNearest())
                .recommendedReserveAmount(deficitResult.getRecommendedReserveAmount().longValue())
                .build();
    }

    public static int countPastDeficitMonths(List<MonthlyIncomeItem> past12MonthsHistory) {
        if (past12MonthsHistory == null) return 0;
        int count = 0;
        for (MonthlyIncomeItem item : past12MonthsHistory) {
            if (item.getExpense() > item.getIncome()) {
                count++;
            }
        }
        return count;
    }

    public static CashFlowForecastResponse forecastCashFlow(
            List<MonthlyIncomeItem> pastHistory,
            long baseIncome,
            long baseFixedExpense,
            long baseLoanPayment,
            double incomeChangePercent,
            double expenseChangePercent,
            double loanPaymentChangePercent,
            int forecastMonths,
            YearMonth startForecastMonth) {

        int pastDeficits = countPastDeficitMonths(pastHistory);
        PeakOffPeakResult peakOffPeak = calculatePeakOffPeakGap(pastHistory);

        long forecastMonthlyIncome = Math.round(baseIncome * (1.0 + incomeChangePercent / 100.0));
        long forecastMonthlyExpense = Math.round(baseFixedExpense * (1.0 + expenseChangePercent / 100.0));
        long forecastMonthlyLoan = Math.round(baseLoanPayment * (1.0 + loanPaymentChangePercent / 100.0));
        long monthlyNetCash = forecastMonthlyIncome - (forecastMonthlyExpense + forecastMonthlyLoan);

        List<MonthlyForecastItem> forecastItems = new ArrayList<>();
        long totalSurplus = 0L;
        String worstMonth = "-";
        long worstNet = Long.MAX_VALUE;

        for (int i = 0; i < forecastMonths; i++) {
            YearMonth targetMonth = startForecastMonth.plusMonths(i);
            String monthStr = targetMonth.toString();
            boolean isDeficit = monthlyNetCash < 0;

            forecastItems.add(MonthlyForecastItem.builder()
                    .forecastYearMonth(monthStr)
                    .forecastIncome(forecastMonthlyIncome)
                    .forecastExpense(forecastMonthlyExpense)
                    .forecastLoanPayment(forecastMonthlyLoan)
                    .netCashFlow(monthlyNetCash)
                    .isDeficit(isDeficit)
                    .build());

            totalSurplus += monthlyNetCash;
            if (monthlyNetCash < worstNet) {
                worstNet = monthlyNetCash;
                worstMonth = monthStr;
            }
        }

        return CashFlowForecastResponse.builder()
                .pastDeficitMonthsCount(pastDeficits)
                .peakOffPeakGap(peakOffPeak.gap)
                .peakMonth(peakOffPeak.peakMonth)
                .peakIncome(peakOffPeak.peakIncome)
                .offPeakMonth(peakOffPeak.offPeakMonth)
                .offPeakIncome(peakOffPeak.offPeakIncome)
                .monthlyForecasts(forecastItems)
                .worstForecastMonth(worstMonth)
                .worstNetCashFlow(worstNet == Long.MAX_VALUE ? 0L : worstNet)
                .totalAccumulatedSurplus(totalSurplus)
                .build();
    }

    public static class PeakOffPeakResult {
        public final long gap;
        public final String peakMonth;
        public final long peakIncome;
        public final String offPeakMonth;
        public final long offPeakIncome;

        public PeakOffPeakResult(long gap, String peakMonth, long peakIncome, String offPeakMonth, long offPeakIncome) {
            this.gap = gap;
            this.peakMonth = peakMonth;
            this.peakIncome = peakIncome;
            this.offPeakMonth = offPeakMonth;
            this.offPeakIncome = offPeakIncome;
        }
    }
}
