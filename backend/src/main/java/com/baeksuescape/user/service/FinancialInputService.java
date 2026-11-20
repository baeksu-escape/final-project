package com.baeksuescape.user.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.DataInputRows.AssetRow;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.dto.DataInputRows.ExpenseRow;
import com.baeksuescape.user.dto.DataInputRows.IncomeRow;
import com.baeksuescape.user.dto.DataInputRows.LoanRow;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.FinancialInputMapper;

// FP-85·FP-86 N-05 데이터 입력 조회·저장(API 정의서 v0.2 INP-01·02). 기준월(BASE_MONTH)별로 저장하고(D-16), 한 트랜잭션으로 저장한다.
// 요청·응답 모양은 프론트 utils/inputValues.js(buildPayload·toValues)와 mocks/dataInputMockHandlers.js를 따른다.
@Service
public class FinancialInputService {

    static final String INVALID_INPUT = "INVALID_INPUT";
    static final String CREDIT_PROFILE_IMPORTED = "CREDIT_PROFILE_IMPORTED";
    private static final String EMPLOYEE = "EMPLOYEE";
    private static final String MANUAL = "MANUAL";
    private static final String FIXED = "FIXED";

    private final FinancialInputMapper mapper;
    private final AltDataImportService altData;
    private final DataInputUsers users;

    public FinancialInputService(FinancialInputMapper mapper, AltDataImportService altData, DataInputUsers users) {
        this.mapper = mapper;
        this.altData = altData;
        this.users = users;
    }

    // INP-01 저장된 입력(가장 최근 기준월)·완료 현황·불러온 대안 데이터. 저장한 적이 없으면 input은 null이다.
    public DataInputDtos.FinancialInputResponse load(long userId) {
        UserAccount user = users.requireUserWithJob(userId);
        List<String> savedBaseMonths = mapper.selectSavedBaseMonths(userId);
        Saved saved = savedBaseMonths.isEmpty() ? null : loadSaved(user, savedBaseMonths.get(savedBaseMonths.size() - 1));
        Map<String, Object> input = saved == null ? null : toInput(user, saved);
        return new DataInputDtos.FinancialInputResponse(input, status(user, saved), altData.importedData(userId), savedBaseMonths);
    }

    // INP-02 저장 — 화면과 같은 규칙으로 다시 검사하고, 어기면 400 INVALID_INPUT과 칸별 오류를 돌려준다.
    // 맨 앞에서 회원 행을 잠가 같은 회원의 동시 저장이 대출·지출 행을 겹쳐 넣지 않게 한다(PR #52 리뷰 5).
    @Transactional
    public DataInputDtos.SaveResponse save(long userId, DataInputDtos.FinancialInput request) {
        users.lock(userId);
        UserAccount user = users.requireUserWithJob(userId);
        String jobType = user.getWorkerTypeCode();
        if (request == null || !jobType.equals(request.jobType())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_INPUT, "직군 정보가 맞지 않습니다.");
        }
        LocalDateTime now = users.now();
        List<FieldErrorItem> errors = DataInputRules.validate(request, jobType, YearMonth.from(now).toString());
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_INPUT, "입력값을 확인해 주세요.", errors);
        }

        String baseMonth = request.baseMonth();
        saveIncome(userId, jobType, baseMonth, request.income(), now);
        mapper.updateWorkPeriod(userId, request.workPeriod().periodMonths().intValueExact(), now);
        List<DataInputDtos.LoanItem> loans = request.loans() == null || request.loans().items() == null ? List.of() : request.loans().items();
        saveLoans(userId, baseMonth, loans, now);
        saveCredit(userId, baseMonth, request.creditProfile(), now);
        boolean noLoans = request.loans() != null && Boolean.TRUE.equals(request.loans().noItems());
        saveAsset(userId, baseMonth, request.assets(), loans.isEmpty() ? (noLoans ? "Y" : null) : "N", now);
        saveExpenses(userId, baseMonth, request.fixedExpense(), request.otherExpenses(), now);

        Saved saved = loadSaved(user, baseMonth);
        return new DataInputDtos.SaveResponse(users.toOffset(now), status(user, saved), mapper.selectSavedBaseMonths(userId));
    }

    // ── 저장 ──

    // N-05-2 소득 — 급여소득자는 기준월 SALARY 1행, 자영업자·프리랜서는 최근 12개월을 달마다 MONTHLY_INCOME으로 저장한다.
    // 저장한 기준월의 12개월 구간은 이번 입력이 기준이다: 구간 안의 달은 이번 값으로 바꾸고, 빈 달은 그 달 행을 지운다(빈칸은 미입력, 0원은 입력한 값).
    // 구간 밖의 달은 그대로 둔다. 그래서 다른 기준월에 저장한 달도 이번 구간과 겹치면 이번 값으로 바뀌거나 지워진다(PR #52 리뷰 2, 의도한 동작).
    private void saveIncome(long userId, String jobType, String baseMonth, DataInputDtos.Income income, LocalDateTime now) {
        if (EMPLOYEE.equals(jobType)) {
            mapper.mergeIncome(incomeRow(userId, baseMonth, "SALARY", income.monthlySalary(), now));
            return;
        }
        Map<String, BigDecimal> amounts = new HashMap<>();
        if (income != null && income.items() != null) {
            income.items().forEach(item -> amounts.put(item.month(), item.amount()));
        }
        for (String month : incomeWindow(baseMonth)) {
            BigDecimal amount = amounts.get(month);
            if (amount == null) {
                mapper.deleteIncome(userId, month);
            } else {
                mapper.mergeIncome(incomeRow(userId, month, "MONTHLY_INCOME", amount, now));
            }
        }
    }

    private static IncomeRow incomeRow(long userId, String month, String kind, BigDecimal amount, LocalDateTime now) {
        IncomeRow row = new IncomeRow();
        row.setUserId(userId);
        row.setBaseMonth(month);
        row.setIncomeKindCode(kind);
        row.setIncomeAmt(amount.longValueExact());
        row.setInputDate(now.toLocalDate());
        row.setNow(now);
        return row;
    }

    // N-05-3 대출 — 그 기준월의 직접 입력(MANUAL) 행만 바꾼다. 불러온 대출(IMPORTED)은 건드리지 않는다.
    private void saveLoans(long userId, String baseMonth, List<DataInputDtos.LoanItem> items, LocalDateTime now) {
        mapper.deleteManualLoans(userId, baseMonth);
        for (DataInputDtos.LoanItem item : items) {
            LoanRow row = new LoanRow();
            row.setUserId(userId);
            row.setBaseMonth(baseMonth);
            row.setLoanTypeCode(item.loanTypeCode());
            row.setBalanceAmt(item.balanceAmount().longValueExact());
            row.setAnnualRatePct(item.annualRatePercent());
            row.setRateTypeCode(item.rateType());
            row.setRemainingMonths(item.remainingMonths().intValueExact());
            row.setMonthlyPaymentAmt(item.monthlyPaymentAmount().longValueExact());
            row.setSourceCode(MANUAL);
            row.setNow(now);
            mapper.insertLoan(row);
        }
    }

    // N-05-4·O-15 자산·대출 없음 — 저장할 때마다 기준월 행을 만든다(저장한 기준월 기록 겸). 자산 칸이 모두 비면 TOTAL_ASSET_AMT NULL(0원과 구분).
    // DDL C13(FP-227) 자산 4종을 화면이 보낸 그대로 각각 저장한다(빈 칸 NULL, 0은 0). 총자산은 그 합계다(totalAsset).
    // noLoanYn: 대출 줄이 있으면 N, 줄 없이 "대출 없음"이면 Y, 둘 다 아니면 NULL(미확인).
    private void saveAsset(long userId, String baseMonth, DataInputDtos.Assets assets, String noLoanYn, LocalDateTime now) {
        AssetRow row = new AssetRow();
        row.setUserId(userId);
        row.setBaseMonth(baseMonth);
        if (assets != null) {
            row.setDepositAmt(toLong(assets.depositAmount()));
            row.setInvestmentAmt(toLong(assets.investmentAmount()));
            row.setRealEstateAmt(toLong(assets.realEstateAmount()));
            row.setOtherAssetAmt(toLong(assets.otherAmount()));
        }
        row.setTotalAssetAmt(totalAsset(assets));
        row.setNoLoanYn(noLoanYn);
        row.setNow(now);
        mapper.mergeAsset(row);
    }

    static Long totalAsset(DataInputDtos.Assets assets) {
        if (assets == null) {
            return null;
        }
        List<BigDecimal> values = Stream.of(assets.depositAmount(), assets.investmentAmount(), assets.realEstateAmount(), assets.otherAmount())
                .filter(Objects::nonNull)
                .toList();
        return values.isEmpty() ? null : values.stream().reduce(BigDecimal.ZERO, BigDecimal::add).longValueExact();
    }

    // D-29 카드·신용 이용(직접 입력) — 기준월 말일을 BASE_DATE로 한 행. "신용 이력이 없어요"면 연체·현금서비스·신규 대출·카드 값은 NULL이고
    // CREDIT_HISTORY_DAYS를 0(신용 이력 일수 0)으로 남겨 다시 열 때 체크를 되살린다. 모든 칸이 비고 체크도 없으면 그 행을 지운다.
    private void saveCredit(long userId, String baseMonth, DataInputDtos.CreditProfile credit, LocalDateTime now) {
        if (credit == null) {
            return;
        }
        LocalDate baseDate = creditBaseDate(baseMonth);
        boolean noHistory = Boolean.TRUE.equals(credit.noCreditHistory());
        CreditRow row = new CreditRow();
        row.setUserId(userId);
        row.setBaseDate(baseDate);
        row.setSourceCode(MANUAL);
        row.setNow(now);
        row.setPrivateLenderLoanBalanceAmt(toLong(credit.privateLenderLoanBalanceAmount()));
        if (noHistory) {
            row.setCreditHistoryDays(0);
        } else {
            row.setCardLimitAmt(toLong(credit.cardLimitAmount()));
            row.setCardMonthlySpendAmt(toLong(credit.cardMonthlySpendAmount()));
            row.setCardUtilPct(cardUtilPct(row.getCardMonthlySpendAmt(), row.getCardLimitAmt()));
            row.setDelinqCount12m(toInt(credit.delinquencyCount12m()));
            row.setCashAdvanceMonths(toInt(credit.cashAdvanceMonths()));
            row.setNewLoanCount3m(toInt(credit.newLoanCount3m()));
        }
        boolean empty = !noHistory && Stream.of(row.getPrivateLenderLoanBalanceAmt(), row.getCardLimitAmt(), row.getCardMonthlySpendAmt(),
                row.getDelinqCount12m(), row.getCashAdvanceMonths(), row.getNewLoanCount3m()).allMatch(Objects::isNull);
        if (empty) {
            mapper.deleteManualCredit(userId, baseDate);
        } else if (mapper.mergeManualCredit(row) == 0) {
            // UK_UCP_USER_DATE(USER_ID, BASE_DATE)로 기준일당 한 행뿐이다. 그 기준일에 불러온(IMPORTED) 행이 있으면 MERGE가 0행을 바꾼다.
            // 저장된 척 성공으로 응답하지 않고 409로 실패시켜 트랜잭션 전체(소득·대출·자산·지출 저장 포함)를 되돌린다(PR #52 리뷰 1).
            throw new ApiException(HttpStatus.CONFLICT, CREDIT_PROFILE_IMPORTED, "불러온 신용 정보가 있어 직접 입력을 저장할 수 없습니다.");
        }
    }

    // 카드 한도소진율(%) = 사용액 / 한도 × 100(소수 둘째 자리 반올림). 한도가 없거나 0이면 NULL.
    static BigDecimal cardUtilPct(Long spend, Long limit) {
        if (spend == null || limit == null || limit <= 0) {
            return null;
        }
        return BigDecimal.valueOf(spend).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(limit), 2, RoundingMode.HALF_UP);
    }

    static LocalDate creditBaseDate(String baseMonth) {
        return YearMonth.parse(baseMonth).atEndOfMonth();
    }

    // N-05-5 지출 — 그 기준월 지출을 다시 쓴다. 월 고정 지출은 FIXED, 할부는 INSTALLMENT, 구독·멤버십은 SUBSCRIPTION,
    // 그 밖의 종류는 OTHER + EXPENSE_CATEGORY(종류 이름). 내용(memo)은 DESCRIPTION.
    private void saveExpenses(long userId, String baseMonth, DataInputDtos.FixedExpense fixed, DataInputDtos.OtherExpenses others,
            LocalDateTime now) {
        mapper.deleteExpenses(userId, baseMonth);
        if (fixed != null && fixed.monthlyAmount() != null) {
            mapper.insertExpense(expenseRow(userId, baseMonth, FIXED, null, null, fixed.monthlyAmount(), now));
        }
        if (others == null || others.items() == null) {
            return;
        }
        for (DataInputDtos.OtherExpenseItem item : others.items()) {
            String group = expenseGroupOf(item.category());
            String category = "OTHER".equals(group) ? DataInputRules.EXPENSE_CATEGORY_LABELS.get(item.category()) : null;
            String memo = item.memo() == null || item.memo().isBlank() ? null : item.memo().trim();
            mapper.insertExpense(expenseRow(userId, baseMonth, group, category, memo, item.monthlyAmount(), now));
        }
    }

    static String expenseGroupOf(String category) {
        if ("INSTALLMENT".equals(category) || "SUBSCRIPTION".equals(category)) {
            return category;
        }
        return "OTHER";
    }

    private static ExpenseRow expenseRow(long userId, String baseMonth, String group, String category, String description, BigDecimal amount,
            LocalDateTime now) {
        ExpenseRow row = new ExpenseRow();
        row.setUserId(userId);
        row.setBaseMonth(baseMonth);
        row.setExpenseGroupCode(group);
        row.setExpenseCategory(category);
        row.setDescription(description);
        row.setMonthlyAmt(amount.longValueExact());
        row.setNow(now);
        return row;
    }

    // ── 조회·완료 현황 ──

    // 한 기준월에 저장된 값 묶음.
    private record Saved(String baseMonth, AssetRow asset, List<IncomeRow> incomes, Integer workPeriod, List<LoanRow> loans, CreditRow credit,
            List<ExpenseRow> expenses) {
    }

    private Saved loadSaved(UserAccount user, String baseMonth) {
        long userId = user.getUserId();
        List<String> window = EMPLOYEE.equals(user.getWorkerTypeCode()) ? List.of(baseMonth) : incomeWindow(baseMonth);
        return new Saved(baseMonth, mapper.selectAsset(userId, baseMonth), mapper.selectIncomes(userId, window.get(0), baseMonth),
                mapper.selectWorkPeriod(userId), mapper.selectLoans(userId, baseMonth), mapper.selectManualCredit(userId, creditBaseDate(baseMonth)),
                mapper.selectExpenses(userId, baseMonth));
    }

    // N-05-8 완료 현황 — 화면 completionItems.js 6항목과 같은 규칙(+ 할부·정기결제·카드·신용은 입력 여부만).
    private DataInputDtos.InputStatus status(UserAccount user, Saved saved) {
        Map<String, Boolean> sections = new LinkedHashMap<>();
        boolean employee = EMPLOYEE.equals(user.getWorkerTypeCode());
        sections.put("income", saved != null && (employee ? !saved.incomes().isEmpty()
                : saved.incomes().stream().map(IncomeRow::getBaseMonth).distinct().count() >= DataInputRules.INCOME_MONTHS_MAX));
        sections.put("workPeriod", saved != null && saved.workPeriod() != null);
        sections.put("loans", saved != null && (!saved.loans().isEmpty() || (saved.asset() != null && "Y".equals(saved.asset().getNoLoanYn()))));
        sections.put("creditProfile", saved != null && saved.credit() != null);
        sections.put("assets", saved != null && saved.asset() != null && saved.asset().getTotalAssetAmt() != null);
        sections.put("fixedExpense", saved != null && saved.expenses().stream().anyMatch(row -> FIXED.equals(row.getExpenseGroupCode())));
        sections.put("otherExpenses", saved != null && saved.expenses().stream().anyMatch(row -> !FIXED.equals(row.getExpenseGroupCode())));
        return new DataInputDtos.InputStatus(sections, altData.completion(user.getUserId()));
    }

    // 저장 값을 화면 요청 본문 모양으로 되돌린다(toValues가 읽는 모양). 자산은 DDL C13부터 4종을 그대로, 그 전에 저장한 행은 '기타 자산'에 합계를 넣는다.
    private Map<String, Object> toInput(UserAccount user, Saved saved) {
        String baseMonth = saved.baseMonth();
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("jobType", user.getWorkerTypeCode());
        input.put("baseMonth", baseMonth);
        AssetRow asset = saved.asset();
        input.put("savedAt", users.toOffset(asset.getUpdatedAt() != null ? asset.getUpdatedAt() : asset.getCreatedAt()));

        Map<String, Object> income = section(baseMonth);
        if (EMPLOYEE.equals(user.getWorkerTypeCode())) {
            income.put("incomeType", "MONTHLY_SALARY");
            income.put("monthlySalary", saved.incomes().isEmpty() ? null : saved.incomes().get(0).getIncomeAmt());
        } else {
            income.put("incomeType", "MONTHLY_INCOME");
            income.put("items", saved.incomes().stream().map(row -> item("month", row.getBaseMonth(), "amount", row.getIncomeAmt())).toList());
        }
        input.put("income", income);

        Map<String, Object> workPeriod = section(baseMonth);
        workPeriod.put("periodMonths", saved.workPeriod());
        input.put("workPeriod", workPeriod);

        Map<String, Object> loans = section(baseMonth);
        loans.put("items", saved.loans().stream().filter(row -> MANUAL.equals(row.getSourceCode())).map(FinancialInputService::loanItem).toList());
        loans.put("noItems", "Y".equals(asset.getNoLoanYn()));
        input.put("loans", loans);

        input.put("creditProfile", creditSection(baseMonth, saved.credit()));

        // DDL C13(FP-227) 4종 중 하나라도 값이 있으면 저장된 4종을 그대로 돌려준다.
        // 4종이 모두 NULL인 행(C13 전에 저장해 합계만 있음)은 예전처럼 '기타 자산'에 총자산을 넣는다.
        Map<String, Object> assets = section(baseMonth);
        boolean hasBreakdown = Stream.of(asset.getDepositAmt(), asset.getInvestmentAmt(), asset.getRealEstateAmt(), asset.getOtherAssetAmt())
                .anyMatch(Objects::nonNull);
        assets.put("depositAmount", hasBreakdown ? asset.getDepositAmt() : null);
        assets.put("investmentAmount", hasBreakdown ? asset.getInvestmentAmt() : null);
        assets.put("realEstateAmount", hasBreakdown ? asset.getRealEstateAmt() : null);
        assets.put("otherAmount", hasBreakdown ? asset.getOtherAssetAmt() : asset.getTotalAssetAmt());
        assets.put("totalAmount", asset.getTotalAssetAmt());
        input.put("assets", assets);

        Map<String, Object> fixed = section(baseMonth);
        fixed.put("monthlyAmount", saved.expenses().stream().filter(row -> FIXED.equals(row.getExpenseGroupCode()))
                .map(ExpenseRow::getMonthlyAmt).findFirst().orElse(null));
        input.put("fixedExpense", fixed);

        Map<String, Object> others = section(baseMonth);
        List<Map<String, Object>> otherItems = new ArrayList<>();
        for (ExpenseRow row : saved.expenses()) {
            if (!FIXED.equals(row.getExpenseGroupCode())) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("category", categoryOf(row));
                item.put("memo", row.getDescription() == null ? "" : row.getDescription());
                item.put("monthlyAmount", row.getMonthlyAmt());
                otherItems.add(item);
            }
        }
        others.put("items", otherItems);
        input.put("otherExpenses", others);
        return input;
    }

    private static Map<String, Object> creditSection(String baseMonth, CreditRow credit) {
        Map<String, Object> section = section(baseMonth);
        section.put("cardLimitAmount", credit == null ? null : credit.getCardLimitAmt());
        section.put("cardMonthlySpendAmount", credit == null ? null : credit.getCardMonthlySpendAmt());
        section.put("delinquencyCount12m", credit == null ? null : credit.getDelinqCount12m());
        section.put("cashAdvanceMonths", credit == null ? null : credit.getCashAdvanceMonths());
        section.put("newLoanCount3m", credit == null ? null : credit.getNewLoanCount3m());
        section.put("privateLenderLoanBalanceAmount", credit == null ? null : credit.getPrivateLenderLoanBalanceAmt());
        section.put("noCreditHistory", credit != null && Integer.valueOf(0).equals(credit.getCreditHistoryDays()));
        return section;
    }

    private static Map<String, Object> loanItem(LoanRow row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("loanTypeCode", row.getLoanTypeCode());
        item.put("balanceAmount", row.getBalanceAmt());
        item.put("annualRatePercent", row.getAnnualRatePct() == null ? null : row.getAnnualRatePct().stripTrailingZeros());
        item.put("rateType", row.getRateTypeCode());
        item.put("monthlyPaymentAmount", row.getMonthlyPaymentAmt());
        item.put("remainingMonths", row.getRemainingMonths());
        return item;
    }

    // 지출 행 → 화면 종류 코드. OTHER는 저장한 종류 이름으로 찾고, 모르는 이름이면 '기타'(ETC).
    static String categoryOf(ExpenseRow row) {
        if ("INSTALLMENT".equals(row.getExpenseGroupCode()) || "SUBSCRIPTION".equals(row.getExpenseGroupCode())) {
            return row.getExpenseGroupCode();
        }
        return DataInputRules.EXPENSE_CATEGORY_LABELS.entrySet().stream()
                .filter(entry -> entry.getValue().equals(row.getExpenseCategory()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse("ETC");
    }

    private static Map<String, Object> section(String baseMonth) {
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("baseMonth", baseMonth);
        return section;
    }

    private static Map<String, Object> item(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put(k1, v1);
        item.put(k2, v2);
        return item;
    }

    // 기준월로 끝나는 최근 12개월(오래된 달부터).
    static List<String> incomeWindow(String baseMonth) {
        YearMonth base = YearMonth.parse(baseMonth);
        List<String> months = new ArrayList<>();
        for (int i = DataInputRules.INCOME_MONTHS_MAX - 1; i >= 0; i--) {
            months.add(base.minusMonths(i).toString());
        }
        return months;
    }

    private static Long toLong(BigDecimal value) {
        return value == null ? null : value.longValueExact();
    }

    private static Integer toInt(BigDecimal value) {
        return value == null ? null : value.intValueExact();
    }
}
