package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.cashflow.MonthlyIncomeItem;
import com.baeksuescape.finance.dto.scenario.PolicyRateRow;
import com.baeksuescape.finance.dto.scenario.ScenarioBaseResponse;
import com.baeksuescape.finance.dto.scenario.ScenarioBaseResponse.ScenarioLoanItem;
import com.baeksuescape.finance.dto.scenario.ScenarioRecalculateRequest;
import com.baeksuescape.finance.dto.scenario.ScenarioRecalculateResponse;
import com.baeksuescape.finance.dto.scenario.ScenarioRecalculateResponse.Side;
import com.baeksuescape.finance.dto.scenario.VariableLoanRow;
import com.baeksuescape.finance.mapper.IncomeVolatilityMapper;
import com.baeksuescape.finance.mapper.ScenarioMapper;
import com.baeksuescape.finance.util.FinancialHealthCalculator;
import com.baeksuescape.finance.util.RecalculationFrame;
import com.baeksuescape.finance.util.RecalculationFrame.ChangeType;
import com.baeksuescape.finance.util.RecalculationFrame.ValueChange;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * FP-167 N-17 시나리오 테스트 — 로그인 회원의 저장값(N-17-1)에 금리·소득·지출 변화(N-17-2)를 공통 재계산 틀(N-17-3)로 반영해
 * 월 잉여·상환 부담률·월 이자 변화·버틸 수 있는 개월 수(N-17-4)를 구한다. 점수는 구하지 않는다(점수 예측은 N-21).
 * 결과는 저장하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class ScenarioService {

    /** N-17-2 직접 입력 범위 */
    static final BigDecimal MIN_RATE_PCT_POINT = new BigDecimal("-5");
    static final BigDecimal MAX_RATE_PCT_POINT = new BigDecimal("10");
    static final BigDecimal MIN_INCOME_PCT = new BigDecimal("-100");
    static final BigDecimal MAX_INCOME_PCT = new BigDecimal("100");
    static final BigDecimal MIN_EXPENSE_PCT = new BigDecimal("-50");
    static final BigDecimal MAX_EXPENSE_PCT = new BigDecimal("100");

    /**
     * 적자일 때 부족액에 쓸 수 있다고 보는 총자산 비율(%). 저장된 자산은 총자산 하나뿐이라(전세보증금·자동차 등 포함) 일부만 쓸 수 있다고 본다.
     * D-33 11/20 합의: 총자산의 15%(현금·예금 수준)를 사용한다.
     */
    static final int SURVIVABLE_ASSET_RATIO_PCT = 15;

    static final String SHORTFALL = "SHORTFALL";
    static final String IMPROVED = "IMPROVED";
    static final String STILL_POSITIVE = "STILL_POSITIVE";

    private static final String INCOME = "monthlyIncomeAmount";
    private static final String EXPENSE = "monthlyExpenseAmount";
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal TWELVE = new BigDecimal("12");

    /** 화면에 그대로 보여 줄 계산 가정 (기준값·결과 공통) */
    static final List<String> ASSUMPTIONS = List.of(
            "금리 변화는 변동금리 대출에만 반영하고, 고정금리·금리 방식을 모르는 대출의 상환액은 바꾸지 않습니다.",
            "월 이자 변화는 변동금리 대출 잔액 × 금리 변화 ÷ 12로 간단히 어림한 값이며, 대출마다 금리는 0% 아래로 내려가지 않는 것으로 봅니다.",
            "총자산의 " + SURVIVABLE_ASSET_RATIO_PCT + "%(가구 금융자산 중 현금·예금 수준)를 부족액에 쓸 수 있다고 가정합니다.",
            "월 소득은 최근 12개월 평균입니다.");

    private final IncomeVolatilityService incomeVolatilityService;
    private final IncomeVolatilityMapper incomeVolatilityMapper;
    private final ScenarioMapper scenarioMapper;

    /** N-17-1 시나리오 기준값. 저장된 소득이 없으면 404 NOT_FOUND(현금흐름 전망과 같음). */
    // N-17-1 기준 상환액은 함께 반환하는 대출 목록의 합으로 구해 목록·합계 기준월을 맞춘다.
    public ScenarioBaseResponse base(long userId) {
        Baseline b = loadBaseline(userId);
        List<ScenarioLoanItem> loanItems = scenarioMapper.selectLatestLoanItems(userId);
        if (loanItems == null) {
            loanItems = List.of();
        }
        long monthlyPaymentAmount = loanItems.stream().mapToLong(ScenarioLoanItem::monthlyPaymentAmount).sum();
        PolicyRateRow rate = scenarioMapper.selectLatestPolicyRate();
        ScenarioBaseResponse.PolicyRate policyRate = rate == null ? null
                : new ScenarioBaseResponse.PolicyRate(rate.getBaseDate(), rate.getRatePct());
        return new ScenarioBaseResponse(b.income(), b.expense(), monthlyPaymentAmount, b.variableBalance(), b.totalAsset(),
                policyRate, ASSUMPTIONS, loanItems);
    }

    /** N-17-2~4 조건을 반영한 상환 여력. 조건은 DB를 읽기 전에 검사한다(범위 밖이면 400). */
    public ScenarioRecalculateResponse recalculate(long userId, ScenarioRecalculateRequest request) {
        ScenarioRecalculateRequest req = request != null ? request : new ScenarioRecalculateRequest();
        BigDecimal ratePctPoint = checkRange(req.getRatePctPoint(), MIN_RATE_PCT_POINT, MAX_RATE_PCT_POINT,
                "ratePctPoint", "금리 변화는 -5~+10%p 사이로 입력해 주세요.");
        BigDecimal incomePct = checkRange(req.getIncomePct(), MIN_INCOME_PCT, MAX_INCOME_PCT,
                "incomePct", "소득 변화는 -100~+100% 사이로 입력해 주세요.");
        BigDecimal expensePct = checkRange(req.getExpensePct(), MIN_EXPENSE_PCT, MAX_EXPENSE_PCT,
                "expensePct", "지출 변화는 -50~+100% 사이로 입력해 주세요.");

        Baseline b = loadBaseline(userId);
        return calculate(b, ratePctPoint, incomePct, expensePct);
    }

    /**
     * N-17-3·4 계산 본체 (DB 없이 테스트할 수 있게 분리). 기준값은 모두 값이 있는 상태로 들어온다(총자산만 null 가능).
     * 공통 재계산 틀은 null을 0으로 보므로, 누락을 구분해야 하는 총자산은 틀에 넣지 않는다.
     */
    static ScenarioRecalculateResponse calculate(Baseline b, BigDecimal ratePctPoint, BigDecimal incomePct, BigDecimal expensePct) {
        Map<String, BigDecimal> current = new LinkedHashMap<>();
        current.put(INCOME, BigDecimal.valueOf(b.income()));
        current.put(EXPENSE, BigDecimal.valueOf(b.expense()));
        Map<String, BigDecimal> changedValues = RecalculationFrame.apply(current, List.of(
                new ValueChange(INCOME, ChangeType.PERCENT, incomePct),
                new ValueChange(EXPENSE, ChangeType.PERCENT, expensePct)));

        // 월 이자 변화 = Σ 변동금리 잔액 × (max(금리 + 변화, 0) − 금리) ÷ 100 ÷ 12. 대출마다 금리는 0% 아래로 내려가지 않고,
        // 합계를 낸 뒤 원 단위로 한 번만 반올림한다(HALF_UP, 음수 0.5는 0에서 먼 쪽 — 프론트 mock도 같은 규칙).
        BigDecimal interestSum = BigDecimal.ZERO;
        for (VariableLoanRow loan : b.variableLoans()) {
            BigDecimal rate = loan.getAnnualRatePct();
            BigDecimal changedRate = rate.add(ratePctPoint).max(BigDecimal.ZERO);
            interestSum = interestSum.add(BigDecimal.valueOf(loan.getBalanceAmount()).multiply(changedRate.subtract(rate)));
        }
        long interestChange = interestSum.divide(HUNDRED.multiply(TWELVE), 0, RoundingMode.HALF_UP).longValueExact();
        // 이자 변화는 변동금리 대출의 상환액에만 더한다(0 아래로는 내려가지 않음). 고정·금리 방식 모름 대출의 상환액은 그대로다.
        long variablePayment = b.variablePayment();
        long fixedPayment = b.payment() - variablePayment;
        long changedPayment = fixedPayment + Math.max(0L, variablePayment + interestChange);

        Side now = side(b.income(), b.expense(), b.payment());
        Side after = side(toWon(changedValues.get(INCOME)), toWon(changedValues.get(EXPENSE)), changedPayment);
        long surplusDiff = after.monthlySurplusAmount() - now.monthlySurplusAmount();

        return new ScenarioRecalculateResponse(now, after, interestChange, surplusDiff,
                survivableMonths(after.monthlySurplusAmount(), b.totalAsset()), verdict(after.monthlySurplusAmount(), surplusDiff),
                ASSUMPTIONS);
    }

    /** 월 잉여 = 소득 − 지출 − 상환액, 상환 부담률은 N-16-1·N-20-4와 같은 함수(연 원리금 ÷ 연소득)로 구한다. */
    private static Side side(long income, long expense, long payment) {
        BigDecimal dsr = FinancialHealthCalculator.calculateRepaymentBurdenRatio(
                BigDecimal.valueOf(payment).multiply(TWELVE), BigDecimal.valueOf(income).multiply(TWELVE));
        return new Side(income, expense, payment, income - expense - payment, dsr);
    }

    /** 적자일 때만 ⌊총자산 × 비율 ÷ 월 부족액⌋. 흑자이거나 총자산을 입력하지 않았으면 null이다. */
    static Long survivableMonths(long changedSurplus, Long totalAsset) {
        if (changedSurplus >= 0 || totalAsset == null) {
            return null;
        }
        return BigDecimal.valueOf(totalAsset).multiply(BigDecimal.valueOf(SURVIVABLE_ASSET_RATIO_PCT))
                .divide(HUNDRED.multiply(BigDecimal.valueOf(-changedSurplus)), 0, RoundingMode.DOWN).longValueExact();
    }

    /** 적자면 SHORTFALL, 지금보다 잉여가 늘면 IMPROVED, 그 밖(흑자 유지)은 STILL_POSITIVE (시나리오 화면과 같은 규칙) */
    static String verdict(long changedSurplus, long surplusDiff) {
        if (changedSurplus < 0) {
            return SHORTFALL;
        }
        return surplusDiff > 0 ? IMPROVED : STILL_POSITIVE;
    }

    /**
     * 저장된 기준값을 읽는다. 기준월은 소득 기준월이고, 월 소득은 최근 12개월 평균(급여소득자는 월급을 12개월로 펼침)이다.
     * 지출·월 원리금은 없으면 0, 변동금리 대출은 없으면 빈 목록, 총자산은 미입력이면 null이다.
     */
    private Baseline loadBaseline(long userId) {
        List<MonthlyIncomeItem> history = incomeVolatilityService.loadIncomeHistory(userId, 0L);
        long income = Math.round(history.stream().mapToLong(MonthlyIncomeItem::getIncome).average().orElse(0));
        return new Baseline(income,
                incomeVolatilityMapper.selectLatestTotalExpense(userId),
                incomeVolatilityMapper.selectLatestLoanMonthlyPayment(userId),
                scenarioMapper.selectLatestVariableLoans(userId),
                scenarioMapper.selectLatestTotalAsset(userId));
    }

    /** 생략은 0(변화 없음), 범위 밖은 400 INVALID_INPUT(fieldErrors에 그 이름) */
    private static BigDecimal checkRange(Double value, BigDecimal min, BigDecimal max, String field, String message) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value.isNaN() || value.isInfinite()) {
            throw badRequest(field, message);
        }
        BigDecimal v = BigDecimal.valueOf(value);
        if (v.compareTo(min) < 0 || v.compareTo(max) > 0) {
            throw badRequest(field, message);
        }
        return v;
    }

    private static ApiException badRequest(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message, List.of(new FieldErrorItem(field, message)));
    }

    private static long toWon(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    /**
     * 시나리오 기준값 (원). payment는 기준월 전체 대출의 월 원리금 합계이고, variableLoans는 그중 변동금리 대출 행이다.
     * 총자산만 미입력이면 null
     */
    record Baseline(long income, long expense, long payment, List<VariableLoanRow> variableLoans, Long totalAsset) {

        /** 변동금리 대출 잔액 합계 (기준값 응답의 variableLoanBalanceAmount) */
        long variableBalance() {
            return variableLoans.stream().mapToLong(VariableLoanRow::getBalanceAmount).sum();
        }

        /** 변동금리 대출 월 원리금 합계. 전체 원리금에서 빼면 고정·금리 방식 모름 대출의 원리금이다 */
        long variablePayment() {
            return variableLoans.stream().mapToLong(VariableLoanRow::getMonthlyPaymentAmount).sum();
        }
    }
}
