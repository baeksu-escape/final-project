package com.baeksuescape.chat.dto;

// FP-287 N-07-6 메시지를 저장했다는 알림. 커밋 뒤에 웹소켓이 방 주인과 관리자에게 신호를 보낸다. 본문은 담지 않는다.
public record ChatMessageSavedEvent(long roomId, long ownerUserId) {
}
