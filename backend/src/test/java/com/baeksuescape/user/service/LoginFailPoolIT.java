package com.baeksuescape.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.QaItAccounts;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.zaxxer.hikari.HikariDataSource;

/**
 * FP-258 N-01-3 같은 계정에 커넥션 풀보다 많은 로그인 실패를 동시에 보내도 풀이 바닥나지 않는지 실제 Oracle DB에서 확인하는 통합 테스트(-Ddb.it=true일 때만 실행).
 * 로그인 실패 로그는 진짜처럼 REQUIRES_NEW 트랜잭션으로 커넥션을 하나 더 쓰되, SYSTEM_LOG(수정·삭제 금지)에 행을 남기지 않게 SELECT 1만 하는 대역으로 바꾼다.
 * 스레드마다 자기 트랜잭션을 써야 하므로 @Transactional을 붙이지 않고, 만든 계정(qa1127it 접두어)은 앞뒤로 지운다. 커넥션 대기는 5초로 줄여 고치기 전에도 빨리 끝나게 한다.
 */
@SpringBootTest(properties = "spring.datasource.hikari.connection-timeout=5000")
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class LoginFailPoolIT {

    private static final long DEADLINE_SECONDS = 10;

    // 실패 로그 대역 — 커넥션을 REQUIRES_NEW로 하나 더 쓰고(SELECT 1 FROM DUAL) 성공·실패만 센다.
    static class PoolProbeSystemLog extends SystemLogService {
        final AtomicInteger recorded = new AtomicInteger();
        final AtomicInteger failed = new AtomicInteger();
        private final TransactionTemplate requiresNew;
        private final JdbcTemplate jdbc;

        PoolProbeSystemLog(SystemLogMapper mapper, PlatformTransactionManager transactionManager, JdbcTemplate jdbc, Clock clock) {
            super(mapper, transactionManager, clock);
            this.requiresNew = new TransactionTemplate(transactionManager);
            this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            this.jdbc = jdbc;
        }

        @Override
        public void record(Type type, String source, String message, Long actorUserId) {
            try {
                requiresNew.executeWithoutResult(status -> jdbc.queryForObject("SELECT 1 FROM DUAL", Integer.class));
                recorded.incrementAndGet();
            } catch (RuntimeException e) {
                failed.incrementAndGet();
            }
        }
    }

    @TestConfiguration
    static class ProbeConfig {
        @Bean
        @Primary
        PoolProbeSystemLog poolProbeSystemLog(SystemLogMapper mapper, PlatformTransactionManager transactionManager, JdbcTemplate jdbc, Clock clock) {
            return new PoolProbeSystemLog(mapper, transactionManager, jdbc, clock);
        }
    }

    @Autowired
    private AuthService authService;
    @Autowired
    private PoolProbeSystemLog probe;
    @Autowired
    private UserAccountMapper userMapper;
    // FP-258 5분 제한 중 BCrypt를 돌리지 않는지 호출 횟수를 센다(진짜 인코더를 감싼다).
    @SpyBean
    private PasswordEncoder passwordEncoder;
    @Autowired
    private PiiCrypto crypto;
    @Autowired
    private PiiHmac hmac;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private DataSource dataSource;

    @BeforeEach
    @AfterEach
    void removeTestAccounts() {
        QaItAccounts.deleteAll(jdbc);
    }

    // 실패 0회 계정 하나를 커밋해 둔다(다른 트랜잭션의 스레드가 볼 수 있어야 한다).
    private UserAccount newAccount() {
        return QaItAccounts.create(userMapper, passwordEncoder, crypto, hmac);
    }

    // 응답 code 목록과 걸린 시간(ms)
    private record Burst(List<String> codes, long elapsedMillis) {
    }

    // 스레드 threads개가 동시에 출발해 call(번호)을 부르고 응답 code를 모은다.
    private Burst burst(int threads, IntFunction<Object> call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        List<String> codes = new ArrayList<>();
        long elapsedMillis;
        try {
            for (int i = 0; i < threads; i++) {
                int index = i;
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        call.apply(index);
                        return "OK";
                    } catch (ApiException e) {
                        return e.getCode();
                    } catch (RuntimeException e) {
                        return e.getClass().getSimpleName();
                    }
                }));
            }
            long begin = System.nanoTime();
            start.countDown();
            pool.shutdown();
            boolean finished = pool.awaitTermination(120, TimeUnit.SECONDS);
            elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - begin);
            assertThat(finished).as("스레드가 120초 안에 끝나지 않음").isTrue();
            for (Future<String> result : results) codes.add(result.get());
        } finally {
            pool.shutdownNow();
        }
        return new Burst(codes, elapsedMillis);
    }

    private int threadsOverPool() throws Exception {
        return Math.max(15, dataSource.unwrap(HikariDataSource.class).getMaximumPoolSize() + 5);
    }

    @Test
    void 풀보다_많은_로그인_실패를_동시에_보내도_제때_끝나고_실패_횟수는_규칙대로다() throws Exception {
        int poolSize = dataSource.unwrap(HikariDataSource.class).getMaximumPoolSize();
        int threads = threadsOverPool();
        UserAccount account = newAccount();
        Burst result = burst(threads, i -> authService.authenticate(account.getLoginId(), "wrongpass1"));
        List<String> codes = result.codes();
        long elapsedMillis = result.elapsedMillis();

        assertThat(probe.failed.get()).as("로그 대역이 커넥션을 못 받은 횟수 (풀 %d, 스레드 %d, %dms, 응답 %s)", poolSize, threads, elapsedMillis, codes).isZero();
        assertThat(elapsedMillis).as("동시 실패 %d개가 끝난 시간(ms), 응답 %s", threads, codes).isLessThan(DEADLINE_SECONDS * 1000);
        // 4회까지 401, 5회째 429(5분 제한 시작), 나머지는 제한 중이라 세지 않고 429.
        assertThat(codes).filteredOn("LOGIN_FAILED"::equals).hasSize(AuthService.TEMP_BLOCK_FAILURES - 1);
        assertThat(codes).filteredOn("LOGIN_TEMPORARILY_BLOCKED"::equals).hasSize(threads - (AuthService.TEMP_BLOCK_FAILURES - 1));
        assertThat(userMapper.selectById(account.getUserId()).getLoginFailCount()).isEqualTo(AuthService.TEMP_BLOCK_FAILURES);
    }

    // FP-258 이미 5분 제한 중인 계정에 맞는·틀린 비밀번호를 풀보다 많이 동시에 보내도 BCrypt 없이 모두 429로 짧게 끝나고, 횟수·성공 처리는 그대로다.
    @Test
    void 제한_중인_계정에_몰린_요청은_BCrypt_없이_모두_429로_짧게_끝난다() throws Exception {
        int threads = threadsOverPool();
        UserAccount account = newAccount();
        userMapper.updateLoginFailure(account.getUserId(), AuthService.TEMP_BLOCK_FAILURES, false, LocalDateTime.now());
        clearInvocations(passwordEncoder);

        Burst result = burst(threads, i -> authService.authenticate(account.getLoginId(), i % 2 == 0 ? QaItAccounts.PASSWORD : "wrongpass1"));

        assertThat(result.codes()).as("응답 %s", result.codes()).containsOnly("LOGIN_TEMPORARILY_BLOCKED").hasSize(threads);
        assertThat(result.elapsedMillis()).as("제한 중 동시 %d개가 끝난 시간(ms)", threads).isLessThan(3000);
        verify(passwordEncoder, never()).matches(any(), any());
        UserAccount after = userMapper.selectById(account.getUserId());
        assertThat(after.getLoginFailCount()).isEqualTo(AuthService.TEMP_BLOCK_FAILURES);
        assertThat(after.getLastLoginAt()).isNull();
    }
}
