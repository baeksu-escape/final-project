package com.baeksuescape.finance.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.baeksuescape.finance.dto.scenario.PolicyRateRow;
import com.baeksuescape.finance.dto.scenario.ScenarioBaseResponse.ScenarioLoanItem;
import com.baeksuescape.finance.dto.scenario.VariableLoanRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.session.SqlSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * FP-167 ScenarioMapper를 실제 Oracle DB에 붙여 확인하는 통합 테스트. -Ddb.it=true일 때만 실행한다.
 * 있는 회원 1명에게 가장 늦은 기준월(2099-12)의 소득·대출·자산 행과 가장 늦은 정책금리 행을 넣고 확인한 뒤 되돌린다(롤백).
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class ScenarioMapperIT {

    private static final String MONTH = "2099-12";

    @Autowired
    private ScenarioMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SqlSession sqlSession;

    private long userId;
    private String loanType;

    @BeforeEach
    void setUp() {
        userId = jdbc.queryForObject("SELECT MIN(USER_ID) FROM APP_USER", Long.class);
        loanType = jdbc.queryForObject("SELECT MIN(LOAN_TYPE_CODE) FROM DIM_LOAN_TYPE", String.class);
        // 이 회원의 소득 기준월을 2099-12로 만든다
        jdbc.update("INSERT INTO USER_INCOME_MONTH (USER_ID, BASE_MONTH, INCOME_KIND_CODE, INCOME_AMT, INPUT_DATE) VALUES (?, ?, 'MONTHLY_INCOME', 3000000, SYSDATE)",
                userId, MONTH);
    }

    private void loan(long balance, String annualRatePct, String rateType, long monthlyPayment) {
        jdbc.update("INSERT INTO USER_LOAN (USER_ID, BASE_MONTH, LOAN_TYPE_CODE, BALANCE_AMT, ANNUAL_RATE_PCT, RATE_TYPE_CODE, REMAINING_MONTHS, MONTHLY_PAYMENT_AMT) "
                + "VALUES (?, ?, ?, ?, ?, ?, 24, ?)", userId, MONTH, loanType, balance, new BigDecimal(annualRatePct), rateType, monthlyPayment);
    }

    // 같은 트랜잭션에서는 MyBatis가 같은 쿼리 결과를 기억해 두므로(1차 캐시), JdbcTemplate으로 행을 바꾼 뒤 다시 읽기 전에 비운다.
    private void clearMyBatisCache() {
        sqlSession.clearCache();
    }

    @Test
    @DisplayName("변동금리(VARIABLE) 대출만 잔액·연 금리·월 원리금과 함께 읽고 고정·금리 방식 모름은 뺀다. 기준월 대출이 없으면 빈 목록")
    void selectLatestVariableLoans() {
        assertTrue(mapper.selectLatestVariableLoans(userId).isEmpty());

        loan(30_000_000L, "4.5", "VARIABLE", 300_000L);
        loan(5_000_000L, "6.25", "VARIABLE", 80_000L);
        loan(20_000_000L, "5", "FIXED", 100_000L);
        loan(10_000_000L, "5", "UNKNOWN", 100_000L);
        clearMyBatisCache();

        List<VariableLoanRow> rows = mapper.selectLatestVariableLoans(userId);
        assertEquals(2, rows.size());
        assertEquals(35_000_000L, rows.stream().mapToLong(VariableLoanRow::getBalanceAmount).sum());
        assertEquals(380_000L, rows.stream().mapToLong(VariableLoanRow::getMonthlyPaymentAmount).sum());
        VariableLoanRow first = rows.get(0);
        assertEquals(30_000_000L, first.getBalanceAmount());
        assertEquals(0, new BigDecimal("4.5").compareTo(first.getAnnualRatePct()));
        assertEquals(300_000L, first.getMonthlyPaymentAmount());
    }

    @Test
    @DisplayName("기준월 전체 대출 목록은 LOAN_ID 순으로 잔액·상환액·금리 정보를 매핑하고 UNKNOWN 방식을 유지한다")
    // N-17-1 기준 대출 상세 조회의 정렬·합계·필드 매핑을 롤백 트랜잭션 안에서 확인한다.
    void selectLatestLoanItems() {
        assertTrue(mapper.selectLatestLoanItems(userId).isEmpty());

        loan(30_000_000L, "4.5", "VARIABLE", 300_000L);
        loan(5_000_000L, "6.25", "VARIABLE", 80_000L);
        loan(20_000_000L, "5", "FIXED", 100_000L);
        loan(10_000_000L, "5", "UNKNOWN", 100_000L);
        clearMyBatisCache();

        List<ScenarioLoanItem> rows = mapper.selectLatestLoanItems(userId);
        List<Long> expectedIds = jdbc.queryForList(
                "SELECT LOAN_ID FROM USER_LOAN WHERE USER_ID = ? AND BASE_MONTH = ? ORDER BY LOAN_ID",
                Long.class, userId, MONTH);
        assertEquals(4, rows.size());
        assertEquals(expectedIds, rows.stream().map(ScenarioLoanItem::loanId).toList());
        assertEquals(65_000_000L, rows.stream().mapToLong(ScenarioLoanItem::balanceAmount).sum());
        assertEquals(580_000L, rows.stream().mapToLong(ScenarioLoanItem::monthlyPaymentAmount).sum());
        String expectedLoanTypeName = jdbc.queryForObject(
                "SELECT LOAN_TYPE_NAME FROM DIM_LOAN_TYPE WHERE LOAN_TYPE_CODE = ?", String.class, loanType);
        assertEquals(expectedLoanTypeName, rows.get(0).loanTypeName());
        assertEquals(0, new BigDecimal("4.5").compareTo(rows.get(0).annualRatePct()));
        assertEquals("VARIABLE", rows.get(0).rateTypeCode());
        assertEquals(30_000_000L, rows.get(0).balanceAmount());
        assertEquals("UNKNOWN", rows.get(3).rateTypeCode());
    }

    @Test
    @DisplayName("소득 기준월의 총자산을 읽고, 행이 없거나 미입력(NULL)이면 null이다")
    void selectLatestTotalAsset() {
        assertNull(mapper.selectLatestTotalAsset(userId), "기준월 자산 행이 없으면 null");

        jdbc.update("INSERT INTO USER_ASSET_SNAPSHOT (USER_ID, BASE_MONTH, TOTAL_ASSET_AMT) VALUES (?, ?, NULL)", userId, MONTH);
        clearMyBatisCache();
        assertNull(mapper.selectLatestTotalAsset(userId), "미입력(NULL)은 0으로 바꾸지 않는다");

        jdbc.update("UPDATE USER_ASSET_SNAPSHOT SET TOTAL_ASSET_AMT = 40000000 WHERE USER_ID = ? AND BASE_MONTH = ?", userId, MONTH);
        clearMyBatisCache();
        assertEquals(40_000_000L, mapper.selectLatestTotalAsset(userId));
    }

    @Test
    @DisplayName("한국은행 기준금리 중 기준일이 가장 늦은 행을 돌려준다")
    void selectLatestPolicyRate() {
        jdbc.update("INSERT INTO FACT_POLICY_RATE (BASE_DATE, RATE_NAME, RATE_PCT) VALUES (DATE '2099-12-31', '한국은행 기준금리', 9.875)");

        PolicyRateRow latest = mapper.selectLatestPolicyRate();

        assertNotNull(latest);
        assertEquals(LocalDate.of(2099, 12, 31), latest.getBaseDate());
        assertEquals(0, new BigDecimal("9.875").compareTo(latest.getRatePct()));
    }
}
