package com.baeksuescape.user.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.QaItAccounts;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.AuthService;

/**
 * FP-290 N-01-3 같은 계정에 틀린 비밀번호를 동시에 보내도 실패 횟수가 빠짐없이 오르는지 실제 Oracle DB에서 확인하는 통합 테스트(-Ddb.it=true일 때만 실행).
 * 스레드마다 AuthService.authenticate가 자기 트랜잭션을 열어야 하므로 시험 메서드에는 @Transactional을 붙이지 않고, 만든 계정(qa1127it 접두어)은 끝나면 지운다.
 * 로그인 실패 기록(SYSTEM_LOG)은 수정·삭제 금지 표라 시험 행이 남지 않게 가짜로 바꾼다.
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class UserAccountLoginFailConcurrencyIT {

    private static final int THREADS = 5;

    @Autowired
    private AuthService authService;
    @Autowired
    private UserAccountMapper userMapper;
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

    // 실패 0회 계정 하나를 커밋해 둔다(다른 트랜잭션의 스레드가 볼 수 있어야 한다).
    private UserAccount newAccount() {
        return QaItAccounts.create(userMapper, passwordEncoder, crypto, hmac);
    }

    @Test
    void 틀린_비밀번호를_동시에_5번_보내면_실패_횟수가_5가_되고_다음_시도는_5분_제한이다() throws Exception {
        UserAccount account = newAccount();
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        authService.authenticate(account.getLoginId(), "wrongpass1");
                        return "OK";
                    } catch (ApiException e) {
                        return e.getCode();
                    }
                }));
            }
            start.countDown();
            List<String> codes = new ArrayList<>();
            for (Future<String> result : results) codes.add(result.get(30, TimeUnit.SECONDS));

            assertThat(userMapper.selectById(account.getUserId()).getLoginFailCount()).as("동시 실패 응답 %s", codes).isEqualTo(THREADS);
            assertThat(codes).containsOnly("LOGIN_FAILED", "LOGIN_TEMPORARILY_BLOCKED");
            assertThat(codes).filteredOn("LOGIN_TEMPORARILY_BLOCKED"::equals).hasSize(1);
        } finally {
            pool.shutdownNow();
        }

        assertThatThrownBy(() -> authService.authenticate(account.getLoginId(), QaItAccounts.PASSWORD))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("LOGIN_TEMPORARILY_BLOCKED"));
        assertThat(userMapper.selectById(account.getUserId()).getLoginFailCount()).isEqualTo(THREADS);
    }
}
