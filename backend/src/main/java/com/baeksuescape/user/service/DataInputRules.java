package com.baeksuescape.user.service;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputDtos;

// FP-86 N-05-7 서버 입력 검사 — 화면 규칙(validation/inputRules.js·inputValidation.js)과 상한(config/validationLimits.js)을 그대로 옮겼다.
// 오류는 칸마다 첫 번째 것만 남기고, field는 화면 serverErrors.js가 읽는 경로(예: 'loans.items[0].balanceAmount')로 쓴다.
public final class DataInputRules {

    // config/validationLimits.js와 같은 값. '임시' 값은 팀이 정하면 두 파일을 함께 바꾼다.
    static final BigDecimal MONTHLY_AMOUNT_MAX = new BigDecimal("1000000000");
    static final BigDecimal BALANCE_AMOUNT_MAX = new BigDecimal("100000000000");
    // DDL CK_ULN_RATE(0~20%, 법정 최고금리)
    static final BigDecimal ANNUAL_RATE_MAX_PERCENT = new BigDecimal("20");
    static final BigDecimal REMAINING_MONTHS_MAX = new BigDecimal("600");
    static final int INCOME_MONTHS_MAX = 12;
    static final BigDecimal WORK_PERIOD_MONTHS_MAX = new BigDecimal("600");
    // 카드·신용 건수 칸 상한 — DDL NUMBER(3)
    static final BigDecimal CREDIT_COUNT_MAX = new BigDecimal("999");
    static final BigDecimal CASH_ADVANCE_MONTHS_MAX = new BigDecimal("12");
    static final int MEMO_MAX_LENGTH = 50;

    static final String REQUIRED_MESSAGE = "필수 입력 항목입니다.";
    static final String OPTION_MESSAGE = "선택지에서 골라 주세요.";

    // DIM_LOAN_TYPE 6개(화면 LOAN_TYPE_OPTIONS)와 금리 방식(화면 LOAN_RATE_TYPE_OPTIONS).
    static final Set<String> LOAN_TYPE_CODES = Set.of("CREDIT", "BUSINESS_OPERATING", "JEONSE", "MORTGAGE", "CARD_LOAN", "OTHER");
    static final Set<String> RATE_TYPE_CODES = Set.of("FIXED", "VARIABLE");
    // 할부·정기결제 종류(화면 OTHER_EXPENSE_CATEGORY_OPTIONS) — 코드 → 화면 이름. OTHER 행의 EXPENSE_CATEGORY에 이름을 저장한다.
    static final Map<String, String> EXPENSE_CATEGORY_LABELS = expenseCategoryLabels();

    private static final Pattern MONTH_PATTERN = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");

    private DataInputRules() {
    }

    private static Map<String, String> expenseCategoryLabels() {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put("INSURANCE", "보험료");
        labels.put("EDUCATION", "교육비");
        labels.put("MEDICAL", "의료비");
        labels.put("SUBSCRIPTION", "구독·멤버십");
        labels.put("INSTALLMENT", "할부");
        labels.put("FAMILY_EVENT", "경조사비");
        labels.put("ETC", "기타");
        return labels;
    }

    // N-05-7 요청 전체를 검사한다. 오류가 없으면 빈 목록. nowMonth는 미래 월 판단 기준('YYYY-MM').
    public static List<FieldErrorItem> validate(DataInputDtos.FinancialInput input, String jobType, String nowMonth) {
        Errors errors = new Errors();
        String baseMonth = input.baseMonth();
        if (isBlank(baseMonth)) {
            errors.add("baseMonth", REQUIRED_MESSAGE);
        } else {
            errors.add("baseMonth", monthError(baseMonth, nowMonth));
        }
        checkIncome(input.income(), jobType, baseMonth, nowMonth, errors);
        checkWorkPeriod(input.workPeriod(), errors);
        checkLoans(input.loans(), errors);
        checkCredit(input.creditProfile(), errors);
        checkAssets(input.assets(), errors);
        if (input.fixedExpense() != null) {
            errors.add("fixedExpense.monthlyAmount", amountError(input.fixedExpense().monthlyAmount(), MONTHLY_AMOUNT_MAX));
        }
        checkOtherExpenses(input.otherExpenses(), errors);
        return errors.toList();
    }

    // N-05-2 소득 — 급여소득자는 월급 하나(필수), 자영업자·프리랜서는 기준월까지 최근 12개월(한 달 이상, 같은 달 중복 불가).
    private static void checkIncome(DataInputDtos.Income income, String jobType, String baseMonth, String nowMonth, Errors errors) {
        if ("EMPLOYEE".equals(jobType)) {
            BigDecimal salary = income == null ? null : income.monthlySalary();
            errors.add("income.monthlySalary", salary == null ? REQUIRED_MESSAGE : amountError(salary, MONTHLY_AMOUNT_MAX));
            return;
        }
        List<DataInputDtos.IncomeItem> items = income == null || income.items() == null ? List.of() : income.items();
        if (items.isEmpty()) {
            errors.add("income.items", "소득을 한 달 이상 입력해 주세요.");
        }
        if (items.size() > INCOME_MONTHS_MAX) {
            errors.add("income.items", "최근 " + INCOME_MONTHS_MAX + "개월까지만 입력할 수 있습니다.");
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < items.size(); i++) {
            DataInputDtos.IncomeItem item = items.get(i);
            String path = "income.items[" + i + "]";
            if (isBlank(item.month())) {
                errors.add(path + ".month", REQUIRED_MESSAGE);
            } else {
                errors.add(path + ".month", incomeMonthError(item.month(), baseMonth, nowMonth));
                if (!seen.add(item.month())) {
                    errors.add(path + ".month", "같은 달이 이미 입력되어 있습니다.");
                }
            }
            errors.add(path + ".amount", amountError(item.amount(), MONTHLY_AMOUNT_MAX));
        }
    }

    private static void checkWorkPeriod(DataInputDtos.WorkPeriod workPeriod, Errors errors) {
        BigDecimal months = workPeriod == null ? null : workPeriod.periodMonths();
        errors.add("workPeriod.periodMonths", months == null ? REQUIRED_MESSAGE : numberError(months, WORK_PERIOD_MONTHS_MAX, true, "개월"));
    }

    // N-05-3 대출 — 모든 칸 필수(남은 기간 포함, 0 허용). 금리는 0~20%(CK_ULN_RATE).
    private static void checkLoans(DataInputDtos.Loans loans, Errors errors) {
        List<DataInputDtos.LoanItem> items = loans == null || loans.items() == null ? List.of() : loans.items();
        for (int i = 0; i < items.size(); i++) {
            DataInputDtos.LoanItem item = items.get(i);
            String path = "loans.items[" + i + "].";
            errors.add(path + "loanTypeCode", optionError(item.loanTypeCode(), LOAN_TYPE_CODES));
            errors.add(path + "balanceAmount", requiredAmount(item.balanceAmount(), BALANCE_AMOUNT_MAX));
            errors.add(path + "annualRatePercent",
                    item.annualRatePercent() == null ? REQUIRED_MESSAGE : numberError(item.annualRatePercent(), ANNUAL_RATE_MAX_PERCENT, false, "%"));
            errors.add(path + "rateType", optionError(item.rateType(), RATE_TYPE_CODES));
            errors.add(path + "monthlyPaymentAmount", requiredAmount(item.monthlyPaymentAmount(), MONTHLY_AMOUNT_MAX));
            errors.add(path + "remainingMonths",
                    item.remainingMonths() == null ? REQUIRED_MESSAGE : numberError(item.remainingMonths(), REMAINING_MONTHS_MAX, true, "개월"));
        }
    }

    // D-29 카드·신용 이용 — 모두 선택 칸. "신용 이력이 없어요"면 대부업 잔액 외 칸은 검사하지 않는다(null로 저장).
    private static void checkCredit(DataInputDtos.CreditProfile credit, Errors errors) {
        if (credit == null) {
            return;
        }
        if (!Boolean.TRUE.equals(credit.noCreditHistory())) {
            errors.add("creditProfile.cardLimitAmount", amountError(credit.cardLimitAmount(), BALANCE_AMOUNT_MAX));
            String spendError = amountError(credit.cardMonthlySpendAmount(), MONTHLY_AMOUNT_MAX);
            if (spendError == null && credit.cardMonthlySpendAmount() != null && credit.cardLimitAmount() != null
                    && credit.cardMonthlySpendAmount().compareTo(credit.cardLimitAmount()) > 0) {
                spendError = "월 카드 사용액은 카드 한도보다 클 수 없습니다.";
            }
            errors.add("creditProfile.cardMonthlySpendAmount", spendError);
            errors.add("creditProfile.delinquencyCount12m", numberError(credit.delinquencyCount12m(), CREDIT_COUNT_MAX, true, "회"));
            errors.add("creditProfile.cashAdvanceMonths", numberError(credit.cashAdvanceMonths(), CASH_ADVANCE_MONTHS_MAX, true, "개월"));
            errors.add("creditProfile.newLoanCount3m", numberError(credit.newLoanCount3m(), CREDIT_COUNT_MAX, true, "건"));
        }
        errors.add("creditProfile.privateLenderLoanBalanceAmount", amountError(credit.privateLenderLoanBalanceAmount(), BALANCE_AMOUNT_MAX));
    }

    private static void checkAssets(DataInputDtos.Assets assets, Errors errors) {
        if (assets == null) {
            return;
        }
        errors.add("assets.depositAmount", amountError(assets.depositAmount(), BALANCE_AMOUNT_MAX));
        errors.add("assets.investmentAmount", amountError(assets.investmentAmount(), BALANCE_AMOUNT_MAX));
        errors.add("assets.realEstateAmount", amountError(assets.realEstateAmount(), BALANCE_AMOUNT_MAX));
        errors.add("assets.otherAmount", amountError(assets.otherAmount(), BALANCE_AMOUNT_MAX));
    }

    private static void checkOtherExpenses(DataInputDtos.OtherExpenses expenses, Errors errors) {
        List<DataInputDtos.OtherExpenseItem> items = expenses == null || expenses.items() == null ? List.of() : expenses.items();
        for (int i = 0; i < items.size(); i++) {
            DataInputDtos.OtherExpenseItem item = items.get(i);
            String path = "otherExpenses.items[" + i + "].";
            errors.add(path + "category", optionError(item.category(), EXPENSE_CATEGORY_LABELS.keySet()));
            if (item.memo() != null && item.memo().length() > MEMO_MAX_LENGTH) {
                errors.add(path + "memo", MEMO_MAX_LENGTH + "자 이하로 입력해 주세요.");
            }
            errors.add(path + "monthlyAmount", requiredAmount(item.monthlyAmount(), MONTHLY_AMOUNT_MAX));
        }
    }

    // ── 칸 규칙(inputRules.js) ──

    // 숫자 공통 검사 — 0 이상, 정수(integer일 때), 상한 이하. 값이 없으면 검사하지 않는다(필수 검사는 따로).
    static String numberError(BigDecimal value, BigDecimal max, boolean integer, String unit) {
        if (value == null) {
            return null;
        }
        if (value.signum() < 0) {
            return "0 이상으로 입력해 주세요.";
        }
        if (integer && value.stripTrailingZeros().scale() > 0) {
            return "소수점 없이 입력해 주세요.";
        }
        if (value.compareTo(max) > 0) {
            return NumberFormat.getIntegerInstance(Locale.KOREA).format(max) + unit + " 이하로 입력해 주세요.";
        }
        return null;
    }

    // 금액 칸 — 원 단위 정수, 0 이상, max원 이하.
    static String amountError(BigDecimal value, BigDecimal max) {
        return numberError(value, max, true, "원");
    }

    private static String requiredAmount(BigDecimal value, BigDecimal max) {
        return value == null ? REQUIRED_MESSAGE : amountError(value, max);
    }

    private static String optionError(String value, Set<String> allowed) {
        if (isBlank(value)) {
            return REQUIRED_MESSAGE;
        }
        return allowed.contains(value) ? null : OPTION_MESSAGE;
    }

    // 달 공통 검사 — 'YYYY-MM' 형식이고 이번 달보다 늦지 않아야 한다.
    static String monthError(String value, String nowMonth) {
        if (!isValidMonth(value)) {
            return "연-월(YYYY-MM) 형식으로 입력해 주세요.";
        }
        if (value.compareTo(nowMonth) > 0) {
            return "미래의 달은 입력할 수 없습니다.";
        }
        return null;
    }

    // 월별 소득의 '소득 월' — 형식·미래 월에 더해, 기준월부터 거꾸로 최근 12개월 안이어야 한다.
    static String incomeMonthError(String value, String baseMonth, String nowMonth) {
        String monthError = monthError(value, nowMonth);
        if (monthError != null || !isValidMonth(baseMonth)) {
            return monthError;
        }
        YearMonth month = YearMonth.parse(value);
        YearMonth base = YearMonth.parse(baseMonth);
        if (month.isAfter(base)) {
            return "기준월보다 늦은 달은 입력할 수 없습니다.";
        }
        if (!month.isAfter(base.minusMonths(INCOME_MONTHS_MAX))) {
            return "기준월 기준 최근 " + INCOME_MONTHS_MAX + "개월(" + base.minusMonths(INCOME_MONTHS_MAX - 1) + "~" + baseMonth
                    + ")만 입력할 수 있습니다.";
        }
        return null;
    }

    static boolean isValidMonth(String value) {
        return value != null && MONTH_PATTERN.matcher(value).matches();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    // 칸마다 첫 오류만 남기는 모음.
    private static final class Errors {
        private final Map<String, String> byField = new LinkedHashMap<>();

        void add(String field, String message) {
            if (message != null) {
                byField.putIfAbsent(field, message);
            }
        }

        List<FieldErrorItem> toList() {
            List<FieldErrorItem> list = new ArrayList<>();
            byField.forEach((field, message) -> list.add(new FieldErrorItem(field, message)));
            return list;
        }
    }
}
