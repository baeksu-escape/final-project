package com.baeksuescape.chat.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-287 N-07 채팅 메시지(CHAT_MESSAGE) 한 행.
@Getter
@Setter
public class ChatMessageRow {
    private Long messageId;
    private Long roomId;
    private Long senderUserId;
    private String senderTypeCode;
    private String content;
    private LocalDateTime createdAt;
}
