package com.baeksuescape.global.log;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionOperations;

// FP-80 N-28-1 시스템 로그 기록 — 저장 실패를 삼키는지(본 요청 성공), 길이 제한, 아이디 가리기, 서울 시각.
@ExtendWith(MockitoExtension.class)
class SystemLogServiceTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-15T03:00:00Z"), ZoneId.of("Asia/Seoul"));

    @Mock
    private SystemLogMapper mapper;

    @Test
    void failureIsSwallowedSoTheCallerSucceeds() {
        given(mapper.insertLog(anyString(), anyString(), anyString(), any(), any())).willThrow(new IllegalStateException("db down"));
        SystemLogService service = new SystemLogService(mapper, TransactionOperations.withoutTransaction(), CLOCK);

        assertThatCode(() -> service.record(SystemLogService.Type.WARN, "auth-service", "로그인 실패 1/5회 (em***)", 7L)).doesNotThrowAnyException();
    }

    @Test
    void longValuesAreCutAndTimeIsSeoul() {
        SystemLogService service = new SystemLogService(mapper, TransactionOperations.withoutTransaction(), CLOCK);

        service.record(SystemLogService.Type.INFO, "s".repeat(40), "m".repeat(600), null);

        ArgumentCaptor<String> source = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(mapper).insertLog(eq("INFO"), source.capture(), message.capture(), eq(null), eq(LocalDateTime.of(2026, 11, 15, 12, 0)));
        assertThat(source.getValue()).hasSize(30);
        assertThat(message.getValue()).hasSize(500);
    }

    @Test
    void loginIdIsMaskedToTwoLettersAndStars() {
        assertThat(SystemLogService.maskLoginId("admin01")).isEqualTo("ad***");
        assertThat(SystemLogService.maskLoginId("a")).isEqualTo("a***");
        assertThat(SystemLogService.maskLoginId(null)).isEqualTo("***");
    }
}
