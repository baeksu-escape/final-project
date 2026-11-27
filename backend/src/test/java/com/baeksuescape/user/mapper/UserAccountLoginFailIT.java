package com.baeksuescape.user.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.user.dto.UserAccount;

/**
 * FP-258 N-01-3 마지막 로그인 실패 시각을 실제 Oracle DB에서 확인하는 통합 테스트(-Ddb.it=true일 때만 실행).
 * 실패 뒤 닉네임을 바꿔도 시각이 그대로인지, 로그인 성공·관리자 잠금 해제 뒤 비워지는지 본다. 바꾼 행은 끝나면 되돌린다(@Transactional).
 * LAST_LOGIN_FAIL_AT 열(alter_app_user_last_login_fail_at.sql)이 있는 DB에서 돌린다.
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class UserAccountLoginFailIT {

    private static final LocalDateTime FAILED_AT = LocalDateTime.of(2099, 1, 1, 9, 0);

    @Autowired
    private UserAccountMapper userMapper;
    @Autowired
    private AdminAccountMapper adminMapper;
    @Autowired
    private JdbcTemplate jdbc;

    // 확인에 쓸 일반 회원 한 명(ACTIVE). 없으면 건너뛴다.
    private long anyActiveUserId() {
        Long userId = jdbc.queryForObject(
                "SELECT MIN(USER_ID) FROM APP_USER WHERE ROLE_CODE = 'ROLE_USER' AND ACCOUNT_STATUS_CODE = 'ACTIVE'", Long.class);
        Assumptions.assumeTrue(userId != null, "ACTIVE 일반 회원이 없어 건너뜀");
        return userId;
    }

    @Test
    void 실패_뒤_닉네임을_바꿔도_마지막_실패_시각은_그대로다() {
        long userId = anyActiveUserId();
        userMapper.updateLoginFailure(userId, 5, false, FAILED_AT);
        userMapper.updateNickname(userId, "it" + ThreadLocalRandom.current().nextInt(100000, 1000000), FAILED_AT.plusMinutes(3));

        UserAccount account = userMapper.selectById(userId);
        assertThat(account.getLoginFailCount()).isEqualTo(5);
        assertThat(account.getLastLoginFailAt()).isEqualTo(FAILED_AT);
        assertThat(account.getUpdatedAt()).isEqualTo(FAILED_AT.plusMinutes(3));
    }

    @Test
    void 로그인_성공과_관리자_잠금_해제_뒤에는_마지막_실패_시각을_비운다() {
        long userId = anyActiveUserId();
        userMapper.updateLoginFailure(userId, 5, false, FAILED_AT);
        userMapper.updateLoginSuccess(userId, FAILED_AT.plusMinutes(6));
        assertThat(userMapper.selectById(userId).getLastLoginFailAt()).isNull();

        userMapper.updateLoginFailure(userId, 10, true, FAILED_AT.plusMinutes(7));
        assertThat(userMapper.selectById(userId).getLastLoginFailAt()).isEqualTo(FAILED_AT.plusMinutes(7));
        adminMapper.updateUnlocked(userId, FAILED_AT.plusMinutes(8));

        UserAccount unlocked = userMapper.selectById(userId);
        assertThat(unlocked.getLoginFailCount()).isZero();
        assertThat(unlocked.getLastLoginFailAt()).isNull();
        assertThat(unlocked.getAccountStatusCode()).isEqualTo(UserAccount.ACTIVE);
    }
}
