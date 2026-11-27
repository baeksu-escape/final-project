package com.baeksuescape.chat.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-287 N-07 채팅방(CHAT_ROOM) 한 행. ownerStatusCode는 방 주인 회원의 계정 상태(APP_USER)다.
@Getter
@Setter
public class ChatRoomRow {
    private Long roomId;
    private Long userId;
    private String ownerStatusCode;
    private LocalDateTime createdAt;
}
