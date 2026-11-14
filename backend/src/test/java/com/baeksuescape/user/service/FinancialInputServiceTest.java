package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.DataInputFixtures.codeOf;
import static com.baeksuescape.user.service.DataInputFixtures.member;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.DataInputRows.AssetRow;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.dto.DataInputRows.ExpenseRow;
import com.baeksuescape.user.dto.DataInputRows.IncomeRow;
import com.baeksuescape.user.dto.DataInputRows.LoanRow;
import com.baeksuescape.user.mapper.FinancialInputMapper;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-85·FP-86 N-05 데이터 입력 저장·조회(INP-01·02). DB는 mock으로 대신한다. 오늘은 2026-11-14(UserFixtures.CLOCK).
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FinancialInputServiceTest {

    @Mock
    private FinancialInputMapper mapper;
    @Mock
    private AltDataImportService altData;
    @Mock
    private UserAccountMapper userMapper;

    private FinancialInputService service;

    @BeforeEach
    void setUp() {
        service = new FinancialInputService(mapper, altData, new DataInputUsers(userMapper, UserFixtures.CLOCK));
        given(userMapper.selectById(1L)).willReturn(member(1L, "EMPLOYEE"));
        given(userMapper.selectById(2L)).willReturn(member(2L, "FREELANCER"));
        given(mapper.selectSavedBaseMonths(anyLong())).willReturn(List.of("2026-10"));
        given(altData.completion(anyLong())).willReturn(Map.of());
    }

    private static BigDecimal n(String value) {
        return value == null ? null : new BigDecimal(value);
    }

    private static DataInputDtos.LoanItem loan(String rate, String remainingMonths) {
        return new DataInputDtos.LoanItem("CREDIT", n("10000000"), n(rate), "FIXED", n("300000"), n(remainingMonths));
    }

    // 급여소득자 기본 요청(대출 없음 체크, 자산·지출 비움). 필요한 섹션만 바꿔 쓴다.
    private static DataInputDtos.FinancialInput employee(DataInputDtos.Loans loans, DataInputDtos.CreditProfile credit,
            DataInputDtos.Assets assets, DataInputDtos.OtherExpenses others) {
        return new DataInputDtos.FinancialInput("EMPLOYEE", "2026-10", new DataInputDtos.Income("MONTHLY_SALARY", n("3000000"), null),
                new DataInputDtos.WorkPeriod(n("24")), loans, credit, assets, new DataInputDtos.FixedExpense(n("800000")), others);
    }

    private static DataInputDtos.Loans noLoans() {
        return new DataInputDtos.Loans(List.of(), true);
    }

    private static DataInputDtos.Assets emptyAssets() {
        return new DataInputDtos.Assets(null, null, null, null);
    }

    private static List<FieldErrorItem> fieldErrorsOf(Runnable action) {
        ApiException error = catchThrowableOfType(action::run, ApiException.class);
        assertThat(error).isNotNull();
        assertThat(error.getCode()).isEqualTo("INVALID_INPUT");
        return error.getFieldErrors();
    }

    private AssetRow savedAsset() {
        ArgumentCaptor<AssetRow> asset = ArgumentCaptor.forClass(AssetRow.class);
        verify(mapper).mergeAsset(asset.capture());
        return asset.getValue();
    }

    @Test
    void noLoanCheckSavesYAndRemovesManualLoans() {
        service.save(1L, employee(noLoans(), null, emptyAssets(), null));

        verify(mapper).deleteManualLoans(1L, "2026-10");
        verify(mapper, never()).insertLoan(any());
        assertThat(savedAsset().getNoLoanYn()).isEqualTo("Y");
    }

    @Test
    void addingLoanAfterNoLoanSavesN() {
        service.save(1L, employee(new DataInputDtos.Loans(List.of(loan("8.9", "24")), true), null, emptyAssets(), null));

        ArgumentCaptor<LoanRow> row = ArgumentCaptor.forClass(LoanRow.class);
        verify(mapper).insertLoan(row.capture());
        assertThat(row.getValue().getSourceCode()).isEqualTo("MANUAL");
        assertThat(row.getValue().getConsentId()).isNull();
        assertThat(row.getValue().getLoanTypeCode()).isEqualTo("CREDIT");
        assertThat(savedAsset().getNoLoanYn()).isEqualTo("N");
    }

    @Test
    void neitherLoanNorCheckLeavesNoLoanNull() {
        service.save(1L, employee(new DataInputDtos.Loans(List.of(), false), null, emptyAssets(), null));
        assertThat(savedAsset().getNoLoanYn()).isNull();
    }

    @Test
    void emptyAssetsSaveNullTotalAndFilledOnesSum() {
        service.save(1L, employee(noLoans(), null, emptyAssets(), null));
        assertThat(savedAsset().getTotalAssetAmt()).isNull();

        assertThat(FinancialInputService.totalAsset(new DataInputDtos.Assets(n("1000000"), null, n("0"), n("500000")))).isEqualTo(1500000L);
        assertThat(FinancialInputService.totalAsset(new DataInputDtos.Assets(n("0"), null, null, null))).isZero();
    }

    @Test
    void loanRateAbove20PercentIsRejected() {
        List<FieldErrorItem> errors = fieldErrorsOf(
                () -> service.save(1L, employee(new DataInputDtos.Loans(List.of(loan("20.01", "24")), false), null, emptyAssets(), null)));

        assertThat(errors).containsExactly(new FieldErrorItem("loans.items[0].annualRatePercent", "20% 이하로 입력해 주세요."));
        verify(mapper, never()).mergeAsset(any());

        service.save(1L, employee(new DataInputDtos.Loans(List.of(loan("20", "24")), false), null, emptyAssets(), null));
        verify(mapper).insertLoan(any());
    }

    @Test
    void remainingMonthsIsRequiredButZeroIsAllowed() {
        List<FieldErrorItem> errors = fieldErrorsOf(
                () -> service.save(1L, employee(new DataInputDtos.Loans(List.of(loan("5", null)), false), null, emptyAssets(), null)));
        assertThat(errors).containsExactly(new FieldErrorItem("loans.items[0].remainingMonths", "필수 입력 항목입니다."));

        service.save(1L, employee(new DataInputDtos.Loans(List.of(loan("5", "0")), false), null, emptyAssets(), null));
        ArgumentCaptor<LoanRow> row = ArgumentCaptor.forClass(LoanRow.class);
        verify(mapper).insertLoan(row.capture());
        assertThat(row.getValue().getRemainingMonths()).isZero();
    }

    @Test
    void noCreditHistorySavesNullsAndZeroHistoryDays() {
        DataInputDtos.CreditProfile credit = new DataInputDtos.CreditProfile(n("5000000"), n("1000000"), n("2"), n("3"), n("1"), n("700000"), true);

        service.save(1L, employee(noLoans(), credit, emptyAssets(), null));

        ArgumentCaptor<CreditRow> row = ArgumentCaptor.forClass(CreditRow.class);
        verify(mapper).mergeManualCredit(row.capture());
        CreditRow saved = row.getValue();
        assertThat(saved.getBaseDate()).isEqualTo(LocalDate.of(2026, 10, 31));
        assertThat(saved.getCreditHistoryDays()).isZero();
        assertThat(saved.getCardLimitAmt()).isNull();
        assertThat(saved.getCardMonthlySpendAmt()).isNull();
        assertThat(saved.getCardUtilPct()).isNull();
        assertThat(saved.getDelinqCount12m()).isNull();
        assertThat(saved.getCashAdvanceMonths()).isNull();
        assertThat(saved.getNewLoanCount3m()).isNull();
        assertThat(saved.getPrivateLenderLoanBalanceAmt()).isEqualTo(700000L);
        assertThat(saved.getSourceCode()).isEqualTo("MANUAL");
    }

    @Test
    void creditUtilizationAndSpendLimitRule() {
        DataInputDtos.CreditProfile credit = new DataInputDtos.CreditProfile(n("1000000"), n("250000"), n("0"), n("0"), n("1"), null, false);
        service.save(1L, employee(noLoans(), credit, emptyAssets(), null));
        ArgumentCaptor<CreditRow> row = ArgumentCaptor.forClass(CreditRow.class);
        verify(mapper).mergeManualCredit(row.capture());
        assertThat(row.getValue().getCardUtilPct()).isEqualByComparingTo("25.00");
        assertThat(row.getValue().getCreditHistoryDays()).isNull();

        DataInputDtos.CreditProfile over = new DataInputDtos.CreditProfile(n("100000"), n("200000"), null, n("13"), null, null, false);
        List<FieldErrorItem> errors = fieldErrorsOf(() -> service.save(1L, employee(noLoans(), over, emptyAssets(), null)));
        assertThat(errors).containsExactly(
                new FieldErrorItem("creditProfile.cardMonthlySpendAmount", "월 카드 사용액은 카드 한도보다 클 수 없습니다."),
                new FieldErrorItem("creditProfile.cashAdvanceMonths", "12개월 이하로 입력해 주세요."));
    }

    @Test
    void emptyCreditSectionDeletesManualRow() {
        DataInputDtos.CreditProfile empty = new DataInputDtos.CreditProfile(null, null, null, null, null, null, false);
        service.save(1L, employee(noLoans(), empty, emptyAssets(), null));

        verify(mapper).deleteManualCredit(1L, LocalDate.of(2026, 10, 31));
        verify(mapper, never()).mergeManualCredit(any());
    }

    @Test
    void expensesAreGroupedByCategory() {
        DataInputDtos.OtherExpenses others = new DataInputDtos.OtherExpenses(List.of(
                new DataInputDtos.OtherExpenseItem("INSTALLMENT", "휴대폰 할부금", n("50000")),
                new DataInputDtos.OtherExpenseItem("SUBSCRIPTION", " ", n("10000")),
                new DataInputDtos.OtherExpenseItem("INSURANCE", "실손 보험", n("30000"))));

        service.save(1L, employee(noLoans(), null, emptyAssets(), others));

        verify(mapper).deleteExpenses(1L, "2026-10");
        ArgumentCaptor<ExpenseRow> rows = ArgumentCaptor.forClass(ExpenseRow.class);
        verify(mapper, times(4)).insertExpense(rows.capture());
        List<ExpenseRow> saved = rows.getAllValues();
        assertThat(saved).extracting(ExpenseRow::getExpenseGroupCode).containsExactly("FIXED", "INSTALLMENT", "SUBSCRIPTION", "OTHER");
        assertThat(saved).extracting(ExpenseRow::getExpenseCategory).containsExactly(null, null, null, "보험료");
        assertThat(saved).extracting(ExpenseRow::getDescription).containsExactly(null, "휴대폰 할부금", null, "실손 보험");
    }

    @Test
    void jobTypeMismatchIsRejected() {
        DataInputDtos.FinancialInput request = employee(noLoans(), null, emptyAssets(), null);
        given(userMapper.selectById(3L)).willReturn(member(3L, "SELF_EMPLOYED"));

        ApiException error = catchThrowableOfType(() -> service.save(3L, request), ApiException.class);
        assertThat(error.getMessage()).isEqualTo("직군 정보가 맞지 않습니다.");
        given(userMapper.selectById(4L)).willReturn(member(4L, null));
        assertThat(codeOf(() -> service.save(4L, request))).isEqualTo("JOB_TYPE_REQUIRED");
    }

    @Test
    void freelancerIncomeKeepsTwelveMonthWindow() {
        List<DataInputDtos.IncomeItem> items = new ArrayList<>();
        for (String month : FinancialInputService.incomeWindow("2026-10")) {
            items.add(new DataInputDtos.IncomeItem(month, "2026-05".equals(month) ? null : n("2000000")));
        }
        DataInputDtos.FinancialInput request = new DataInputDtos.FinancialInput("FREELANCER", "2026-10",
                new DataInputDtos.Income("MONTHLY_INCOME", null, items), new DataInputDtos.WorkPeriod(n("36")), noLoans(), null, emptyAssets(),
                new DataInputDtos.FixedExpense(null), null);

        service.save(2L, request);

        ArgumentCaptor<IncomeRow> rows = ArgumentCaptor.forClass(IncomeRow.class);
        verify(mapper, times(11)).mergeIncome(rows.capture());
        assertThat(rows.getAllValues()).allMatch(row -> "MONTHLY_INCOME".equals(row.getIncomeKindCode()));
        assertThat(rows.getAllValues().get(0).getBaseMonth()).isEqualTo("2025-11");
        verify(mapper).deleteIncome(2L, "2026-05");
        verify(mapper).updateWorkPeriod(eq(2L), eq(36), any());

        List<DataInputDtos.IncomeItem> outside = List.of(new DataInputDtos.IncomeItem("2025-10", n("1")));
        DataInputDtos.FinancialInput bad = new DataInputDtos.FinancialInput("FREELANCER", "2026-10",
                new DataInputDtos.Income("MONTHLY_INCOME", null, outside), new DataInputDtos.WorkPeriod(n("1.5")), noLoans(), null, emptyAssets(),
                null, null);
        assertThat(fieldErrorsOf(() -> service.save(2L, bad))).containsExactly(
                new FieldErrorItem("income.items[0].month", "기준월 기준 최근 12개월(2025-11~2026-10)만 입력할 수 있습니다."),
                new FieldErrorItem("workPeriod.periodMonths", "소수점 없이 입력해 주세요."));
    }

    @Test
    void futureBaseMonthAndMissingSalaryAreRejected() {
        DataInputDtos.FinancialInput request = new DataInputDtos.FinancialInput("EMPLOYEE", "2026-12",
                new DataInputDtos.Income("MONTHLY_SALARY", null, null), new DataInputDtos.WorkPeriod(n("1")), noLoans(), null, emptyAssets(), null,
                null);
        assertThat(fieldErrorsOf(() -> service.save(1L, request))).containsExactly(
                new FieldErrorItem("baseMonth", "미래의 달은 입력할 수 없습니다."),
                new FieldErrorItem("income.monthlySalary", "필수 입력 항목입니다."));
    }

    @Test
    void loadWithoutSavedInputReturnsNullInputAndEmptyStatus() {
        given(mapper.selectSavedBaseMonths(1L)).willReturn(List.of());

        DataInputDtos.FinancialInputResponse response = service.load(1L);

        assertThat(response.input()).isNull();
        assertThat(response.savedBaseMonths()).isEmpty();
        assertThat(response.status().sections()).containsOnlyKeys("income", "workPeriod", "loans", "creditProfile", "assets", "fixedExpense",
                "otherExpenses");
        assertThat(response.status().sections().values()).containsOnly(false);
    }

    @Test
    @SuppressWarnings("unchecked")
    void loadRestoresSavedInputInScreenShape() {
        AssetRow asset = new AssetRow();
        asset.setBaseMonth("2026-10");
        asset.setTotalAssetAmt(3000000L);
        asset.setNoLoanYn("Y");
        asset.setCreatedAt(DataInputFixtures.NOW);
        given(mapper.selectAsset(1L, "2026-10")).willReturn(asset);
        IncomeRow salary = new IncomeRow();
        salary.setBaseMonth("2026-10");
        salary.setIncomeAmt(3000000L);
        given(mapper.selectIncomes(1L, "2026-10", "2026-10")).willReturn(List.of(salary));
        given(mapper.selectWorkPeriod(1L)).willReturn(24);
        LoanRow imported = new LoanRow();
        imported.setSourceCode("IMPORTED");
        given(mapper.selectLoans(1L, "2026-10")).willReturn(List.of(imported));
        CreditRow credit = new CreditRow();
        credit.setCreditHistoryDays(0);
        credit.setPrivateLenderLoanBalanceAmt(700000L);
        given(mapper.selectManualCredit(1L, LocalDate.of(2026, 10, 31))).willReturn(credit);
        ExpenseRow fixed = new ExpenseRow();
        fixed.setExpenseGroupCode("FIXED");
        fixed.setMonthlyAmt(800000L);
        ExpenseRow insurance = new ExpenseRow();
        insurance.setExpenseGroupCode("OTHER");
        insurance.setExpenseCategory("보험료");
        insurance.setMonthlyAmt(30000L);
        given(mapper.selectExpenses(1L, "2026-10")).willReturn(List.of(fixed, insurance));

        DataInputDtos.FinancialInputResponse response = service.load(1L);

        Map<String, Object> input = response.input();
        assertThat(input).containsEntry("baseMonth", "2026-10").containsEntry("jobType", "EMPLOYEE");
        assertThat((Map<String, Object>) input.get("income")).containsEntry("monthlySalary", 3000000L);
        // 자산은 합계만 저장하므로 '기타 자산'에 합계를 넣어 돌려준다.
        assertThat((Map<String, Object>) input.get("assets")).containsEntry("otherAmount", 3000000L).containsEntry("depositAmount", null);
        // 불러온 대출은 화면 목록에 넣지 않는다(다시 저장해도 IMPORTED 행은 그대로).
        assertThat((Map<String, Object>) input.get("loans")).containsEntry("items", List.of()).containsEntry("noItems", true);
        assertThat((Map<String, Object>) input.get("creditProfile")).containsEntry("noCreditHistory", true)
                .containsEntry("privateLenderLoanBalanceAmount", 700000L);
        assertThat((Map<String, Object>) input.get("fixedExpense")).containsEntry("monthlyAmount", 800000L);
        List<Map<String, Object>> others = (List<Map<String, Object>>) ((Map<String, Object>) input.get("otherExpenses")).get("items");
        assertThat(others).singleElement().satisfies(item -> assertThat(item).containsEntry("category", "INSURANCE"));
        assertThat(response.status().sections()).containsEntry("income", true).containsEntry("workPeriod", true).containsEntry("loans", true)
                .containsEntry("assets", true).containsEntry("fixedExpense", true).containsEntry("otherExpenses", true)
                .containsEntry("creditProfile", true);
        verify(mapper, never()).mergeAsset(any());
        verify(mapper, never()).deleteIncome(anyLong(), anyString());
    }
}
