package com.baeksuescape.notification.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

/** FP-284·D-23 USER_NOTIFICATION 조회·저장에 사용하는 매퍼 행이다. */
@Getter
@Setter
public class NotificationRow {
    private Long notificationId;
    private long userId;
    private String typeCode;
    private String title;
    private String content;
    private String linkUrl;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
}