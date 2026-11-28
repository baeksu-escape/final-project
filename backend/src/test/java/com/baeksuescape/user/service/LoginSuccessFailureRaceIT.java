package com.baeksuescape.user.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.QaItAccounts;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

/**
 * FP-258 N-01-3 실패 9회 계정에 맞는·틀린 비밀번호를 동시에 1건씩 보내도 성공 처리가 실패를 지우지 않는지 실제 Oracle DB에서 확인한다(-Ddb.it=true일 때만).
 * 허용 결과는 둘뿐이다: (가) 성공 → 틀린 쪽 401, 최종 1회 ACTIVE / (나) 틀린 쪽 10회째 잠금 423 → 맞는 쪽 423, 최종 10회 LOCKED.
 * 스레드마다 자기 트랜잭션을 써야 해서 @Transactional을 붙이지 않고, 계정(qa1127it)은 앞뒤로 지운다. 로그(SYSTEM_LOG)는 가짜로 바꿔 행을 남기지 않는다.
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class LoginSuccessFailureRaceIT {

    private static final int ROUNDS = 30;

    @Autowired
    private AuthService authService;
    @Autowired
    private UserAccountMapper userMapper;
    @Autowired
    private AdminAccountMapper adminMapper;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private PiiCrypto crypto;
    @Autowired
    private PiiHmac hmac;
    @Autowired
    private JdbcTemplate jdbc;
    @MockBean
    private SystemLogService systemLog;

    @BeforeEach
    @AfterEach
    void removeTestAccounts() {
        QaItAccounts.deleteAll(jdbc);
    }

    // 로그인 한 번의 결과 code(성공이면 OK)
    private String loginCode(String loginId, String password) {
        try {
            authService.login(new AuthRequests.Login(loginId, password));
            return "OK";
        } catch (ApiException e) {
            return e.getCode();
        }
    }

    @Test
    void 맞는_비밀번호와_틀린_비밀번호를_동시에_보내도_결과는_둘_중_하나다() throws Exception {
        UserAccount account = QaItAccounts.create(userMapper, passwordEncoder, crypto, hmac);
        List<String> rounds = new ArrayList<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < ROUNDS; round++) {
                // 라운드마다 잠금을 풀고 실패 9회로 되돌린다.
                adminMapper.updateUnlocked(account.getUserId(), LocalDateTime.now());
                userMapper.updateLoginFailure(account.getUserId(), AuthService.MAX_LOGIN_FAILURES - 1, false, LocalDateTime.now());
                CountDownLatch start = new CountDownLatch(1);
                Future<String> right = pool.submit(() -> {
                    start.await();
                    return loginCode(account.getLoginId(), QaItAccounts.PASSWORD);
                });
                Future<String> wrong = pool.submit(() -> {
                    start.await();
                    return loginCode(account.getLoginId(), "wrongpass1");
                });
                start.countDown();
                String rightCode = right.get(30, TimeUnit.SECONDS);
                String wrongCode = wrong.get(30, TimeUnit.SECONDS);
                UserAccount after = userMapper.selectById(account.getUserId());
                String result = rightCode + "/" + wrongCode + " → " + after.getLoginFailCount() + "회 " + after.getAccountStatusCode();
                rounds.add(result);
                assertThat(result).as("라운드 %d (지금까지 %s)", round + 1, rounds)
                        .isIn("OK/LOGIN_FAILED → 1회 ACTIVE", "ACCOUNT_LOCKED/ACCOUNT_LOCKED → 10회 LOCKED");
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
