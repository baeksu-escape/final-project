package com.baeksuescape.user.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// PR #52 리뷰 4·5 회원 단위 쓰기 잠금 — UserAccountMapper.xml의 lockUser SQL(SELECT … FOR UPDATE)이 실제로 행을 잠그는지 H2(Oracle 모드)로 본다.
// 실제 Oracle은 작업 3 방식(로컬 Docker)으로 확인한다. 이 테스트의 표는 메모리 H2에만 만들고 프로젝트 DB와는 상관없다.
class UserLockSqlTest {

    private static final String URL = "jdbc:h2:mem:user-lock;MODE=Oracle;DB_CLOSE_DELAY=-1";

    private Connection first;
    private Connection second;
    private String lockSql;

    @BeforeEach
    void setUp() throws Exception {
        lockSql = lockUserSql();
        try (Connection setup = DriverManager.getConnection(URL); Statement statement = setup.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS APP_USER");
            statement.execute("CREATE TABLE APP_USER (USER_ID NUMBER(19) PRIMARY KEY)");
            statement.execute("INSERT INTO APP_USER VALUES (7), (8)");
        }
        first = DriverManager.getConnection(URL);
        second = DriverManager.getConnection(URL);
        first.setAutoCommit(false);
        second.setAutoCommit(false);
        try (Statement statement = second.createStatement()) {
            // 기다리는 쪽이 오래 멈추지 않게 잠금 대기 시간을 짧게 둔다(H2 설정).
            statement.execute("SET LOCK_TIMEOUT 300");
        }
    }

    @AfterEach
    void tearDown() throws SQLException {
        first.rollback();
        second.rollback();
        first.close();
        second.close();
    }

    // UserAccountMapper.xml의 lockUser 문을 그대로 읽어 MyBatis 자리표시자(#{userId})만 JDBC ?로 바꾼다.
    private static String lockUserSql() throws IOException {
        String xml = Files.readString(Path.of("src/main/resources/mapper/user/UserAccountMapper.xml"));
        Matcher matcher = Pattern.compile("<select id=\"lockUser\"[^>]*>(.*?)</select>", Pattern.DOTALL).matcher(xml);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1).trim().replace("#{userId}", "?");
    }

    // 한 연결(트랜잭션)에서 회원 행을 잠근다. 회원이 없으면 null.
    private Long lock(Connection connection, long userId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(lockSql)) {
            statement.setLong(1, userId);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? rs.getLong(1) : null;
            }
        }
    }

    @Test
    void sameMemberWaitsUntilFirstTransactionEnds() throws SQLException {
        assertThat(lockSql).contains("FOR UPDATE");

        assertThat(lock(first, 7L)).isEqualTo(7L);
        // 같은 회원은 첫 트랜잭션이 끝날 때까지 잠금을 얻지 못한다(대기 시간 초과).
        assertThatThrownBy(() -> lock(second, 7L)).isInstanceOf(SQLException.class);
        second.rollback();

        // 다른 회원은 막히지 않는다.
        assertThat(lock(second, 8L)).isEqualTo(8L);
        second.rollback();

        // 첫 트랜잭션이 커밋하면 같은 회원도 잠글 수 있다.
        first.commit();
        assertThat(lock(second, 7L)).isEqualTo(7L);
    }

    @Test
    void missingMemberReturnsNull() throws SQLException {
        assertThat(lock(first, 99L)).isNull();
    }
}
