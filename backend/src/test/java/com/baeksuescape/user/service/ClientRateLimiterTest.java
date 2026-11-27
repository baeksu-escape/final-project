package com.baeksuescape.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.service.ClientRateLimiter.Rule;

// FP-258 같은 IP의 반복 시도 제한(서버 메모리) — 규칙별 횟수·시간 창, 실패만 세는 로그인, IP끼리 따로 센다.
class ClientRateLimiterTest {

    private static final String IP = "10.0.0.1";

    // 시험에서 시각을 앞으로 돌리는 시계
    static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-11-27T01:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("Asia/Seoul");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private MovableClock clock;
    private ClientRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MovableClock();
        limiter = new ClientRateLimiter(clock);
    }

    @Test
    void 중복_확인은_1분에_30회까지_받고_31회째는_429이며_1분이_지나면_다시_받는다() {
        for (int i = 0; i < 30; i++) limiter.hit(Rule.AVAILABILITY_CHECK, IP);
        assertThatThrownBy(() -> limiter.hit(Rule.AVAILABILITY_CHECK, IP))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(e.getCode()).isEqualTo("TOO_MANY_REQUESTS");
                    assertThat(e.getMessage()).isEqualTo("확인 요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요.");
                });
        // 다른 IP는 따로 센다.
        limiter.hit(Rule.AVAILABILITY_CHECK, "10.0.0.2");
        clock.advance(Duration.ofMinutes(1));
        limiter.hit(Rule.AVAILABILITY_CHECK, IP);
    }

    @Test
    void 인증코드_요청은_1시간에_20회까지이고_남은_분을_올림해_알린다() {
        for (int i = 0; i < 20; i++) limiter.hit(Rule.CODE_SEND, IP);
        clock.advance(Duration.ofMinutes(15).plusSeconds(30));
        assertThatThrownBy(() -> limiter.hit(Rule.CODE_SEND, IP))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).isEqualTo("인증코드 요청이 너무 많습니다. 45분 뒤에 다시 시도해 주세요."));
    }

    @Test
    void 로그인은_401_실패만_세고_10분에_20회를_넘으면_요청_전에_429() {
        // 성공과 401이 아닌 오류(423 잠김 등)는 세지 않는다.
        for (int i = 0; i < 5; i++) assertThat(limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> "ok")).isEqualTo("ok");
        assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
            throw AuthErrors.accountLocked();
        })).hasMessageContaining("잠긴 계정");
        for (int i = 0; i < 20; i++) {
            assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
                throw AuthErrors.loginFailed();
            })).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("LOGIN_FAILED"));
        }
        // 21번째는 아이디·비밀번호와 상관없이 요청 전에 막는다(서비스를 부르지 않음).
        assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> "ok"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("TOO_MANY_REQUESTS");
                    assertThat(e.getMessage()).isEqualTo("로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.");
                });
        clock.advance(Duration.ofMinutes(10));
        assertThat(limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> "ok")).isEqualTo("ok");
    }

    // FP-258 동시에 몰린 로그인 실패도 limit(20)개까지만 비밀번호 확인에 들어가고, 나머지는 요청 전에 429.
    @Test
    void 동시에_몰린_로그인_실패도_20개까지만_확인하고_나머지는_요청_전에_429() throws Exception {
        int threads = 40;
        AtomicInteger entered = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch allIn = new CountDownLatch(Rule.LOGIN_FAILURE.limit);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Future<String>> results = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        return limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
                            entered.incrementAndGet();
                            allIn.countDown();
                            // 들어온 요청은 limit개가 모두 들어올 때까지 붙잡아 둔다(나중에 세는 방식이면 여기서 limit을 넘는다).
                            try {
                                allIn.await(2, TimeUnit.SECONDS);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                            }
                            throw AuthErrors.loginFailed();
                        });
                    } catch (ApiException e) {
                        return e.getCode();
                    }
                }));
            }
            start.countDown();
            List<String> codes = new ArrayList<>();
            for (Future<String> result : results) codes.add(result.get(10, TimeUnit.SECONDS));

            assertThat(entered.get()).isEqualTo(Rule.LOGIN_FAILURE.limit);
            assertThat(codes).filteredOn("LOGIN_FAILED"::equals).hasSize(Rule.LOGIN_FAILURE.limit);
            assertThat(codes).filteredOn("TOO_MANY_REQUESTS"::equals).hasSize(threads - Rule.LOGIN_FAILURE.limit);
        } finally {
            pool.shutdownNow();
        }
    }

    // FP-258 먼저 잡은 자리는 401·계정 5분 제한 429가 아니면(성공·잠금 423·400) 돌려주므로, 그런 요청이 많아도 실패 한도를 쓰지 않는다.
    @Test
    void 성공과_잠금_입력_오류는_먼저_잡은_자리를_돌려준다() {
        for (int i = 0; i < 30; i++) limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> "ok");
        for (ApiException error : new ApiException[] { AuthErrors.accountLocked(), AuthErrors.invalidField("loginId", "아이디를 입력해 주세요.") }) {
            for (int i = 0; i < 15; i++) {
                assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
                    throw error;
                })).isSameAs(error);
            }
        }
        for (int i = 0; i < 19; i++) {
            assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
                throw AuthErrors.loginFailed();
            })).isInstanceOf(ApiException.class);
        }
        // 실패는 19번이라 20번째 요청도 들어간다.
        assertThat(limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> "ok")).isEqualTo("ok");
    }

    // FP-258 계정 5분 제한 429(LOGIN_TEMPORARILY_BLOCKED, 5회째에 거는 응답 포함)도 401처럼 센다. 제한된 계정에 몰아 보내도 IP 한도에 걸린다.
    @Test
    void 계정_5분_제한_429도_실패로_세어_21번째는_IP_제한_429() {
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
                throw AuthErrors.loginTemporarilyBlocked(5);
            })).isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("LOGIN_TEMPORARILY_BLOCKED"));
        }
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> {
                throw AuthErrors.loginFailed();
            })).isInstanceOf(ApiException.class);
        }
        assertThatThrownBy(() -> limiter.countFailures(Rule.LOGIN_FAILURE, IP, () -> "ok"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(e.getCode()).isEqualTo("TOO_MANY_REQUESTS");
                });
    }
}
