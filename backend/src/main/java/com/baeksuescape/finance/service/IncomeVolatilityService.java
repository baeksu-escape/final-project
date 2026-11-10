package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.*;
import com.baeksuescape.finance.util.IncomeVolatilityCalculator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/**
 * FP-183 소득 변동성 진단 및 현금흐름 전망 핵심 비즈니스 로직 서비스.
 * FP-184(변동성 지표/격차), FP-185(소득 부족 달), FP-186(현금흐름 전망) 기능을 제공한다.
 */
@Service
public class IncomeVolatilityService {

    // =========================================================================
    // [FP-184] 변동성 지표 및 성수기·비수기 소득 격차 계산
    // =========================================================================

    /**
     * 월별 소득 데이터를 기반으로 변동계수(CV) 및 성수기·비수기 격차를 계산한다.
     *
     * @param monthlyIncomes 월별 소득 목록 (BigDecimal)
     * @param seasonMonthCount 성수기/비수기 산출용 개월 수 (예: 1이면 최고/최저 1달, 2 이상이면 상/하위 N개월 평균)
     * @return IncomeVolatilityResult 변동성 지표 및 성수기·비수기 격차 결과 DTO
     */
    public IncomeVolatilityResult calculateVolatility(List<BigDecimal> monthlyIncomes, int seasonMonthCount) {
        return IncomeVolatilityCalculator.calculateVolatility(monthlyIncomes, seasonMonthCount);
    }

    // =========================================================================
    // [FP-185] 소득 부족 달 확인 계산
    // =========================================================================

    /**
     * 기준 금액 미만인 소득 부족 달(Deficit Months)을 추출하고 총 부족액을 계산한다.
     *
     * @param monthlyIncomes 월별 소득 목록 (BigDecimal)
     * @param thresholdAmount 기준 금액 (생활비 또는 설정 기준 금액)
     * @return DeficitMonthsResult 부족 달 개수, 목록, 총 부족액
     */
    public DeficitMonthsResult calculateDeficitMonths(List<BigDecimal> monthlyIncomes, BigDecimal thresholdAmount) {
        return IncomeVolatilityCalculator.calculateDeficitMonths(monthlyIncomes, thresholdAmount);
    }

    // =========================================================================
    // [FP-186] 현금흐름 전망 및 적자 개월 수 계산
    // =========================================================================

    /**
     * 향후 N개월간의 예상 수입과 예상 지출을 바탕으로 순 현금흐름 및 적자 개월 수를 산출한다.
     *
     * @param expectedIncomes 예상 월별 수입 목록
     * @param expectedExpenses 예상 월별 지출 목록
     * @return CashFlowForecastResult 월별 순현금흐름, 연속 적자 개월 수, 누적 적자액
     */
    public CashFlowForecastResult forecastCashFlow(List<BigDecimal> expectedIncomes, List<BigDecimal> expectedExpenses) {
        return IncomeVolatilityCalculator.forecastCashFlow(expectedIncomes, expectedExpenses);
    }

    // =========================================================================
    // 기존 통합 API 호환 메서드 (컨트롤러 연동용)
    // =========================================================================

    public IncomeVolatilityResponse diagnoseIncomeVolatility(IncomeVolatilityRequest request) {
        if (request == null || request.getMonthlyIncomes() == null) {
            return IncomeVolatilityResponse.builder().build();
        }
        return IncomeVolatilityCalculator.calculateVolatility(
                request.getMonthlyIncomes(),
                request.getMonthlyFixedExpense()
        );
    }

    public CashFlowForecastResponse forecastCashFlow(CashFlowForecastRequest request) {
        if (request == null) {
            return CashFlowForecastResponse.builder().build();
        }

        YearMonth startMonth = YearMonth.now().plusMonths(1);
        int forecastMonths = request.getForecastMonths() > 0 ? request.getForecastMonths() : 6;

        return IncomeVolatilityCalculator.forecastCashFlow(
                request.getPast12MonthsHistory(),
                request.getBaseMonthlyIncome(),
                request.getBaseMonthlyFixedExpense(),
                request.getBaseLoanMonthlyPayment(),
                request.getIncomeChangePercent(),
                request.getExpenseChangePercent(),
                request.getLoanPaymentChangePercent(),
                forecastMonths,
                startMonth
        );
    }
}
