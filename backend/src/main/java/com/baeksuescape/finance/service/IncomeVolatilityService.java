package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.cashflow.*;
import com.baeksuescape.finance.mapper.IncomeVolatilityMapper;
import com.baeksuescape.finance.util.IncomeVolatilityCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * N-22 소득 변동성 진단과 N-21 현금흐름 전망 서비스 (FP-183·FP-203).
 * 계산은 IncomeVolatilityCalculator에 맡기고, 여기서는 요청 본문(POST) 또는 DB 저장 데이터(GET)를 계산 입력으로 바꾼다.
 */
@Service
@RequiredArgsConstructor
public class IncomeVolatilityService {

    /** 급여소득자 월급을 펼칠 개월 수 (N-22는 최근 12개월 기준) */
    private static final int MONTHS_TO_ANALYZE = 12;
    /** 예측 기간을 주지 않았을 때의 기본값 (개월) */
    private static final int DEFAULT_FORECAST_MONTHS = 6;
    /** N-21-2 예측 기간 선택지 (개월) */
    private static final Set<Integer> ALLOWED_FORECAST_MONTHS = Set.of(3, 6, 12);
    /** N-21-2 소득 변동 폭 범위 (%) — 화면 mock과 같다 */
    private static final int MIN_INCOME_VARIATION_PCT = 0;
    private static final int MAX_INCOME_VARIATION_PCT = 200;
    /** N-21-2 카드값·대출 납부 상태 (제때·밀림) */
    private static final Set<String> PAYMENT_STATUSES = Set.of("ON_TIME", "DELAYED");
    private static final String SALARY_KIND_CODE = "SALARY";

    private final IncomeVolatilityMapper incomeVolatilityMapper;

    // =========================================================================
    // 요청 본문 기반 계산 (POST, DB 조회 없음)
    // =========================================================================

    /**
     * N-22 POST 경로용: 요청 본문으로 받은 12개월 소득과 고정지출로 변동성을 진단한다(DB 조회 없음).
     */
    public IncomeVolatilityResponse diagnoseIncomeVolatility(IncomeVolatilityRequest request) {
        if (request == null || request.getMonthlyIncomes() == null || request.getMonthlyIncomes().isEmpty()) {
            throw badRequest("monthlyIncomes", "월별 소득을 1개월 이상 입력해 주세요.");
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
            throw badRequest(null, "요청 값이 없습니다.");
        }

        YearMonth startMonth = nextMonthAfter(request.getPast12MonthsHistory());
        int forecastMonths = resolveForecastMonths(request.getForecastMonths());

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
     * 저장된 소득이 없으면 404 NOT_FOUND(ApiException)를 던진다.
     */
    public IncomeVolatilityResponse diagnoseSavedIncomeVolatility(long userId) {
        List<MonthlyIncomeItem> history = loadIncomeHistory(userId, 0L);
        long monthlyFixedExpense = incomeVolatilityMapper.selectLatestFixedExpense(userId);
        return IncomeVolatilityCalculator.calculateVolatility(history, monthlyFixedExpense);
    }

    /**
     * N-21-1·N-21-5~7 저장된 소득·월 지출 합계·월 원리금에 전망 조건을 적용해 현금흐름을 전망한다.
     * 기준 소득은 최근 12개월 평균이고, 전망은 마지막 입력월 다음 달부터 시작한다.
     * 합계와 항목 목록을 따로 조회하므로, 다른 기기에서 동시에 저장해도 모든 조회가 같은 시점의 데이터를 보게 SERIALIZABLE 읽기 전용 트랜잭션으로 묶는다(읽기만 해서 쓰기 충돌은 없다).
     */
    @Transactional(readOnly = true, isolation = Isolation.SERIALIZABLE)
    public CashFlowForecastResponse forecastSavedCashFlow(long userId, CashFlowConditionRequest condition) {
        // 1) 조건을 하나도 안 보내면 모든 변화율 0, 기간 6개월로 본다.
        CashFlowConditionRequest cond = condition != null ? condition : new CashFlowConditionRequest();
        // 예측 기간(3·6·12)과 N-21-2 화면 조건(변동 폭·고정지출·납부 상태)은 DB를 읽기 전에 먼저 확인한다.
        int forecastMonths = resolveForecastMonths(cond.getForecastMonths());
        validateScreenConditions(cond);
        // 2) DB에서 기준값을 읽는다: 월 지출 합계(모든 지출 그룹), 월 원리금 합계, 최근 12개월 소득
        long monthlyTotalExpense = incomeVolatilityMapper.selectLatestTotalExpense(userId);
        long monthlyLoanPayment = incomeVolatilityMapper.selectLatestLoanMonthlyPayment(userId);
        long storedFixedExpense = incomeVolatilityMapper.selectLatestFixedExpense(userId);
        List<MonthlyIncomeItem> history = loadIncomeHistory(userId, monthlyTotalExpense);

        // N-21-2 고정지출을 직접 입력하면 저장된 고정지출(FIXED) 자리만 그 값으로 바꾼다. 과거 실적(months)의 지출은 저장값 그대로다.
        long forecastBaseExpense = monthlyTotalExpense;
        if (cond.getFixedExpenseAmount() != null) {
            forecastBaseExpense = cond.getFixedExpenseAmount() + (monthlyTotalExpense - storedFixedExpense);
        }

        // 3) 기준 소득 = 최근 12개월 평균. 소득이 들쭉날쭉한 직군도 한 값으로 전망하기 위해서다.
        long baseMonthlyIncome = Math.round(history.stream()
                .mapToLong(MonthlyIncomeItem::getIncome)
                .average()
                .orElse(0));

        CashFlowForecastResponse response = IncomeVolatilityCalculator.forecastCashFlow(
                history,
                baseMonthlyIncome,
                forecastBaseExpense,
                monthlyLoanPayment,
                cond.getIncomeChangePercent(),
                cond.getExpenseChangePercent(),
                cond.getLoanPaymentChangePercent(),
                forecastMonths,
                nextMonthAfter(history),
                cond.getIncomeVariationPct()
        );
        // N-21-1·2 화면 조건의 처음 값: 저장된 고정지출, 나머지 지출(할부·정기결제·기타), 월 원리금 (조건을 적용하기 전 값)
        response.setBaseFixedExpenseAmount(storedFixedExpense);
        response.setBaseOtherExpenseAmount(monthlyTotalExpense - storedFixedExpense);
        response.setBaseMonthlyLoanPayment(monthlyLoanPayment);
        // N-21-3·5 기타 지출·대출의 항목별 내역(합이 위 두 기준값과 같다). 항목이 없으면 빈 리스트다.
        response.setBaseOtherExpenseItems(orEmpty(incomeVolatilityMapper.selectLatestOtherExpenseItems(userId)));
        response.setBaseLoanItems(orEmpty(incomeVolatilityMapper.selectLatestLoanItems(userId)));
        return response;
    }

    /**
     * N-21-2 화면 조건 검사 — 문구는 현금흐름 화면 mock과 같다. 모두 생략할 수 있고, 보낸 값만 범위를 본다.
     * 소득 변동 폭 0~200, 고정지출 0 이상, 납부 상태 ON_TIME·DELAYED. 납부 상태는 예상 점수(DIAG-09)에서 쓴다.
     * 예상 점수(ExpectedScoreService)도 같은 조건을 받으므로 같은 패키지에서 함께 쓴다.
     */
    void validateScreenConditions(CashFlowConditionRequest cond) {
        Integer variation = cond.getIncomeVariationPct();
        if (variation != null && (variation < MIN_INCOME_VARIATION_PCT || variation > MAX_INCOME_VARIATION_PCT)) {
            throw badRequest("incomeVariationPct", "소득 변동 폭은 0~200% 정수여야 합니다.");
        }
        if (cond.getFixedExpenseAmount() != null && cond.getFixedExpenseAmount() < 0) {
            throw badRequest("fixedExpenseAmount", "월 고정 지출은 0 이상의 원 단위 정수여야 합니다.");
        }
        if (cond.getPaymentStatus() != null && !PAYMENT_STATUSES.contains(cond.getPaymentStatus())) {
            throw badRequest("paymentStatus", "납부 상태를 선택해 주세요.");
        }
    }

    /**
     * 저장된 소득을 계산 입력(MonthlyIncomeItem)으로 바꾼다. 급여소득자는 월급 1행을 마지막 기준월까지 12개월로 펼친다(연소득 = 월급 × 12).
     * 각 달의 지출에는 같은 월 지출 금액을 넣는다(지출은 월별이 아니라 평소 월 금액 하나만 저장된다).
     * 시나리오 테스트(ScenarioService, N-17-1)도 같은 기준 소득을 쓰므로 같은 패키지에서 함께 쓴다.
     */
    List<MonthlyIncomeItem> loadIncomeHistory(long userId, long monthlyExpense) {
        List<IncomeMonthRow> rows = incomeVolatilityMapper.selectRecentIncomeMonths(userId);
        if (rows == null || rows.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "저장된 소득 데이터가 없습니다.");
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

    /** 조회 결과가 null이면 빈 리스트로 바꾼다(항목 목록은 항상 배열로 내려간다). */
    private static <T> List<T> orEmpty(List<T> items) {
        return items == null ? List.of() : items;
    }

    /** 기준월·소득·지출 값을 계산 입력 단위(MonthlyIncomeItem) 하나로 만든다. */
    private MonthlyIncomeItem toItem(String yearMonth, long income, long expense) {
        return MonthlyIncomeItem.builder()
                .yearMonth(yearMonth)
                .income(income)
                .expense(expense)
                .build();
    }

    /** N-21-2 예측 기간: 없거나 0이면 기본 6개월, 화면 선택지인 3·6·12개월만 받고 그 밖의 값은 400이다. */
    private int resolveForecastMonths(int requested) {
        if (requested == 0) {
            return DEFAULT_FORECAST_MONTHS;
        }
        if (!ALLOWED_FORECAST_MONTHS.contains(requested)) {
            throw badRequest("forecastMonths", "예측 기간은 3·6·12개월 중 하나여야 합니다.");
        }
        return requested;
    }

    /** 팀 공통 오류 형식 { code: INVALID_INPUT, message, fieldErrors }로 400을 만든다(FinancialHealthService와 같은 방식). */
    private ApiException badRequest(String field, String message) {
        List<FieldErrorItem> fieldErrors = field == null ? List.of() : List.of(new FieldErrorItem(field, message));
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message, fieldErrors);
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
