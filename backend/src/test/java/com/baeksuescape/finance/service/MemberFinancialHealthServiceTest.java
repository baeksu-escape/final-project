package com.baeksuescape.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.baeksuescape.finance.dto.cashflow.MonthlyIncomeItem;
import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse;
import com.baeksuescape.finance.dto.health.HealthAssetRow;
import com.baeksuescape.finance.dto.health.HealthLoanRow;
import com.baeksuescape.finance.mapper.FinancialHealthMapper;
import com.baeksuescape.global.exception.ApiException;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * FP-239 N-16 DIAG-03-1 자산·부채 저장값 서비스 테스트 — 연소득(12개월 합, 빠진 달이면 null), 총자산 미입력 null,
 * 총부채·연 원리금(대출 있음 합계 / 대출 없음 0 / 미입력 null), 대출 목록, 소득 없음 404를 DB 없이 확인한다.
 */
class MemberFinancialHealthServiceTest {

    private static final long USER_ID = 2L;

    private IncomeVolatilityService incomeVolatilityService;
    private FinancialHealthMapper mapper;
    private MemberFinancialHealthService service;

    @BeforeEach
    void setUp() {
        incomeVolatilityService = mock(IncomeVolatilityService.class);
        mapper = mock(FinancialHealthMapper.class);
        service = new MemberFinancialHealthService(incomeVolatilityService, mapper);
    }

    /** 기준월 2026-08에서 거꾸로 months개월, 각 달 소득은 amount (오름차순) */
    private static List<MonthlyIncomeItem> months(int months, long amount) {
        List<MonthlyIncomeItem> list = new ArrayList<>();
        YearMonth base = YearMonth.of(2026, 8);
        for (int i = months - 1; i >= 0; i--) {
            list.add(MonthlyIncomeItem.builder().yearMonth(base.minusMonths(i).toString()).income(amount).expense(0L).build());
        }
        return list;
    }

    private static HealthAssetRow asset(Long totalAsset, String noLoanYn) {
        HealthAssetRow row = new HealthAssetRow();
        row.setTotalAssetAmount(totalAsset);
        row.setNoLoanYn(noLoanYn);
        return row;
    }

    private static HealthLoanRow loan(long id, String code, String name, long balance, String rate, String rateType, int remaining, long payment) {
        HealthLoanRow row = new HealthLoanRow();
        row.setLoanId(id);
        row.setLoanTypeCode(code);
        row.setLoanTypeName(name);
        row.setBalanceAmount(balance);
        row.setAnnualRatePct(new BigDecimal(rate));
        row.setRateTypeCode(rateType);
        row.setRemainingMonths(remaining);
        row.setMonthlyPaymentAmount(payment);
        return row;
    }

    @Test
    @DisplayName("저장값: 기준월·총자산·연소득(12개월 합)·총부채(잔액 합)·연 원리금(월 원리금 합 × 12)·대출 목록(번호 순)")
    void load() {
        when(incomeVolatilityService.loadIncomeHistory(USER_ID, 0L)).thenReturn(months(12, 2_500_000L));
        when(mapper.selectLatestAsset(USER_ID)).thenReturn(asset(50_000_000L, "N"));
        when(mapper.selectLatestLoans(USER_ID)).thenReturn(List.of(
                loan(11L, "CREDIT", "신용대출", 15_000_000L, "5.4", "VARIABLE", 36, 460_000L),
                loan(12L, "CARD_LOAN", "카드론", 2_000_000L, "12.5", "FIXED", 10, 210_000L)));

        FinancialHealthBaseResponse r = service.load(USER_ID);

        assertEquals("2026-08", r.baseMonth());
        assertEquals(50_000_000L, r.totalAssetAmount());
        assertEquals(30_000_000L, r.annualIncomeAmount());
        assertEquals(17_000_000L, r.totalDebtAmount());
        assertEquals(8_040_000L, r.annualPaymentAmount(), "(46만 + 21만) × 12");
        assertEquals(2, r.loans().size());
        FinancialHealthBaseResponse.LoanItem first = r.loans().get(0);
        assertEquals(11L, first.loanId());
        assertEquals("신용대출", first.loanTypeName());
        assertEquals("VARIABLE", first.rateTypeCode());
        assertEquals(0, new BigDecimal("5.4").compareTo(first.annualRatePct()));
        assertEquals(36, first.remainingMonths());
        assertEquals(460_000L, first.monthlyPaymentAmount());
    }

    @Test
    @DisplayName("급여소득자: loadIncomeHistory가 월급을 12개월로 펼쳐 주므로 연소득 = 월급 × 12")
    void salaryAnnualIncome() {
        // 급여소득자는 월급 1행이 기준월까지 12개월로 펼쳐져 온다(IncomeVolatilityService.loadIncomeHistory)
        assertEquals(36_000_000L, MemberFinancialHealthService.annualIncome(months(12, 3_000_000L)));
    }

    @Test
    @DisplayName("자영업자·프리랜서: 12개월이 안 되거나 최근 12개월(달력) 안에 빠진 달이 있으면 연소득은 null")
    void annualIncomeNullWhenMonthsMissing() {
        assertNull(MemberFinancialHealthService.annualIncome(months(11, 2_000_000L)), "11개월");

        // 12행이지만 한 달이 빠져 1년보다 오래된 달이 섞임: 2025-08 ~ 2026-08 중 2026-03 없음
        List<MonthlyIncomeItem> gap = new ArrayList<>(months(13, 2_000_000L));
        gap.removeIf(m -> m.getYearMonth().equals("2026-03"));
        assertEquals(12, gap.size());
        assertNull(MemberFinancialHealthService.annualIncome(gap));
    }

    @Test
    @DisplayName("미입력은 null: 자산 행이 없거나 총자산 NULL이면 totalAssetAmount null, 대출 행이 없고 '대출 없음'도 아니면 총부채·연 원리금 null")
    void missingValuesAreNull() {
        when(incomeVolatilityService.loadIncomeHistory(USER_ID, 0L)).thenReturn(months(12, 2_000_000L));
        when(mapper.selectLatestLoans(USER_ID)).thenReturn(List.of());

        when(mapper.selectLatestAsset(USER_ID)).thenReturn(null);
        FinancialHealthBaseResponse noRow = service.load(USER_ID);
        assertNull(noRow.totalAssetAmount());
        assertNull(noRow.totalDebtAmount());
        assertNull(noRow.annualPaymentAmount());
        assertTrue(noRow.loans().isEmpty());

        when(mapper.selectLatestAsset(USER_ID)).thenReturn(asset(null, null));
        FinancialHealthBaseResponse unknown = service.load(USER_ID);
        assertNull(unknown.totalAssetAmount(), "총자산 NULL은 0으로 바꾸지 않는다");
        assertNull(unknown.totalDebtAmount(), "대출 확인 상태 NULL은 미입력");
    }

    @Test
    @DisplayName("대출 '해당 없음'(NO_LOAN_YN='Y')이고 대출 행이 없으면 총부채·연 원리금은 0")
    void noLoanIsZero() {
        when(incomeVolatilityService.loadIncomeHistory(USER_ID, 0L)).thenReturn(months(12, 2_000_000L));
        when(mapper.selectLatestAsset(USER_ID)).thenReturn(asset(10_000_000L, "Y"));
        when(mapper.selectLatestLoans(USER_ID)).thenReturn(List.of());

        FinancialHealthBaseResponse r = service.load(USER_ID);

        assertEquals(0L, r.totalDebtAmount());
        assertEquals(0L, r.annualPaymentAmount());
        assertTrue(r.loans().isEmpty());
    }

    @Test
    @DisplayName("저장된 소득이 없으면 다른 저장값 API와 같은 404를 그대로 낸다")
    void noIncome() {
        when(incomeVolatilityService.loadIncomeHistory(anyLong(), anyLong()))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "저장된 소득 데이터가 없습니다."));

        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.load(USER_ID)).getStatus());
    }
}
