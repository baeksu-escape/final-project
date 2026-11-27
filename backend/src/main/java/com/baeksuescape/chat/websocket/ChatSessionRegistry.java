package com.baeksuescape.chat.websocket;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import com.baeksuescape.chat.dto.ChatMessageSavedEvent;
import com.baeksuescape.global.security.AuthUser;

// FP-287 N-07-6 인증을 마친 웹소켓 연결 목록과 새 메시지 신호 보내기. 연결은 서버 메모리에만 있다(서버 한 대 전제).
// 신호에는 방 번호만 담는다. 본문은 화면이 REST로 다시 조회하므로 권한·계정 상태 검사를 그때 다시 받는다.
@Component
public class ChatSessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(ChatSessionRegistry.class);
    private static final String ADMIN_ROLE = "ROLE_ADMIN";
    // 한 연결에 보내는 데 걸리는 시간(밀리초)과 밀린 데이터(바이트)의 한도. 넘으면 그 연결을 포기한다.
    private static final int SEND_TIME_LIMIT_MILLIS = 5_000;
    private static final int BUFFER_SIZE_LIMIT = 16 * 1024;

    private final Map<String, Connection> connections = new ConcurrentHashMap<>();

    // 연결 하나의 주인과 보내기 통로
    private record Connection(AuthUser user, WebSocketSession session) {
    }

    // 인증된 연결을 등록한다. 여러 스레드가 함께 보내도 안전한 통로로 감싼다.
    public void register(AuthUser user, WebSocketSession session) {
        connections.put(session.getId(), new Connection(user,
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MILLIS, BUFFER_SIZE_LIMIT)));
        send(session.getId(), "{\"type\":\"AUTH_OK\"}");
    }

    public void remove(WebSocketSession session) {
        connections.remove(session.getId());
    }

    public boolean isRegistered(WebSocketSession session) {
        return connections.containsKey(session.getId());
    }

    // 메시지 저장이 커밋된 뒤 방 주인의 연결과 모든 관리자 연결에 신호를 보낸다.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageSaved(ChatMessageSavedEvent event) {
        String signal = "{\"type\":\"MESSAGE\",\"roomId\":" + event.roomId() + "}";
        connections.forEach((id, connection) -> {
            AuthUser user = connection.user();
            if (ADMIN_ROLE.equals(user.role()) || user.userId() == event.ownerUserId()) send(id, signal);
        });
    }

    // 보내지 못한 연결은 목록에서 빼고 닫는다. 메시지 저장에는 영향이 없다.
    private void send(String sessionId, String payload) {
        Connection connection = connections.get(sessionId);
        if (connection == null) return;
        try {
            connection.session().sendMessage(new TextMessage(payload));
        } catch (IOException | RuntimeException e) {
            log.debug("채팅 신호 전송 실패, 연결을 정리합니다: userId={}", connection.user().userId());
            connections.remove(sessionId);
            try {
                connection.session().close();
            } catch (IOException | RuntimeException ignored) {
                // 이미 끊긴 연결이면 무시한다.
            }
        }
    }
}
