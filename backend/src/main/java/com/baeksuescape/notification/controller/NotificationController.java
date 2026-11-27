package com.baeksuescape.notification.controller;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.notification.dto.NotificationItemResponse;
import com.baeksuescape.notification.dto.NotificationListResponse;
import com.baeksuescape.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** FP-284·D-23 로그인 회원의 알림 목록과 읽음 처리 API다. */
@RestController
@RequestMapping("/api/members/me/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    /** FP-284·D-23 로그인 회원의 최근 알림과 안 읽은 개수를 반환한다. */
    @GetMapping
    public ResponseEntity<NotificationListResponse> list(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(notificationService.list(user.userId()));
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