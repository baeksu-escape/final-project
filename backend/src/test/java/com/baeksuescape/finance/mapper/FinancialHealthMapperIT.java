package com.baeksuescape.finance.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse.UtilityPaymentMonth;
import com.baeksuescape.finance.dto.health.HealthAssetRow;
import com.baeksuescape.finance.dto.health.HealthLoanRow;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.apache.ibatis.session.SqlSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.transaction.annotation.Transactional;

/**
 * FP-239 FinancialHealthMapper를 실제 Oracle DB에 붙여 확인하는 통합 테스트. -Ddb.it=true일 때만 실행한다.
 * 있는 회원 1명에게 가장 늦은 기준월(2099-12)의 소득·자산·대출 행을 넣고 확인한 뒤 되돌린다(롤백).
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class FinancialHealthMapperIT {

    private static final String MONTH = "2099-12";

    @Autowired
    private FinancialHealthMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SqlSession sqlSession;

    private long userId;

    @BeforeEach
    void setUp() {
        userId = jdbc.queryForObject("SELECT MIN(USER_ID) FROM APP_USER", Long.class);
        // 이 회원의 소득 기준월을 2099-12로 만든다
        jdbc.update("INSERT INTO USER_INCOME_MONTH (USER_ID, BASE_MONTH, INCOME_KIND_CODE, INCOME_AMT, INPUT_DATE) VALUES (?, ?, 'MONTHLY_INCOME', 3000000, SYSDATE)",
                userId, MONTH);
    }

    // 같은 트랜잭션에서는 MyBatis가 같은 쿼리 결과를 기억해 두므로(1차 캐시), JdbcTemplate으로 행을 바꾼 뒤 다시 읽기 전에 비운다.
    private void clearMyBatisCache() {
        sqlSession.clearCache();
    }

    private void loan(String loanType, long balance, String rate, String rateType, int remaining, long payment) {
        jdbc.update("INSERT INTO USER_LOAN (USER_ID, BASE_MONTH, LOAN_TYPE_CODE, BALANCE_AMT, ANNUAL_RATE_PCT, RATE_TYPE_CODE, REMAINING_MONTHS, MONTHLY_PAYMENT_AMT) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", userId, MONTH, loanType, balance, new BigDecimal(rate), rateType, remaining, payment);
    }

    @Test
    @DisplayName("기준월 자산 행: 없으면 null, 총자산 NULL·대출 확인 상태를 그대로 읽는다")
    void selectLatestAsset() {
        assertNull(mapper.selectLatestAsset(userId), "기준월 자산 행이 없으면 null");

        jdbc.update("INSERT INTO USER_ASSET_SNAPSHOT (USER_ID, BASE_MONTH, TOTAL_ASSET_AMT, NO_LOAN_YN) VALUES (?, ?, NULL, 'Y')", userId, MONTH);
        clearMyBatisCache();
        HealthAssetRow unknown = mapper.selectLatestAsset(userId);
        assertNotNull(unknown);
        assertNull(unknown.getTotalAssetAmount(), "미입력(NULL)은 0으로 바꾸지 않는다");
        assertEquals("Y", unknown.getNoLoanYn());

        jdbc.update("UPDATE USER_ASSET_SNAPSHOT SET TOTAL_ASSET_AMT = 40000000 WHERE USER_ID = ? AND BASE_MONTH = ?", userId, MONTH);
        clearMyBatisCache();
        assertEquals(40_000_000L, mapper.selectLatestAsset(userId).getTotalAssetAmount());
    }

    @Test
    @DisplayName("기준월 대출: 종류 이름(DIM_LOAN_TYPE)과 함께 대출 번호 순으로 읽고, 없으면 빈 목록")
    void selectLatestLoans() {
        assertTrue(mapper.selectLatestLoans(userId).isEmpty());

        loan("CREDIT", 15_000_000L, "5.4", "VARIABLE", 36, 460_000L);
        loan("CARD_LOAN", 2_000_000L, "12.5", "FIXED", 10, 210_000L);
        clearMyBatisCache();

        List<HealthLoanRow> rows = mapper.selectLatestLoans(userId);
        assertEquals(2, rows.size());
        HealthLoanRow first = rows.get(0);
        assertEquals("CREDIT", first.getLoanTypeCode());
        assertEquals("신용대출", first.getLoanTypeName());
        assertEquals(15_000_000L, first.getBalanceAmount());
        assertEquals(0, new BigDecimal("5.4").compareTo(first.getAnnualRatePct()));
        assertEquals("VARIABLE", first.getRateTypeCode());
        assertEquals(36, first.getRemainingMonths());
        assertEquals(460_000L, first.getMonthlyPaymentAmount());
        assertEquals("카드론", rows.get(1).getLoanTypeName());
        assertTrue(rows.get(0).getLoanId() < rows.get(1).getLoanId());
    }

    /** N-20-1 최신 기관 연동 청구월부터 달력 12개월을 조회한다. 빈 달과 범위 밖 기록은 제외하고 시작월은 포함한다. */
    @Test
    @DisplayName("최신 연동 청구월 포함 최근 12개월 중 기록이 있는 달만 청구월 오름차순으로 읽는다")
    void selectRecentUtilityPayments() {
        long consentId = insertUtilityConsent();
        insertUtilityPayment("2099-12", "ON_TIME", "MANUAL", null);
        YearMonth latestImported = YearMonth.of(2099, 11);
        for (int offset = 0; offset <= 13; offset++) {
            if (offset == 5) {
                continue;
            }
            String status = switch (offset) {
                case 0 -> "UNPAID";
                case 11 -> "LATE";
                default -> "ON_TIME";
            };
            insertUtilityPayment(latestImported.minusMonths(offset).toString(), status, "IMPORTED", consentId);
        }

        List<UtilityPaymentMonth> payments = mapper.selectRecentUtilityPayments(userId);

        assertEquals(List.of("2098-12", "2099-01", "2099-02", "2099-03", "2099-04",
                        "2099-05", "2099-07", "2099-08", "2099-09", "2099-10", "2099-11"),
                payments.stream().map(UtilityPaymentMonth::billMonth).toList());
        assertEquals("LATE", payments.get(0).paymentStatusCode());
        assertEquals("UNPAID", payments.get(payments.size() - 1).paymentStatusCode());
    }

    /** N-20-1 기관 연동 공과금 기록의 외래 키에 쓰는 테스트용 동의를 만든다. */
    private long insertUtilityConsent() {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO USER_CONSENT (USER_ID, CONSENT_TYPE_CODE, PROVIDER_CODE, ITEM_CODE, REQUIRED_YN, AGREED_YN)
                    VALUES (?, 'ALT_DATA_PROVISION', 'utility', 'UTILITY_BILL', 'Y', 'Y')
                    """, new String[]{"CONSENT_ID"});
            statement.setLong(1, userId);
            return statement;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }

    /** N-20-1 납부 상태와 출처별 DB 제약을 충족하는 공과금 기록을 만든다. */
    private void insertUtilityPayment(String billMonth, String status, String source, Long consentId) {
        LocalDate dueDate = YearMonth.parse(billMonth).atDay(20);
        LocalDate paidDate = switch (status) {
            case "ON_TIME" -> dueDate;
            case "LATE" -> dueDate.plusDays(1);
            default -> null;
        };
        jdbc.update("""
                INSERT INTO USER_UTILITY_PAYMENT (USER_ID, BILL_MONTH, BILLED_AMT, DUE_DATE, PAID_DATE,
                                                  PAYMENT_STATUS_CODE, SOURCE_CODE, CONSENT_ID, BASE_DATE)
                VALUES (?, ?, 20000, ?, ?, ?, ?, ?, ?)
                """, userId, billMonth, dueDate, paidDate, status, source, consentId, dueDate);
    }
}
