package com.baeksuescape.chat.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-287 N-07-3 관리자 문의 목록 조회 결과 한 행.
@Getter
@Setter
public class ChatRoomSummaryRow {
    private Long roomId;
    private String nickname;
    private String lastMessage;
    private LocalDateTime lastMessageAt;
    private int unreadCount;
}
