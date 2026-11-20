package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.cashflow.IncomeMonthRow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * FP-203 IncomeVolatilityMapper를 실제 Oracle 더미 DB에 붙여 확인하는 통합 테스트.
 * DB가 없는 팀원 빌드를 깨지 않도록 -Ddb.it=true를 줄 때만 실행한다. 시드 회원 2번(프리랜서)·1번(급여소득자) 기준이다.
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class IncomeVolatilityMapperIT {

    @Autowired
    private IncomeVolatilityMapper mapper;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("전제 조건: 더미 시드가 적재되어 있어야 한다 (비어 있으면 dummy_db/run_all.sql 적재 필요)")
    void seedDataLoaded() {
        String summary = jdbcTemplate.queryForObject(
                "SELECT 'APP_USER=' || (SELECT COUNT(*) FROM APP_USER)"
                        + " || ', USER_INCOME_MONTH=' || (SELECT COUNT(*) FROM USER_INCOME_MONTH)"
                        + " || ', USER_EXPENSE_ITEM=' || (SELECT COUNT(*) FROM USER_EXPENSE_ITEM)"
                        + " || ', USER_LOAN=' || (SELECT COUNT(*) FROM USER_LOAN)"
                        + " || ', 소득 회원번호 범위=' || (SELECT NVL(TO_CHAR(MIN(USER_ID)), '-') || '~' || NVL(TO_CHAR(MAX(USER_ID)), '-') FROM USER_INCOME_MONTH)"
                        + " FROM DUAL",
                String.class);
        System.out.println("[FP-203 시드 확인] " + summary);
        assertFalse(summary.contains("USER_INCOME_MONTH=0,"), "시드가 비어 있다: " + summary);
    }

    @Test
    @DisplayName("프리랜서 회원 2번: 최근 12개월 소득을 기준월 오름차순으로 읽는다")
    void selectRecentIncomeMonths_freelancer() {
        List<IncomeMonthRow> rows = mapper.selectRecentIncomeMonths(2L);

        assertEquals(12, rows.size());
        assertEquals("2025-09", rows.get(0).getYearMonth());
        assertEquals("2026-08", rows.get(11).getYearMonth());
        assertEquals(1933611L, rows.get(0).getIncome());
        assertEquals("MONTHLY_INCOME", rows.get(0).getIncomeKindCode());
    }

    @Test
    @DisplayName("급여소득자 회원 1번: 월급 1행을 읽는다")
    void selectRecentIncomeMonths_salary() {
        List<IncomeMonthRow> rows = mapper.selectRecentIncomeMonths(1L);

        assertEquals(1, rows.size());
        assertEquals("SALARY", rows.get(0).getIncomeKindCode());
        assertEquals(2404634L, rows.get(0).getIncome());
    }

    @Test
    @DisplayName("지출·원리금 합계: 시드 값과 같고, 데이터가 없으면 0이다")
    void selectExpenseAndLoan() {
        assertEquals(1315514L, mapper.selectLatestFixedExpense(2L));
        assertEquals(1315514L, mapper.selectLatestTotalExpense(2L));
        assertTrue(mapper.selectLatestLoanMonthlyPayment(2L) >= 0L);

        assertEquals(0L, mapper.selectLatestFixedExpense(-1L));
        assertEquals(0L, mapper.selectLatestLoanMonthlyPayment(-1L));
        assertTrue(mapper.selectRecentIncomeMonths(-1L).isEmpty());
    }
}
