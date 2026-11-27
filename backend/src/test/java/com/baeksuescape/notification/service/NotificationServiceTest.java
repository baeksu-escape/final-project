package com.baeksuescape.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.notification.dto.NotificationCreatedEvent;
import com.baeksuescape.notification.dto.NotificationRow;
import com.baeksuescape.notification.mapper.NotificationMapper;

import static org.mockito.Mockito.mock;

/** FP-284·D-23 알림 목록·읽음·생성 규칙을 매퍼와 분리해 검증한다. */
class NotificationServiceTest {
    private NotificationMapper mapper;
    private ApplicationEventPublisher eventPublisher;
    private NotificationService service;

    @Test
    @DisplayName("알림 저장 실패는 notifyQuietly에서 삼켜 원래 처리를 계속한다")
    void notifyQuietly_swallowsCreateFailure() {
        given(mapper.insert(any())).willThrow(new IllegalStateException("database failure"));

        org.assertj.core.api.Assertions.assertThatCode(() -> service.notifyQuietly(7L, "WELCOME", "환영", "시작", "/data-input"))
                .doesNotThrowAnyException();
    }

    @BeforeEach
    void setUp() {
        mapper = mock(NotificationMapper.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        service = new NotificationService(mapper, eventPublisher);
    }

    @Test
    @DisplayName("최근 20건과 전체 안 읽은 수를 반환한다")
    void list_latestTwentyAndUnreadCount() {
        LocalDateTime now = LocalDateTime.now();
        NotificationRow row = row(31L, 7L, null, now);
        given(mapper.selectLatest(7L, 20)).willReturn(List.of(row));
        given(mapper.countUnread(7L)).willReturn(4L);

        var result = service.list(7L);

        assertThat(result.unreadCount()).isEqualTo(4);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).notificationId()).isEqualTo(31L);
        assertThat(result.items().get(0).read()).isFalse();
    }


    @Test
    @DisplayName("list applies filters, cursor, size, and computes hasMore")
    void list_filteredAndHasMore() {
        LocalDateTime now = LocalDateTime.now();
        given(mapper.selectFiltered(7L, true, "COMMENT_NEW", 50L, 3))
                .willReturn(List.of(row(49L, 7L, null, now), row(48L, 7L, null, now.minusMinutes(1)),
                        row(47L, 7L, null, now.minusMinutes(2))));
        given(mapper.countUnread(7L)).willReturn(4L);

        var result = service.list(7L, true, "COMMENT_NEW", 50L, 2);

        assertThat(result.unreadCount()).isEqualTo(4);
        assertThat(result.items()).extracting(com.baeksuescape.notification.dto.NotificationItemResponse::notificationId)
                .containsExactly(49L, 48L);
        assertThat(result.hasMore()).isTrue();
        verify(mapper).selectFiltered(7L, true, "COMMENT_NEW", 50L, 3);
    }

    @Test
    @DisplayName("list rejects unsupported notification type")
    void list_invalidType_rejected() {
        assertThatThrownBy(() -> service.list(7L, false, "UNKNOWN", null, 20))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
    @Test
    @DisplayName("본인 안 읽은 알림을 읽음 처리한다")
    void markRead_ownedNotification() {
        given(mapper.markRead(eq(7L), eq(31L), any())).willReturn(1);
        service.markRead(7L, 31L);
        verify(mapper).markRead(eq(7L), eq(31L), any());
    }

    @Test
    @DisplayName("남의 알림과 없는 알림은 NOT_FOUND로 거부한다")
    void markRead_otherOrMissingNotification_notFound() {
        given(mapper.markRead(eq(7L), eq(31L), any())).willReturn(0);
        given(mapper.selectOwned(7L, 31L)).willReturn(null);

        assertThatThrownBy(() -> service.markRead(7L, 31L)).isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("이미 읽은 본인 알림은 성공으로 유지한다")
    void markRead_alreadyRead_isSuccess() {
        given(mapper.markRead(eq(7L), eq(31L), any())).willReturn(0);
        given(mapper.selectOwned(7L, 31L)).willReturn(row(31L, 7L, LocalDateTime.now(), LocalDateTime.now()));
        service.markRead(7L, 31L);
        verify(mapper).selectOwned(7L, 31L);
    }

    @Test
    @DisplayName("본인 전체 읽음 처리 건수를 반환한다")
    void markAllRead_returnsUpdatedCount() {
        given(mapper.markAllRead(eq(7L), any())).willReturn(3);
        assertThat(service.markAllRead(7L)).isEqualTo(3);
    }

    @Test
    @DisplayName("유효한 알림은 저장 후 생성 이벤트를 발행한다")
    void create_valid_persistsAndPublishesEvent() {
        given(mapper.insert(any())).willAnswer(invocation -> {
            NotificationRow row = invocation.getArgument(0);
            row.setNotificationId(31L);
            return 1;
        });

        var result = service.create(7L, "WELCOME", "환영합니다", "알림 설정을 확인해 주세요.", "/mypage");

        assertThat(result.notificationId()).isEqualTo(31L);
        assertThat(result.read()).isFalse();
        verify(eventPublisher).publishEvent(any(NotificationCreatedEvent.class));
    }

    @Test
    @DisplayName("알림 종류·필수 내용·길이·내부 경로만 허용한다")
    void create_invalidInput_rejected() {
        assertInvalid("UNKNOWN", "제목", "내용", "/home");
        assertInvalid("WELCOME", " ", "내용", "/home");
        assertInvalid("WELCOME", "x".repeat(201), "내용", "/home");
        assertInvalid("WELCOME", "제목", "x".repeat(1001), "/home");
        assertInvalid("WELCOME", "제목", "내용", "https://example.com");
        assertInvalid("WELCOME", "제목", "내용", "//example.com");
        verify(mapper, never()).insert(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    private void assertInvalid(String type, String title, String content, String link) {
        assertThatThrownBy(() -> service.create(7L, type, title, content, link))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private NotificationRow row(long id, long userId, LocalDateTime readAt, LocalDateTime createdAt) {
        NotificationRow row = new NotificationRow();
        row.setNotificationId(id);
        row.setUserId(userId);
        row.setTypeCode("WELCOME");
        row.setTitle("환영합니다");
        row.setContent("서비스를 시작해 보세요.");
        row.setLinkUrl("/home");
        row.setReadAt(readAt);
        row.setCreatedAt(createdAt);
        return row;
    }
}