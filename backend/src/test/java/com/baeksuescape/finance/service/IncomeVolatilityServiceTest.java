package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.CashFlowForecastResult;
import com.baeksuescape.finance.dto.DeficitMonthsResult;
import com.baeksuescape.finance.dto.IncomeVolatilityResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * FP-183 핵심 비즈니스 로직 서비스 단위 테스트 (FP-184, FP-185, FP-186).
 */
class IncomeVolatilityServiceTest {

    private IncomeVolatilityService service;

    @BeforeEach
    void setUp() {
        service = new IncomeVolatilityService();
    }

    // =========================================================================
    // [FP-184] 변동성 지표 및 성수기·비수기 격차 테스트
    // =========================================================================

    @Test
    @DisplayName("FP-184: 변동계수(CV) 및 성수기/비수기 격차 계산 정상 동작 검증")
    void testCalculateVolatility_Success() {
        // 12개월 소득 (원): 합계 4,200만원, 평균 350만원
        List<BigDecimal> incomes = Arrays.asList(
                new BigDecimal("3000000"), new BigDecimal("3200000"), new BigDecimal("3500000"), new BigDecimal("3800000"),
                new BigDecimal("1500000"), new BigDecimal("2000000"), new BigDecimal("3000000"), new BigDecimal("4000000"),
                new BigDecimal("4500000"), new BigDecimal("4200000"), new BigDecimal("5000000"), new BigDecimal("4300000")
        );

        // 상위 2개월(성수기: 500만, 450만 -> 평균 475만) vs 하위 2개월(비수기: 150만, 200만 -> 평균 175만)
        IncomeVolatilityResult result = service.calculateVolatility(incomes, 2);

        assertNotNull(result);
        assertEquals(0, new BigDecimal("3500000.00").compareTo(result.getMeanIncome()), "평균 소득은 350만원이어야 한다.");
        assertTrue(result.getCoefficientOfVariation().compareTo(new BigDecimal("12.0")) > 0, "변동계수(CV)는 12%를 초과해야 한다.");
        assertTrue(result.isHighVolatility(), "변동이 큼 플래그가 true여야 한다.");

        // 성수기/비수기 격차 (상위 2개 평균 475만, 하위 2개 평균 175만 -> 격차 300만원)
        assertEquals(0, new BigDecimal("4750000.00").compareTo(result.getPeakSeasonAverage()));
        assertEquals(0, new BigDecimal("1750000.00").compareTo(result.getOffPeakSeasonAverage()));
        assertEquals(0, new BigDecimal("3000000.00").compareTo(result.getGapAmount()), "격차 금액은 300만원이어야 한다.");
        assertTrue(result.getGapRatio().compareTo(BigDecimal.ZERO) > 0, "격차 비율은 양수여야 한다.");
    }

    @Test
    @DisplayName("FP-184 방어적 코딩: 빈 소득 데이터 입력 시 IllegalArgumentException 발생")
    void testCalculateVolatility_EmptyInput_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> service.calculateVolatility(Collections.emptyList(), 1));
        assertThrows(IllegalArgumentException.class, () -> service.calculateVolatility(null, 1));
    }

    // =========================================================================
    // [FP-185] 소득 부족 달 확인 테스트
    // =========================================================================

    @Test
    @DisplayName("FP-185: 기준 금액 미만인 소득 부족 달 및 총 부족액 계산 검증")
    void testCalculateDeficitMonths_Success() {
        // 6개월 소득: [300만, 180만, 220만, 350만, 150만, 400만]
        List<BigDecimal> incomes = Arrays.asList(
                new BigDecimal("3000000"),
                new BigDecimal("1800000"), // 부족 (기준 250만 대비 70만 부족)
                new BigDecimal("2200000"), // 부족 (기준 250만 대비 30만 부족)
                new BigDecimal("3500000"),
                new BigDecimal("1500000"), // 부족 (기준 250만 대비 100만 부족)
                new BigDecimal("4000000")
        );
        BigDecimal threshold = new BigDecimal("2500000"); // 기준 생활비 250만원

        DeficitMonthsResult result = service.calculateDeficitMonths(incomes, threshold);

        assertNotNull(result);
        assertEquals(3, result.getDeficitMonthsCount(), "소득 부족 달은 총 3개월이어야 한다.");
        assertEquals(0, new BigDecimal("2000000").compareTo(result.getTotalShortfallAmount()), "총 부족액 합계는 200만원이어야 한다.");
        assertTrue(result.isHasDeficitWarning(), "경고 플래그가 true여야 한다.");
        assertEquals(3, result.getDeficitItems().size());

        // 첫 번째 부족 달 세부 항목 검증
        assertEquals("Month 2", result.getDeficitItems().get(0).getMonthIdentifier());
        assertEquals(0, new BigDecimal("700000").compareTo(result.getDeficitItems().get(0).getShortfallAmount()));
    }

    @Test
    @DisplayName("FP-185 방어적 코딩: 모든 달이 기준 이상일 때 경고 미발생 검증")
    void testCalculateDeficitMonths_NoDeficit() {
        List<BigDecimal> incomes = Arrays.asList(new BigDecimal("3000000"), new BigDecimal("4000000"));
        BigDecimal threshold = new BigDecimal("2000000");

        DeficitMonthsResult result = service.calculateDeficitMonths(incomes, threshold);

        assertEquals(0, result.getDeficitMonthsCount());
        assertEquals(0, BigDecimal.ZERO.compareTo(result.getTotalShortfallAmount()));
        assertFalse(result.isHasDeficitWarning(), "부족 달이 없으면 경고가 false여야 한다.");
    }

    // =========================================================================
    // [FP-186] 현금흐름 전망 및 연속 적자 개월 수 테스트
    // =========================================================================

    @Test
    @DisplayName("FP-186: 순 현금흐름, 최대 연속 적자 개월 수 및 누적 적자액 계산 검증")
    void testForecastCashFlow_Success() {
        // 5개월간의 예상 수입 vs 예상 지출
        List<BigDecimal> expectedIncomes = Arrays.asList(
                new BigDecimal("3000000"), // net: +100만
                new BigDecimal("1500000"), // net: -100만 (적자 1)
                new BigDecimal("1800000"), // net: -70만  (적자 2 - 연속 2회)
                new BigDecimal("3500000"), // net: +100만 (회복)
                new BigDecimal("1200000")  // net: -130만 (적자 3 - 비연속 1회, worst)
        );
        List<BigDecimal> expectedExpenses = Arrays.asList(
                new BigDecimal("2000000"),
                new BigDecimal("2500000"),
                new BigDecimal("2500000"),
                new BigDecimal("2500000"),
                new BigDecimal("2500000")
        );

        CashFlowForecastResult result = service.forecastCashFlow(expectedIncomes, expectedExpenses);

        assertNotNull(result);
        assertEquals(5, result.getMonthlyFlows().size());
        assertEquals(3, result.getTotalDeficitMonthsCount(), "총 적자 달 수는 3개월이어야 한다.");
        assertEquals(2, result.getMaxConsecutiveDeficitMonths(), "최대 연속 적자 달 수는 2개월이어야 한다.");

        // 누적 적자액: 100만 + 70만 + 130만 = 300만원
        assertEquals(0, new BigDecimal("3000000").compareTo(result.getTotalDeficitAmount()), "총 누적 적자액은 300만원이어야 한다.");

        // 총 순현금흐름: +100 - 100 - 70 + 100 - 130 = -100만원
        assertEquals(0, new BigDecimal("-1000000").compareTo(result.getTotalNetCashFlow()));

        // 가장 빠듯한 달: Month 5 (-130만원)
        assertEquals("Month 5", result.getWorstMonth());
        assertEquals(0, new BigDecimal("-1300000").compareTo(result.getWorstNetCashFlow()));
    }

    @Test
    @DisplayName("FP-186 방어적 코딩: 수입과 지출 리스트 크기 불일치 시 예외 발생 검증")
    void testForecastCashFlow_MismatchedSize_ThrowsException() {
        List<BigDecimal> incomes = Arrays.asList(new BigDecimal("3000000"), new BigDecimal("2000000"));
        List<BigDecimal> expenses = Collections.singletonList(new BigDecimal("2000000"));

        assertThrows(IllegalArgumentException.class, () -> service.forecastCashFlow(incomes, expenses));
    }
}
