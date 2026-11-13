package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.*;
import com.baeksuescape.finance.mapper.IncomeVolatilityMapper;
import com.baeksuescape.finance.util.IncomeVolatilityCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * FP-183 소득 변동성 진단 및 현금흐름 전망 핵심 비즈니스 로직 서비스.
 * FP-184(변동성 지표/격차), FP-185(소득 부족 달), FP-186(현금흐름 전망), FP-203(저장 데이터 조회 연결) 기능을 제공한다.
 */
@Service
@RequiredArgsConstructor
public class IncomeVolatilityService {

    /** 급여소득자 월급을 펼칠 개월 수 (N-22는 최근 12개월 기준) */
    private static final int MONTHS_TO_ANALYZE = 12;
    /** 예측 기간을 주지 않았을 때의 기본값 (개월) */
    private static final int DEFAULT_FORECAST_MONTHS = 6;
    private static final String SALARY_KIND_CODE = "SALARY";

    private final IncomeVolatilityMapper incomeVolatilityMapper;

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

    /**
     * N-22 POST 경로용: 요청 본문으로 받은 12개월 소득과 고정지출로 변동성을 진단한다(DB 조회 없음).
     */
    public IncomeVolatilityResponse diagnoseIncomeVolatility(IncomeVolatilityRequest request) {
        if (request == null || request.getMonthlyIncomes() == null) {
            return IncomeVolatilityResponse.builder().build();
        }
        return IncomeVolatilityCalculator.calculateVolatility(
                request.getMonthlyIncomes(),
                request.getMonthlyFixedExpense()
        );
    }

    /**
     * N-21 POST 경로용: 요청 본문으로 받은 과거 이력·기준값·변화율로 현금흐름을 전망한다(DB 조회 없음).
     */
    public CashFlowForecastResponse forecastCashFlow(CashFlowForecastRequest request) {
        if (request == null) {
            return CashFlowForecastResponse.builder().build();
        }

        YearMonth startMonth = nextMonthAfter(request.getPast12MonthsHistory());
        int forecastMonths = request.getForecastMonths() > 0 ? request.getForecastMonths() : DEFAULT_FORECAST_MONTHS;

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

    // =========================================================================
    // [FP-203] 저장 데이터(DB) 기반 진단·전망
    // =========================================================================

    /**
     * N-22-1·N-22-3~5 저장된 최근 12개월 소득과 월 고정지출(FIXED)로 소득 변동성을 진단한다.
     * 저장된 소득이 없으면 404를 던진다.
     */
    public IncomeVolatilityResponse diagnoseSavedIncomeVolatility(long userId) {
        List<MonthlyIncomeItem> history = loadIncomeHistory(userId, 0L);
        long monthlyFixedExpense = incomeVolatilityMapper.selectLatestFixedExpense(userId);
        return IncomeVolatilityCalculator.calculateVolatility(history, monthlyFixedExpense);
    }

    /**
     * N-21-1·N-21-5~7 저장된 소득·월 지출 합계·월 원리금에 전망 조건을 적용해 현금흐름을 전망한다.
     * 기준 소득은 최근 12개월 평균이고, 전망은 마지막 입력월 다음 달부터 시작한다.
     */
    public CashFlowForecastResponse forecastSavedCashFlow(long userId, CashFlowConditionRequest condition) {
        // 1) 조건을 하나도 안 보내면 모든 변화율 0, 기간 6개월로 본다.
        CashFlowConditionRequest cond = condition != null ? condition : new CashFlowConditionRequest();
        // 2) DB에서 기준값을 읽는다: 월 지출 합계(모든 지출 그룹), 월 원리금 합계, 최근 12개월 소득
        long monthlyTotalExpense = incomeVolatilityMapper.selectLatestTotalExpense(userId);
        long monthlyLoanPayment = incomeVolatilityMapper.selectLatestLoanMonthlyPayment(userId);
        List<MonthlyIncomeItem> history = loadIncomeHistory(userId, monthlyTotalExpense);

        // 3) 기준 소득 = 최근 12개월 평균. 소득이 들쭉날쭉한 직군도 한 값으로 전망하기 위해서다.
        long baseMonthlyIncome = Math.round(history.stream()
                .mapToLong(MonthlyIncomeItem::getIncome)
                .average()
                .orElse(0));
        int forecastMonths = cond.getForecastMonths() > 0 ? cond.getForecastMonths() : DEFAULT_FORECAST_MONTHS;

        return IncomeVolatilityCalculator.forecastCashFlow(
                history,
                baseMonthlyIncome,
                monthlyTotalExpense,
                monthlyLoanPayment,
                cond.getIncomeChangePercent(),
                cond.getExpenseChangePercent(),
                cond.getLoanPaymentChangePercent(),
                forecastMonths,
                nextMonthAfter(history)
        );
    }

    /**
     * 저장된 소득을 계산 입력(MonthlyIncomeItem)으로 바꾼다. 급여소득자는 월급 1행을 마지막 기준월까지 12개월로 펼친다(연소득 = 월급 × 12).
     * 각 달의 지출에는 같은 월 지출 금액을 넣는다(지출은 월별이 아니라 평소 월 금액 하나만 저장된다).
     */
    private List<MonthlyIncomeItem> loadIncomeHistory(long userId, long monthlyExpense) {
        List<IncomeMonthRow> rows = incomeVolatilityMapper.selectRecentIncomeMonths(userId);
        if (rows == null || rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "저장된 소득 데이터가 없습니다.");
        }

        List<MonthlyIncomeItem> history = new ArrayList<>();
        IncomeMonthRow latest = rows.get(rows.size() - 1);
        // 급여소득자: 월급 1행만 저장되므로 마지막 기준월에서 거꾸로 12개월을 같은 월급으로 채운다.
        if (SALARY_KIND_CODE.equals(latest.getIncomeKindCode())) {
            YearMonth lastMonth = YearMonth.parse(latest.getYearMonth());
            for (int i = MONTHS_TO_ANALYZE - 1; i >= 0; i--) {
                history.add(toItem(lastMonth.minusMonths(i).toString(), latest.getIncome(), monthlyExpense));
            }
            return history;
        }

        // 자영업자·프리랜서: 저장된 월별 소득을 그대로 쓴다(최대 12행, 기준월 오름차순).
        for (IncomeMonthRow row : rows) {
            history.add(toItem(row.getYearMonth(), row.getIncome(), monthlyExpense));
        }
        return history;
    }

    /** 기준월·소득·지출 값을 계산 입력 단위(MonthlyIncomeItem) 하나로 만든다. */
    private MonthlyIncomeItem toItem(String yearMonth, long income, long expense) {
        return MonthlyIncomeItem.builder()
                .yearMonth(yearMonth)
                .income(income)
                .expense(expense)
                .build();
    }

    /** N-21-9 전망은 과거 이력 마지막 달 바로 다음 달부터 이어진다. 이력이 없으면 이번 달 다음 달부터 시작한다. */
    private YearMonth nextMonthAfter(List<MonthlyIncomeItem> history) {
        if (history == null || history.isEmpty()) {
            return YearMonth.now().plusMonths(1);
        }
        return history.stream()
                .map(MonthlyIncomeItem::toYearMonth)
                .max(Comparator.naturalOrder())
                .orElseGet(YearMonth::now)
                .plusMonths(1);
    }
}
