package com.baeksuescape.finance.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

/**
 * N-16 자산·부채 건전성과 N-20 DSR 계산기의 순수 계산 유틸리티 (FP-166).
 * DB를 읽지 않고 받은 값으로만 계산하므로, 저장 데이터 조회·값 바꿔 보기(N-16-3) 어디서든 같은 결과가 나온다.
 */
public final class FinancialHealthCalculator {

    // === 위험 단계 기준 (%) — decisions.md "위험 단계(예시 기준)". 시연용 예시라 상수로 분리한다. ===
    /** 상환 부담률(DSR) 주의·위험 기준 (N-16-2, N-20-4) */
    public static final BigDecimal DSR_CAUTION = new BigDecimal("30");
    public static final BigDecimal DSR_DANGER = new BigDecimal("40");
    /** 자산 대비 부채 비율 주의·위험 기준 (N-16-2) */
    public static final BigDecimal DEBT_TO_ASSET_CAUTION = new BigDecimal("40");
    public static final BigDecimal DEBT_TO_ASSET_DANGER = new BigDecimal("60");
    /** 순자산 대비 부채 비율 주의·위험 기준 (N-16-2) */
    public static final BigDecimal DEBT_TO_NET_ASSET_CAUTION = new BigDecimal("70");
    public static final BigDecimal DEBT_TO_NET_ASSET_DANGER = new BigDecimal("100");

    /** 비율은 소수 둘째 자리까지 반올림한다 (N-20-4 "BigDecimal로 반올림") */
    private static final int RATIO_SCALE = 2;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal MONTHS_PER_YEAR = new BigDecimal("12");

    /** 위험 단계. 기준 이상이면 그 단계다(30% 정확히는 주의). */
    public enum RiskLevel { SAFE, CAUTION, DANGER }

    private FinancialHealthCalculator() {
        // 유틸리티 클래스 인스턴스화 방지
    }

    /**
     * N-20-3 연소득 집계: 급여소득자는 월급 × 12(보너스 제외), 자영업자·프리랜서는 월별 소득의 합이다(투표 D9).
     * 급여소득자는 가장 최근 월급(목록의 마지막 값)을 쓴다. 목록이 비어 있으면 0이다.
     */
    public static BigDecimal calculateAnnualIncome(List<Long> monthlyIncomes, boolean salary) {
        if (monthlyIncomes == null || monthlyIncomes.isEmpty()) {
            return BigDecimal.ZERO;
        }
        if (salary) {
            Long latestSalary = monthlyIncomes.get(monthlyIncomes.size() - 1);
            return BigDecimal.valueOf(latestSalary == null ? 0L : latestSalary).multiply(MONTHS_PER_YEAR);
        }
        return monthlyIncomes.stream()
                .filter(Objects::nonNull)
                .map(BigDecimal::valueOf)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * N-16-1·N-20-4 공유: 상환 부담률(DSR) = 연간 원리금 상환액 ÷ 연소득 × 100.
     * 두 기능이 이 함수 하나를 함께 쓴다. 연소득이 0 이하이면 계산할 수 없으므로 null을 돌려준다.
     */
    public static BigDecimal calculateRepaymentBurdenRatio(BigDecimal annualDebtService, BigDecimal annualIncome) {
        return calculateRatio(annualDebtService, annualIncome);
    }

    /**
     * 백분율 비율 = 분자 ÷ 분모 × 100 (소수 둘째 자리 반올림).
     * 분모가 0 이하이거나 값이 없으면 나눗셈 오류를 막기 위해 null(계산 불가)을 돌려준다.
     */
    public static BigDecimal calculateRatio(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null || denominator.signum() <= 0) {
            return null;
        }
        return numerator.multiply(HUNDRED).divide(denominator, RATIO_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * N-16-2 위험 단계 판정: 위험 기준 이상이면 DANGER, 주의 기준 이상이면 CAUTION, 그 밖에는 SAFE.
     * 비율이 null(계산 불가)이면 단계도 null이다.
     */
    public static RiskLevel evaluateRiskLevel(BigDecimal ratio, BigDecimal cautionThreshold, BigDecimal dangerThreshold) {
        if (ratio == null) {
            return null;
        }
        if (ratio.compareTo(dangerThreshold) >= 0) {
            return RiskLevel.DANGER;
        }
        if (ratio.compareTo(cautionThreshold) >= 0) {
            return RiskLevel.CAUTION;
        }
        return RiskLevel.SAFE;
    }

    /**
     * N-16-1·2 건전성 지표 한 번에 계산: 순자산, 상환 부담률, 자산 대비 부채, 순자산 대비 부채와 각 위험 단계.
     * 순자산이 0 이하이면 순자산 대비 부채는 계산할 수 없어 null로 둔다.
     * TODO(팀 확인) 계산 불가(null)를 화면에 어떻게 보일지, 순자산 0 이하를 위험으로 볼지 정해야 한다.
     */
    public static HealthResult calculateHealth(BigDecimal totalAsset, BigDecimal annualIncome,
                                               BigDecimal totalDebt, BigDecimal annualDebtService) {
        BigDecimal netAsset = totalAsset.subtract(totalDebt);

        BigDecimal repaymentBurdenRatio = calculateRepaymentBurdenRatio(annualDebtService, annualIncome);
        BigDecimal debtToAssetRatio = calculateRatio(totalDebt, totalAsset);
        BigDecimal debtToNetAssetRatio = calculateRatio(totalDebt, netAsset);

        return new HealthResult(
                totalAsset, totalDebt, netAsset,
                repaymentBurdenRatio, evaluateRiskLevel(repaymentBurdenRatio, DSR_CAUTION, DSR_DANGER),
                debtToAssetRatio, evaluateRiskLevel(debtToAssetRatio, DEBT_TO_ASSET_CAUTION, DEBT_TO_ASSET_DANGER),
                debtToNetAssetRatio, evaluateRiskLevel(debtToNetAssetRatio, DEBT_TO_NET_ASSET_CAUTION, DEBT_TO_NET_ASSET_DANGER));
    }

    /** calculateHealth()의 결과: 금액 3개와 비율 3개, 비율별 위험 단계 (비율·단계가 null이면 계산 불가) */
    public record HealthResult(
            BigDecimal totalAsset,
            BigDecimal totalDebt,
            BigDecimal netAsset,
            BigDecimal repaymentBurdenRatio,
            RiskLevel repaymentBurdenLevel,
            BigDecimal debtToAssetRatio,
            RiskLevel debtToAssetLevel,
            BigDecimal debtToNetAssetRatio,
            RiskLevel debtToNetAssetLevel) {
    }
}
