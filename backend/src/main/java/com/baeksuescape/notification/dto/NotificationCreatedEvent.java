package com.baeksuescape.notification.dto;

/** FP-284·D-23 알림 저장 뒤 SSE 등 후속 전달기가 구독할 생성 이벤트다. */
public record NotificationCreatedEvent(NotificationItemResponse notification) {
}