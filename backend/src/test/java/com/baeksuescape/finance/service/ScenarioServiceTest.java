package com.baeksuescape.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.baeksuescape.finance.dto.cashflow.MonthlyIncomeItem;
import com.baeksuescape.finance.dto.scenario.PolicyRateRow;
import com.baeksuescape.finance.dto.scenario.ScenarioBaseResponse;
import com.baeksuescape.finance.dto.scenario.ScenarioRecalculateRequest;
import com.baeksuescape.finance.dto.scenario.ScenarioRecalculateResponse;
import com.baeksuescape.finance.mapper.IncomeVolatilityMapper;
import com.baeksuescape.finance.mapper.ScenarioMapper;
import com.baeksuescape.global.exception.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * FP-167 N-17 시나리오 테스트 서비스 테스트 — 기준값 읽기, 변동금리에만 반영되는 이자 변화, 공통 틀로 반영되는 소득·지출,
 * 상환 부담률·버틸 개월·판정, 입력 범위 검사를 DB 없이 확인한다.
 */
class ScenarioServiceTest {

    private static final long USER_ID = 2L;

    private IncomeVolatilityService incomeVolatilityService;
    private IncomeVolatilityMapper incomeMapper;
    private ScenarioMapper scenarioMapper;
    private ScenarioService service;

    @BeforeEach
    void setUp() {
        incomeVolatilityService = mock(IncomeVolatilityService.class);
        incomeMapper = mock(IncomeVolatilityMapper.class);
        scenarioMapper = mock(ScenarioMapper.class);
        service = new ScenarioService(incomeVolatilityService, incomeMapper, scenarioMapper);
    }

    private static MonthlyIncomeItem month(String yearMonth, long income) {
        return MonthlyIncomeItem.builder().yearMonth(yearMonth).income(income).expense(0L).build();
    }

    /** 월 소득 300만(두 달 평균), 지출 180만, 원리금 50만, 변동금리 잔액 3,000만, 총자산 4,000만 */
    private void givenStored(Long totalAsset) {
        when(incomeVolatilityService.loadIncomeHistory(USER_ID, 0L))
                .thenReturn(List.of(month("2026-07", 2_800_000L), month("2026-08", 3_200_000L)));
        when(incomeMapper.selectLatestTotalExpense(USER_ID)).thenReturn(1_800_000L);
        when(incomeMapper.selectLatestLoanMonthlyPayment(USER_ID)).thenReturn(500_000L);
        when(scenarioMapper.selectLatestVariableLoanBalance(USER_ID)).thenReturn(30_000_000L);
        when(scenarioMapper.selectLatestTotalAsset(USER_ID)).thenReturn(totalAsset);
    }

    private static ScenarioRecalculateRequest req(Double rate, Double income, Double expense) {
        return ScenarioRecalculateRequest.builder().ratePctPoint(rate).incomePct(income).expensePct(expense).build();
    }

    @Test
    @DisplayName("N-17-1 기준값: 12개월 평균 소득·지출·원리금·변동금리 잔액·총자산과 최신 정책금리, 가정 문구")
    void base() {
        givenStored(40_000_000L);
        PolicyRateRow rate = new PolicyRateRow();
        rate.setBaseDate(LocalDate.of(2026, 10, 31));
        rate.setRatePct(new BigDecimal("3.000"));
        when(scenarioMapper.selectLatestPolicyRate()).thenReturn(rate);

        ScenarioBaseResponse base = service.base(USER_ID);

        assertEquals(3_000_000L, base.monthlyIncomeAmount());
        assertEquals(1_800_000L, base.monthlyExpenseAmount());
        assertEquals(500_000L, base.monthlyPaymentAmount());
        assertEquals(30_000_000L, base.variableLoanBalanceAmount());
        assertEquals(40_000_000L, base.totalAssetAmount());
        assertEquals(LocalDate.of(2026, 10, 31), base.policyRate().baseDate());
        assertEquals(0, new BigDecimal("3.000").compareTo(base.policyRate().ratePct()));
        assertEquals(ScenarioService.ASSUMPTIONS, base.assumptions());
    }

    @Test
    @DisplayName("N-17-1: 정책금리 자료가 없으면 policyRate는 null, 총자산 미입력이면 totalAssetAmount는 null")
    void baseMissingOptional() {
        givenStored(null);
        when(scenarioMapper.selectLatestPolicyRate()).thenReturn(null);

        ScenarioBaseResponse base = service.base(USER_ID);

        assertNull(base.policyRate());
        assertNull(base.totalAssetAmount());
    }

    @Test
    @DisplayName("금리 +1%p: 변동금리 잔액 3,000만에만 반영돼 월 이자 +25,000, 상환액·잉여·상환 부담률이 바뀐다")
    void rateUpOnlyVariable() {
        givenStored(40_000_000L);

        ScenarioRecalculateResponse r = service.recalculate(USER_ID, req(1.0, null, null));

        assertEquals(25_000L, r.monthlyInterestChangeAmount());
        assertEquals(500_000L, r.current().monthlyPaymentAmount());
        assertEquals(525_000L, r.changed().monthlyPaymentAmount());
        assertEquals(700_000L, r.current().monthlySurplusAmount());
        assertEquals(675_000L, r.changed().monthlySurplusAmount());
        assertEquals(-25_000L, r.surplusDiffAmount());
        // 상환 부담률 = 연 원리금 ÷ 연소득 × 100 (N-16-1·N-20-4 공유 함수)
        assertEquals(0, new BigDecimal("16.67").compareTo(r.current().dsrPct()));
        assertEquals(0, new BigDecimal("17.50").compareTo(r.changed().dsrPct()));
        assertNull(r.survivableMonths(), "흑자면 버틸 개월을 계산하지 않는다");
        assertEquals(ScenarioService.STILL_POSITIVE, r.verdict());
    }

    @Test
    @DisplayName("소득 -20%·지출 +10%는 공통 재계산 틀로 반영되고, 적자면 ⌊총자산 × 25% ÷ 월 부족액⌋개월을 버틴다")
    void shortfall() {
        givenStored(40_000_000L);

        ScenarioRecalculateResponse r = service.recalculate(USER_ID, req(0.0, -20.0, 10.0));

        assertEquals(2_400_000L, r.changed().monthlyIncomeAmount());
        assertEquals(1_980_000L, r.changed().monthlyExpenseAmount());
        assertEquals(-80_000L, r.changed().monthlySurplusAmount());
        // 4,000만 × 25% = 1,000만 ÷ 8만 = 125개월
        assertEquals(125L, r.survivableMonths());
        assertEquals(ScenarioService.SHORTFALL, r.verdict());
        assertEquals(0L, r.monthlyInterestChangeAmount());
    }

    @Test
    @DisplayName("좋아지는 경우: 금리 -1%p·지출 -10%면 잉여가 늘어 IMPROVED, 상환액은 0 아래로 내려가지 않는다")
    void improvedAndPaymentFloor() {
        givenStored(40_000_000L);

        ScenarioRecalculateResponse r = service.recalculate(USER_ID, req(-1.0, null, -10.0));
        assertEquals(-25_000L, r.monthlyInterestChangeAmount());
        assertEquals(475_000L, r.changed().monthlyPaymentAmount());
        assertEquals(ScenarioService.IMPROVED, r.verdict());

        // 원리금보다 이자 감소가 크면 0에서 멈춘다: 원리금 1만, 잔액 3,000만, -5%p → 이자 -125,000
        ScenarioRecalculateResponse floor = ScenarioService.calculate(
                new ScenarioService.Baseline(3_000_000L, 1_800_000L, 10_000L, 30_000_000L, null),
                new BigDecimal("-5"), BigDecimal.ZERO, BigDecimal.ZERO);
        assertEquals(-125_000L, floor.monthlyInterestChangeAmount());
        assertEquals(0L, floor.changed().monthlyPaymentAmount());
    }

    @Test
    @DisplayName("소득이 0이 되면 상환 부담률은 null(계산 불가), 총자산 미입력이면 적자여도 버틸 개월은 null, 총자산 0이면 0개월")
    void nullCases() {
        ScenarioService.Baseline b = new ScenarioService.Baseline(3_000_000L, 1_800_000L, 500_000L, 0L, null);
        ScenarioRecalculateResponse r = ScenarioService.calculate(b, BigDecimal.ZERO, new BigDecimal("-100"), BigDecimal.ZERO);
        assertEquals(0L, r.changed().monthlyIncomeAmount());
        assertNull(r.changed().dsrPct());
        assertNull(r.survivableMonths());

        assertEquals(0L, ScenarioService.survivableMonths(-80_000L, 0L));
    }

    @Test
    @DisplayName("조건을 하나도 보내지 않으면 모두 0(변화 없음)이다")
    void emptyRequest() {
        givenStored(40_000_000L);

        ScenarioRecalculateResponse r = service.recalculate(USER_ID, null);

        assertEquals(r.current(), r.changed());
        assertEquals(0L, r.surplusDiffAmount());
        assertEquals(ScenarioService.STILL_POSITIVE, r.verdict());
    }

    @Test
    @DisplayName("범위 밖 조건은 DB를 읽기 전에 400 INVALID_INPUT, fieldErrors에 그 이름")
    void outOfRange() {
        ApiException rate = assertThrows(ApiException.class, () -> service.recalculate(USER_ID, req(10.5, null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, rate.getStatus());
        assertEquals("INVALID_INPUT", rate.getCode());
        assertEquals("ratePctPoint", rate.getFieldErrors().get(0).field());

        assertEquals("incomePct", assertThrows(ApiException.class,
                () -> service.recalculate(USER_ID, req(null, -101.0, null))).getFieldErrors().get(0).field());
        assertEquals("expensePct", assertThrows(ApiException.class,
                () -> service.recalculate(USER_ID, req(null, null, -51.0))).getFieldErrors().get(0).field());
        verifyNoInteractions(incomeVolatilityService, incomeMapper, scenarioMapper);
    }

    @Test
    @DisplayName("저장된 소득이 없으면 현금흐름 전망과 같은 404를 그대로 낸다")
    void noIncome() {
        when(incomeVolatilityService.loadIncomeHistory(anyLong(), anyLong()))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "저장된 소득 데이터가 없습니다."));

        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.base(USER_ID)).getStatus());
    }
}
