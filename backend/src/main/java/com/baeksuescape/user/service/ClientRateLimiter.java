package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.exception.ApiException;

// FP-258 N-01-3·N-02-1·N-02-3 같은 접속지(IP)의 반복 시도 제한 — 규칙마다 정해진 시간 창 안에서 횟수를 넘으면 429 TOO_MANY_REQUESTS.
// 서버 메모리에만 세므로 서버를 다시 켜면 초기화되고, 서버가 여러 대면 대마다 따로 센다(DB에는 남기지 않는다).
// IP는 컨트롤러가 HttpServletRequest.getRemoteAddr()로 넘긴다. 프록시 뒤에서 실제 접속지를 쓰려면 서버의 forward-headers 설정이 필요하다.
@Component
public class ClientRateLimiter {

    public static final String TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS";
    // 이 수보다 창이 많아지면 끝난 창을 한 번 치운다(메모리가 끝없이 늘지 않게).
    static final int CLEANUP_THRESHOLD = 10_000;

    // 제한 규칙 — 숫자는 여기에만 둔다. limit회까지는 받고, 그다음부터 창이 끝날 때까지 429.
    public enum Rule {
        // AUTH-01·05 로그인·간편 로그인 연결 실패(401) — 아이디를 바꿔 가며 시도하는 것을 막는다. 실패만 센다.
        LOGIN_FAILURE(20, Duration.ofMinutes(10), "로그인 시도가 너무 많습니다."),
        // AUTH-13·16 닉네임·아이디 중복 확인
        AVAILABILITY_CHECK(30, Duration.ofMinutes(1), "확인 요청이 너무 많습니다."),
        // AUTH-07·14 이메일·휴대폰 인증코드 발송(가입·찾기·이메일 변경)
        CODE_SEND(20, Duration.ofHours(1), "인증코드 요청이 너무 많습니다.");

        final int limit;
        final Duration window;
        final String message;

        Rule(int limit, Duration window, String message) {
            this.limit = limit;
            this.window = window;
            this.message = message;
        }
    }

    // 규칙·IP 하나의 시간 창: 시작 시각과 그 안의 횟수
    private record Window(Instant start, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public ClientRateLimiter(Clock clock) {
        this.clock = clock;
    }

    // 한 번 세고, 이번이 limit을 넘으면 429(닉네임·아이디 확인, 인증코드 발송).
    public void hit(Rule rule, String clientIp) {
        Window window = add(rule, clientIp);
        if (window.count() > rule.limit) throw tooMany(rule, window);
    }

    // 로그인·간편 로그인 연결처럼 실패만 세는 요청을 감싼다 — 결과적으로 401(아이디·비밀번호 틀림)로 끝난 요청만 센다.
    // FP-258 요청 전에 한 자리를 원자적으로 잡고(이미 limit이면 429) 401이 아니면 돌려준다. 먼저 잡아야 동시 요청도 limit개까지만 들어간다.
    public <T> T countFailures(Rule rule, String clientIp, Supplier<T> action) {
        Instant start = reserve(rule, clientIp);
        boolean failed = false;
        try {
            return action.get();
        } catch (ApiException e) {
            failed = e.getStatus() == HttpStatus.UNAUTHORIZED;
            throw e;
        } finally {
            if (!failed) release(rule, clientIp, start);
        }
    }

    // 한 자리를 잡고 그 창의 시작 시각을 돌려준다. 이미 limit만큼 찼으면 바꾸지 않고 429.
    private Instant reserve(Rule rule, String clientIp) {
        if (windows.size() > CLEANUP_THRESHOLD) windows.entrySet().removeIf((entry) -> expired(ruleOf(entry.getKey()), entry.getValue()));
        Instant now = clock.instant();
        Window[] full = new Window[1];
        Window window = windows.compute(key(rule, clientIp), (k, old) -> {
            Window current = old == null || expired(rule, old) ? new Window(now, 0) : old;
            if (current.count() >= rule.limit) {
                full[0] = current;
                return current;
            }
            return new Window(current.start(), current.count() + 1);
        });
        if (full[0] != null) throw tooMany(rule, full[0]);
        return window.start();
    }

    // 잡은 자리를 돌려준다. 그사이 창이 바뀌었으면(시간이 지나 새 창) 건드리지 않는다.
    private void release(Rule rule, String clientIp, Instant start) {
        windows.computeIfPresent(key(rule, clientIp),
                (k, window) -> window.start().equals(start) && window.count() > 0 ? new Window(window.start(), window.count() - 1) : window);
    }

    private Window add(Rule rule, String clientIp) {
        if (windows.size() > CLEANUP_THRESHOLD) windows.entrySet().removeIf((entry) -> expired(ruleOf(entry.getKey()), entry.getValue()));
        Instant now = clock.instant();
        return windows.compute(key(rule, clientIp),
                (k, window) -> window == null || expired(rule, window) ? new Window(now, 1) : new Window(window.start(), window.count() + 1));
    }

    private boolean expired(Rule rule, Window window) {
        return !clock.instant().isBefore(window.start().plus(rule.window));
    }

    // 남은 시간을 분으로 올림해 사람이 읽는 문구로 알린다(로그인 5분 제한 문구와 같은 모양).
    private ApiException tooMany(Rule rule, Window window) {
        long seconds = Duration.between(clock.instant(), window.start().plus(rule.window)).getSeconds();
        long minutes = Math.max(1, (seconds + 59) / 60);
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY_REQUESTS, rule.message + " " + minutes + "분 뒤에 다시 시도해 주세요.");
    }

    private static String key(Rule rule, String clientIp) {
        return rule.name() + "|" + clientIp;
    }

    private static Rule ruleOf(String key) {
        return Rule.valueOf(key.substring(0, key.indexOf('|')));
    }
}
