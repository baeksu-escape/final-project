package com.baeksuescape.chat.dto;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// FP-287 N-07 1:1 채팅 API 요청·응답(API 정의서 CHAT-01~09). 회원 API와 관리자 API가 같은 모양을 쓴다.
public final class ChatDtos {

    // 메시지 한 건의 최대 글자 수. DDL CHAT_MESSAGE.CONTENT 길이, 프론트 chatConstants.js와 같다.
    public static final int CONTENT_MAX = 500;

    private ChatDtos() {
    }

    // CHAT-02·07 메시지 보내기
    public record MessageWrite(
            @NotBlank(message = "메시지를 입력해 주세요.") @Size(max = CONTENT_MAX, message = "메시지는 500자까지 쓸 수 있습니다.") String content) {
    }

    // CHAT-03·08 읽음 처리. lastMessageId: 화면에 보인 마지막 메시지 번호
    public record ReadMark(@NotNull(message = "마지막으로 읽은 메시지 번호가 필요합니다.") Long lastMessageId) {
    }

    // 메시지 한 건. senderType: USER(회원) 또는 ADMIN(관리자). 관리자가 누구인지는 보내지 않는다.
    public record Message(Long messageId, String senderType, String content, LocalDateTime createdAt) {
    }

    // CHAT-01·06 메시지 묶음(오래된 것부터). 아직 문의한 적이 없는 회원은 roomId가 null이다.
    // hasMore: afterId로 조회했으면 더 새 메시지가, 그 밖에는 더 이전 메시지가 남아 있다.
    public record MessagePage(Long roomId, List<Message> messages, boolean hasMore) {
    }

    // CHAT-05 관리자 문의 목록 한 줄. unreadCount: 관리자들이 아직 읽지 않은 회원 메시지 수
    public record RoomSummary(Long roomId, String nickname, String lastMessage, LocalDateTime lastMessageAt, int unreadCount) {
    }

    // CHAT-05 문의 목록 한 쪽(최근 메시지 순). page는 1부터
    public record RoomPage(List<RoomSummary> items, int page, int size, int totalCount) {
    }

    // CHAT-04·09 안 읽은 메시지 수
    public record UnreadCount(int unreadCount) {
    }
}
