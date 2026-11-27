package com.baeksuescape.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.service.ClientRateLimiter.Rule;

// FP-258 13차 같은 IP의 반복 시도 제한(서버 메모리) — 규칙별 횟수·시간 창, 실패만 세는 로그인, IP끼리 따로 센다.
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
}
