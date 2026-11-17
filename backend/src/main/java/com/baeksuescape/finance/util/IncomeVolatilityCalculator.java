package com.baeksuescape.finance.util;

import com.baeksuescape.finance.dto.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.CashFlowForecastResponse.MonthlyForecastItem;
import com.baeksuescape.finance.dto.DeficitMonthsResult;
import com.baeksuescape.finance.dto.DeficitMonthsResult.DeficitMonthDetail;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse.DeficitMonthItem;
import com.baeksuescape.finance.dto.MonthlyIncomeItem;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * N-22 소득 변동성 진단과 N-21 현금흐름 전망의 순수 계산 유틸리티 (FP-183·FP-203).
 * 입력은 기준월이 붙은 월별 소득(MonthlyIncomeItem)이고, 결과는 화면 응답 DTO로 바로 돌려준다. DB는 읽지 않는다.
 */
public final class IncomeVolatilityCalculator {

    /** 변동성이 크다고 판정하는 변동계수(CV) 임계값 (UI 확정 기준 12.0%, 초과일 때 "변동이 큼") */
    public static final BigDecimal HIGH_VOLATILITY_THRESHOLD_CV = new BigDecimal("12.0");

    private IncomeVolatilityCalculator() {
        // 유틸리티 클래스 인스턴스화 방지
    }

    // =========================================================================
    // N-22-3 변동성 지표 기초 값 (평균·변동계수·소득 0원 달 수)
    // =========================================================================

    /** summarizeIncomes()의 결과: 평균(소수 2자리), 변동계수(%, 소수 2자리), 12% 초과 여부, 소득 0원 달 수 */
    private record IncomeSummary(BigDecimal mean, BigDecimal cv, boolean highVolatility, int zeroIncomeMonthsCount) {
    }

    /**
     * N-22-3 월별 소득의 평균, 변동계수(CV = 표준편차 ÷ 평균 × 100), 소득 0원 달 수를 구한다.
     * 표준편차는 모표준편차(분산을 개수 n으로 나눔)다. 반올림: 평균 2자리 → 분산 4자리 → 표준편차 2자리 → CV 2자리(모두 HALF_UP).
     */
    private static IncomeSummary summarizeIncomes(List<MonthlyIncomeItem> monthlyIncomes) {
        BigDecimal count = BigDecimal.valueOf(monthlyIncomes.size());

        BigDecimal sum = BigDecimal.ZERO;
        int zeroCount = 0;
        for (MonthlyIncomeItem item : monthlyIncomes) {
            BigDecimal income = BigDecimal.valueOf(item.getIncome());
            sum = sum.add(income);
            if (income.signum() == 0) {
                zeroCount++;
            }
        }
        BigDecimal mean = sum.divide(count, 2, RoundingMode.HALF_UP);

        BigDecimal squaredDiffSum = BigDecimal.ZERO;
        for (MonthlyIncomeItem item : monthlyIncomes) {
            BigDecimal diff = BigDecimal.valueOf(item.getIncome()).subtract(mean);
            squaredDiffSum = squaredDiffSum.add(diff.multiply(diff));
        }
        BigDecimal variance = squaredDiffSum.divide(count, 4, RoundingMode.HALF_UP);
        BigDecimal stdDev = BigDecimal.valueOf(Math.sqrt(variance.doubleValue())).setScale(2, RoundingMode.HALF_UP);

        // 평균이 0원이면(모든 달 소득 0) 나눌 수 없으므로 변동계수는 0으로 둔다.
        BigDecimal cv = BigDecimal.ZERO;
        if (mean.signum() > 0) {
            cv = stdDev.multiply(BigDecimal.valueOf(100)).divide(mean, 2, RoundingMode.HALF_UP);
        }
        boolean highVolatility = cv.compareTo(HIGH_VOLATILITY_THRESHOLD_CV) > 0;
        return new IncomeSummary(mean, cv, highVolatility, zeroCount);
    }

    // =========================================================================
    // N-22-5 소득 부족 달 확인
    // =========================================================================

    /**
     * N-22-5 소득이 기준 금액(월 고정지출)보다 적은 달을 찾고, 마지막 입력월 다음부터 그 달이 다시 오기까지 남은 개월 수를 구한다.
     * 결과는 가까운 달 순서이며, 준비 권장 금액은 가장 가까운 달의 부족액이다. 부족한 달이 없으면 경고 없음(false)이다.
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
    // N-22-4·N-21-7 성수기·비수기 격차 (공유), N-22 진단 응답 조립
    // =========================================================================

    /**
     * N-22-4·N-21-7 공통: 소득이 가장 높은 달(성수기)과 가장 낮은 달(비수기), 그 차이를 구한다.
     * 두 기능이 이 함수 하나를 함께 쓰므로, 고치면 소득 변동성·현금흐름 화면이 함께 바뀐다. 데이터가 없으면 "-"와 0을 돌려준다.
     */
    public static PeakOffPeakResult calculatePeakOffPeakGap(List<MonthlyIncomeItem> monthlyIncomes) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            return new PeakOffPeakResult(0L, "-", 0L, "-", 0L);
        }

        // 금액이 같은 달이 여럿이면 목록에서 먼저 나온(이른) 달을 고른다.
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

    /**
     * N-22 소득 변동성 화면에 필요한 값을 한 번에 계산해 응답으로 묶는다(N-22-3 지표, N-22-4 격차, N-22-5 부족 달).
     * API(POST·GET)가 모두 이 함수를 부른다. 소득 목록이 비어 있으면 모든 값이 0인 응답을 돌려준다.
     */
    public static IncomeVolatilityResponse calculateVolatility(List<MonthlyIncomeItem> monthlyIncomes, long monthlyFixedExpense) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            return IncomeVolatilityResponse.builder().build();
        }

        // 1) 기준월 순서로 정렬한다. "최근 3개월"과 "마지막 입력월"이 이 순서에 기대기 때문이다.
        List<MonthlyIncomeItem> sortedList = monthlyIncomes.stream()
                .sorted(Comparator.comparing(MonthlyIncomeItem::getYearMonth))
                .collect(Collectors.toList());

        // 2) 평균·변동계수(CV)·12% 초과 여부·소득 0원 달 수
        IncomeSummary summary = summarizeIncomes(sortedList);
        // 3) 성수기·비수기 달과 격차 (N-21-7과 공유)
        PeakOffPeakResult peakOffPeak = calculatePeakOffPeakGap(sortedList);

        // 4) 가장 낮은 달 소득 대비 고정지출 비율(%). 100%를 넘으면 그 달은 고정지출도 못 냈다는 뜻이다.
        double fixedExpenseRatio = 0.0;
        if (peakOffPeak.offPeakIncome > 0) {
            fixedExpenseRatio = ((double) monthlyFixedExpense / peakOffPeak.offPeakIncome) * 100.0;
            fixedExpenseRatio = Math.round(fixedExpenseRatio * 100.0) / 100.0;
        }

        // 5) 소득 부족 달(N-22-5): 소득 < 고정지출인 달과, 마지막 입력월 기준으로 그 달이 다시 오기까지 남은 개월 수
        YearMonth lastInputMonth = sortedList.get(sortedList.size() - 1).toYearMonth();
        DeficitMonthsResult deficitResult = calculateDeficitMonthsWithTimeline(
                sortedList, BigDecimal.valueOf(monthlyFixedExpense), lastInputMonth);

        // 내부 계산 결과(BigDecimal)를 화면 응답 형식(원 단위 long)으로 옮긴다.
        List<DeficitMonthItem> deficitMonths = deficitResult.getDeficitItems().stream()
                .map(d -> DeficitMonthItem.builder()
                        .yearMonth(d.getMonthIdentifier())
                        .income(d.getIncome().longValue())
                        .shortfallAmount(d.getShortfallAmount().longValue())
                        .monthsUntilNext(d.getMonthsUntilNext() != null ? d.getMonthsUntilNext() : 0)
                        .build())
                .collect(Collectors.toList());

        // 6) 최근 3개월 평균과 12개월 평균의 차이. 음수면 요즘 소득이 평소보다 줄었다는 뜻이다.
        int count = sortedList.size();
        int recentMonthsCount = Math.min(3, count);
        BigDecimal recentSum = sortedList.subList(count - recentMonthsCount, count).stream()
                .map(item -> BigDecimal.valueOf(item.getIncome()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long recent3Mean = recentSum.divide(BigDecimal.valueOf(recentMonthsCount), 0, RoundingMode.HALF_UP).longValue();
        long meanLong = summary.mean().longValue();

        return IncomeVolatilityResponse.builder()
                .meanIncome(meanLong)
                .medianIncome(calculateMedianIncome(sortedList))
                .incomeCv(summary.cv().doubleValue())
                .isHighVolatility(summary.highVolatility())
                .fixedExpenseToLowestIncomeRatio(fixedExpenseRatio)
                .zeroIncomeMonthsCount(summary.zeroIncomeMonthsCount())
                .recent3MonthsAverageIncome(recent3Mean)
                .recent3MonthsDiff(recent3Mean - meanLong)
                .peakMonth(peakOffPeak.peakMonth)
                .peakIncome(peakOffPeak.peakIncome)
                .offPeakMonth(peakOffPeak.offPeakMonth)
                .offPeakIncome(peakOffPeak.offPeakIncome)
                .peakOffPeakGap(peakOffPeak.gap)
                .hasDeficitWarning(deficitResult.isHasDeficitWarning())
                .deficitMonths(deficitMonths)
                .nearestDeficitMonth(deficitResult.getNearestDeficitMonth())
                .monthsUntilNearest(deficitResult.getMonthsUntilNearest())
                .recommendedReserveAmount(deficitResult.getRecommendedReserveAmount().longValue())
                .build();
    }

    /**
     * N-22-3 월별 소득의 중앙값을 구한다. 개수가 짝수면 가운데 두 값의 평균(원 단위 반올림)이다.
     */
    public static long calculateMedianIncome(List<MonthlyIncomeItem> monthlyIncomes) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            return 0L;
        }
        List<Long> sorted = monthlyIncomes.stream()
                .map(MonthlyIncomeItem::getIncome)
                .sorted()
                .collect(Collectors.toList());
        int size = sorted.size();
        if (size % 2 == 1) {
            return sorted.get(size / 2);
        }
        return Math.round((sorted.get(size / 2 - 1) + sorted.get(size / 2)) / 2.0);
    }

    // =========================================================================
    // N-21 현금흐름 전망 (N-21-5 월별 전망, N-21-6 과거 적자 달, N-21-7 격차는 위 공유 함수)
    // =========================================================================

    /**
     * N-21-6 최근 12개월 중 지출이 소득보다 큰(적자) 달 수를 센다. 이력이 없으면 0이다.
     */
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

    /**
     * N-21 현금흐름 전망 화면에 필요한 값을 한 번에 계산한다(N-21-5 월별 전망, N-21-6 과거 적자 달, N-21-7 격차).
     * 기준 소득·지출·원리금에 변화율(%)을 한 번 적용하고, 전망 기간 동안 매달 같은 값으로 이어 간다.
     */
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

        // 1) 과거 12개월 기준 값: 적자 달 수(N-21-6), 성수기·비수기 격차(N-21-7)
        int pastDeficits = countPastDeficitMonths(pastHistory);
        PeakOffPeakResult peakOffPeak = calculatePeakOffPeakGap(pastHistory);

        // 2) 변화율 적용: 예) 소득 -10%면 기준 소득 × 0.9. 원 단위로 반올림한다.
        long forecastMonthlyIncome = Math.round(baseIncome * (1.0 + incomeChangePercent / 100.0));
        long forecastMonthlyExpense = Math.round(baseFixedExpense * (1.0 + expenseChangePercent / 100.0));
        long forecastMonthlyLoan = Math.round(baseLoanPayment * (1.0 + loanPaymentChangePercent / 100.0));
        long monthlyNetCash = forecastMonthlyIncome - (forecastMonthlyExpense + forecastMonthlyLoan);

        // 3) 시작월부터 전망 기간만큼 월별 항목을 만들고, 누적 잉여와 가장 빠듯한 달(순현금 최소)을 함께 구한다.
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

    /** calculatePeakOffPeakGap()의 결과: 격차, 성수기 달·금액, 비수기 달·금액 */
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
