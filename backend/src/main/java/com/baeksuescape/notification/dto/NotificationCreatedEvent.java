package com.baeksuescape.notification.dto;

/** FP-284·D-23 알림 저장 뒤 SSE 등 후속 전달기가 구독할 생성 이벤트다. 받는 회원 번호(userId)를 함께 담아 해당 회원의 연결에만 보낸다. */
public record NotificationCreatedEvent(long userId, NotificationItemResponse notification) {
}