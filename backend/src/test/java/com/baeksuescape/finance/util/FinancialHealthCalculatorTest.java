package com.baeksuescape.finance.util;

import com.baeksuescape.finance.util.FinancialHealthCalculator.HealthResult;
import com.baeksuescape.finance.util.FinancialHealthCalculator.RiskLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static com.baeksuescape.finance.util.FinancialHealthCalculator.DSR_CAUTION;
import static com.baeksuescape.finance.util.FinancialHealthCalculator.DSR_DANGER;
import static org.junit.jupiter.api.Assertions.*;

/**
 * FP-166 N-16 건전성·N-20 DSR 순수 계산 단위 테스트.
 */
class FinancialHealthCalculatorTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    @DisplayName("N-20-4 DSR = 연간 원리금 ÷ 연소득 × 100, 소수 둘째 자리 반올림")
    void repaymentBurdenRatio() {
        // 1,000만 ÷ 3,000만 = 33.333… → 33.33
        assertEquals(0, bd("33.33").compareTo(
                FinancialHealthCalculator.calculateRepaymentBurdenRatio(bd("10000000"), bd("30000000"))));
        // 2 ÷ 3 = 66.666… → 66.67 (HALF_UP)
        assertEquals(0, bd("66.67").compareTo(
                FinancialHealthCalculator.calculateRepaymentBurdenRatio(bd("2"), bd("3"))));
        // 원리금이 없으면 0
        assertEquals(0, BigDecimal.ZERO.compareTo(
                FinancialHealthCalculator.calculateRepaymentBurdenRatio(BigDecimal.ZERO, bd("30000000"))));
    }

    @Test
    @DisplayName("N-20-4 연소득이 0 이하이면 나눗셈 대신 null(계산 불가)")
    void repaymentBurdenRatio_zeroIncome() {
        assertNull(FinancialHealthCalculator.calculateRepaymentBurdenRatio(bd("1000000"), BigDecimal.ZERO));
        assertNull(FinancialHealthCalculator.calculateRatio(bd("1000000"), bd("-1")));
        assertNull(FinancialHealthCalculator.calculateRatio(null, bd("100")));
    }

    @Test
    @DisplayName("N-16-2 위험 단계 경계: 30% 이상 주의, 40% 이상 위험")
    void riskLevelBoundaries() {
        assertEquals(RiskLevel.SAFE, FinancialHealthCalculator.evaluateRiskLevel(bd("29.99"), DSR_CAUTION, DSR_DANGER));
        assertEquals(RiskLevel.CAUTION, FinancialHealthCalculator.evaluateRiskLevel(bd("30.00"), DSR_CAUTION, DSR_DANGER));
        assertEquals(RiskLevel.CAUTION, FinancialHealthCalculator.evaluateRiskLevel(bd("39.99"), DSR_CAUTION, DSR_DANGER));
        assertEquals(RiskLevel.DANGER, FinancialHealthCalculator.evaluateRiskLevel(bd("40.00"), DSR_CAUTION, DSR_DANGER));
        assertNull(FinancialHealthCalculator.evaluateRiskLevel(null, DSR_CAUTION, DSR_DANGER));
    }

    @Test
    @DisplayName("N-20-3 연소득: 급여소득자는 최근 월급 × 12, 그 밖에는 월별 합")
    void annualIncome() {
        assertEquals(0, bd("36000000").compareTo(
                FinancialHealthCalculator.calculateAnnualIncome(Collections.singletonList(3000000L), true)));
        List<Long> monthly = Arrays.asList(1000000L, 2000000L, 3000000L);
        assertEquals(0, bd("6000000").compareTo(FinancialHealthCalculator.calculateAnnualIncome(monthly, false)));
        assertEquals(0, BigDecimal.ZERO.compareTo(FinancialHealthCalculator.calculateAnnualIncome(List.of(), false)));
    }

    @Test
    @DisplayName("N-16-1 건전성 지표: 순자산·비율 3개와 단계")
    void calculateHealth() {
        // 총자산 1억, 연소득 4,000만, 총부채 5,000만, 연 원리금 1,400만
        HealthResult result = FinancialHealthCalculator.calculateHealth(
                bd("100000000"), bd("40000000"), bd("50000000"), bd("14000000"));

        assertEquals(0, bd("50000000").compareTo(result.netAsset()));
        assertEquals(0, bd("35.00").compareTo(result.repaymentBurdenRatio()));   // 1,400만 ÷ 4,000만
        assertEquals(RiskLevel.CAUTION, result.repaymentBurdenLevel());
        assertEquals(0, bd("50.00").compareTo(result.debtToAssetRatio()));       // 5,000만 ÷ 1억
        assertEquals(RiskLevel.CAUTION, result.debtToAssetLevel());               // 40 이상 60 미만
        assertEquals(0, bd("100.00").compareTo(result.debtToNetAssetRatio()));   // 5,000만 ÷ 순자산 5,000만
        assertEquals(RiskLevel.DANGER, result.debtToNetAssetLevel());             // 100 이상
    }

    @Test
    @DisplayName("N-16-1 순자산이 0 이하·총자산 0이면 해당 비율은 계산 불가(null)")
    void calculateHealth_notCalculable() {
        // 총자산 3,000만 < 총부채 5,000만 → 순자산 -2,000만
        HealthResult negativeNet = FinancialHealthCalculator.calculateHealth(
                bd("30000000"), bd("40000000"), bd("50000000"), bd("4000000"));
        assertEquals(0, bd("-20000000").compareTo(negativeNet.netAsset()));
        assertNull(negativeNet.debtToNetAssetRatio());
        assertNull(negativeNet.debtToNetAssetLevel());
        assertEquals(RiskLevel.DANGER, negativeNet.debtToAssetLevel()); // 166.67%

        // 총자산 0, 연소득 0 → 자산 대비 부채·상환 부담률 계산 불가
        HealthResult noAsset = FinancialHealthCalculator.calculateHealth(
                BigDecimal.ZERO, BigDecimal.ZERO, bd("1000000"), bd("100000"));
        assertNull(noAsset.debtToAssetRatio());
        assertNull(noAsset.repaymentBurdenRatio());
        assertNull(noAsset.repaymentBurdenLevel());
    }
}
