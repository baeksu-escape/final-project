package com.baeksuescape.user.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.service.email.EmailCodeSender;
import com.baeksuescape.user.service.phone.PhoneCodeSender;

/**
 * FP-258 PR #173 N-02-3 같은 이메일·휴대폰에 인증코드 발송을 동시에 보내도 하루 상한(10회)을 넘지 않는지 실제 Oracle DB에서 확인하는 통합 테스트(-Ddb.it=true일 때만 실행).
 * 시험 대상(qa1127it 접두어 이메일, 시험용 번호)의 오늘 발송 기록 9건을 넣고 스레드 5개가 동시에 보낸다. 메일·문자는 보내지 않게 발송기만 가짜로 바꾼다.
 * 스레드마다 자기 트랜잭션을 써야 하므로 @Transactional을 붙이지 않고, 만든 발송 기록은 앞뒤로 지운다.
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class CodeSendDailyLimitConcurrencyIT {

    private static final int THREADS = 5;
    private static final String SUFFIX = String.valueOf(ThreadLocalRandom.current().nextInt(1000, 10000));
    private static final String EMAIL = "qa1127it" + SUFFIX + "@test.local";
    private static final String PHONE = "0109112" + SUFFIX;

    @MockBean
    private EmailCodeSender emailSender;
    @MockBean
    private PhoneCodeSender phoneSender;
    @Autowired
    private EmailVerificationService emailVerification;
    @Autowired
    private PhoneVerificationService phoneVerification;
    @Autowired
    private PiiHmac hmac;
    @Autowired
    private Clock clock;
    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    @AfterEach
    void removeTestCodes() {
        jdbc.update("DELETE FROM VERIFICATION_CODE WHERE TARGET_HMAC IN (?, ?)", hmac.email(EMAIL), hmac.phone(PHONE));
    }

    // 오늘 보낸 기록 n건을 만든다(코드 해시는 쓰지 않는 값).
    private void insertTodaySends(String channel, String target, int count) {
        LocalDateTime now = LocalDateTime.now(clock);
        for (int i = 0; i < count; i++) {
            jdbc.update("INSERT INTO VERIFICATION_CODE (PURPOSE_CODE, CHANNEL_CODE, TARGET_HMAC, CODE_HASH, ATTEMPT_COUNT, EXPIRES_AT, CREATED_AT) "
                    + "VALUES ('SIGNUP', ?, ?, 'it-unused', 0, ?, ?)", channel, target, Timestamp.valueOf(now.plusMinutes(5)), Timestamp.valueOf(now));
        }
    }

    private int countTodaySends(String channel, String target) {
        LocalDateTime startOfDay = LocalDateTime.now(clock).toLocalDate().atStartOfDay();
        return jdbc.queryForObject("SELECT COUNT(*) FROM VERIFICATION_CODE WHERE CHANNEL_CODE = ? AND TARGET_HMAC = ? AND CREATED_AT >= ?",
                Integer.class, channel, target, Timestamp.valueOf(startOfDay));
    }

    // 같은 발송을 스레드 THREADS개가 동시에 부르고 응답 code(성공은 OK)를 모은다.
    private static List<String> sendAtOnce(Callable<Object> send) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        send.call();
                        return "OK";
                    } catch (ApiException e) {
                        return e.getCode();
                    }
                }));
            }
            start.countDown();
            List<String> codes = new ArrayList<>();
            for (Future<String> result : results) codes.add(result.get(30, TimeUnit.SECONDS));
            return codes;
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void 오늘_9건인_이메일에_동시에_5번_보내면_1건만_보내고_나머지는_하루_상한이다() throws Exception {
        insertTodaySends("EMAIL", hmac.email(EMAIL), AuthErrors.DAILY_CODE_SEND_LIMIT - 1);

        List<String> codes = sendAtOnce(() -> emailVerification.send(new AuthRequests.EmailSend(EMAIL, "SIGNUP", null)));

        assertThat(codes).as("동시 발송 응답").filteredOn("OK"::equals).hasSize(1);
        assertThat(codes).filteredOn("CODE_SEND_DAILY_LIMIT"::equals).hasSize(THREADS - 1);
        assertThat(countTodaySends("EMAIL", hmac.email(EMAIL))).isEqualTo(AuthErrors.DAILY_CODE_SEND_LIMIT);
    }

    @Test
    void 오늘_9건인_휴대폰에_동시에_5번_보내면_1건만_보내고_나머지는_하루_상한이다() throws Exception {
        insertTodaySends("PHONE", hmac.phone(PHONE), AuthErrors.DAILY_CODE_SEND_LIMIT - 1);

        List<String> codes = sendAtOnce(() -> phoneVerification.send(new AuthRequests.PhoneSend(PHONE, "SIGNUP")));

        assertThat(codes).as("동시 발송 응답").filteredOn("OK"::equals).hasSize(1);
        assertThat(codes).filteredOn("CODE_SEND_DAILY_LIMIT"::equals).hasSize(THREADS - 1);
        assertThat(countTodaySends("PHONE", hmac.phone(PHONE))).isEqualTo(AuthErrors.DAILY_CODE_SEND_LIMIT);
    }
}
