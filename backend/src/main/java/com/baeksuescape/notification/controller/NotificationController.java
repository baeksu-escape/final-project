package com.baeksuescape.notification.controller;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.notification.dto.NotificationItemResponse;
import com.baeksuescape.notification.dto.NotificationListResponse;
import com.baeksuescape.notification.service.NotificationService;
import com.baeksuescape.notification.service.NotificationStreamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** FP-284·D-23 로그인 회원의 알림 목록과 읽음 처리 API다. */
@RestController
@RequestMapping("/api/members/me/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;
    private final NotificationStreamService notificationStreamService;

    /** FP-300·D-23 로그인 회원의 조건별 알림 목록과 전체 안 읽은 개수, 다음 페이지 유무를 반환한다. */
    @GetMapping
    public ResponseEntity<NotificationListResponse> list(@AuthenticationPrincipal AuthUser user,
            @RequestParam(defaultValue = "false") boolean unreadOnly, @RequestParam(required = false) String type,
            @RequestParam(required = false) Long before, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(notificationService.list(user.userId(), unreadOnly, type, before, size));
    }

    /**
     * FP-284·D-23 새 알림을 실시간으로 받는 SSE 스트림이다. 로그인은 기존 Authorization 헤더 토큰으로 확인한다.
     * 연결 직후 connected 이벤트, 이후 하트비트와 notification 이벤트가 온다. 끊기면 화면이 목록을 다시 불러온다.
     */
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal AuthUser user) {
        return notificationStreamService.register(user.userId());
    }

    /** FP-284·D-23 본인 알림을 읽음 처리한다. */
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal AuthUser user, @PathVariable long notificationId) {
        notificationService.markRead(user.userId(), notificationId);
        return ResponseEntity.ok().build();
    }

    /** FP-284·D-23 본인 안 읽은 알림을 모두 읽음 처리하고 처리 건수를 반환한다. */
    @PatchMapping("/read-all")
    public ResponseEntity<ReadAllResponse> markAllRead(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(new ReadAllResponse(notificationService.markAllRead(user.userId())));
    }

    /** FP-284·D-23 읽음 처리 건수를 담는 응답이다. */
    public record ReadAllResponse(int updatedCount) {
    }
}