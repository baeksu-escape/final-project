package com.baeksuescape.chat.websocket;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;

// FP-287 N-07-6 웹소켓 /ws/chat. 브라우저 웹소켓은 Authorization 헤더를 붙일 수 없어, 연결한 뒤 첫 메시지
// {"type":"AUTH","token":"..."}로 로그인을 확인한다(주소에 토큰을 넣으면 로그에 남을 수 있다).
// 화면이 보내는 것은 이 인증 메시지뿐이고, 채팅 글은 REST API로 보낸다.
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    // 인증에 실패하면 이 코드로 닫는다. 화면은 이 코드를 받으면 다시 연결하지 않는다.
    static final CloseStatus AUTH_FAILED = new CloseStatus(4401, "AUTH_FAILED");
    // 연결만 하고 이 시간 안에 인증하지 않으면 닫는다.
    static final Duration AUTH_TIMEOUT = Duration.ofSeconds(10);
    private static final int TEXT_MESSAGE_LIMIT = 4 * 1024;

    private final ChatSessionRegistry registry;
    private final JwtTokenProvider tokenProvider;
    private final UserAccountMapper userAccountMapper;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService timeoutExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "chat-auth-timeout");
        thread.setDaemon(true);
        return thread;
    });

    public ChatWebSocketHandler(ChatSessionRegistry registry, JwtTokenProvider tokenProvider,
            UserAccountMapper userAccountMapper, ObjectMapper objectMapper) {
        this.registry = registry;
        this.tokenProvider = tokenProvider;
        this.userAccountMapper = userAccountMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        session.setTextMessageSizeLimit(TEXT_MESSAGE_LIMIT);
        timeoutExecutor.schedule(() -> {
            if (session.isOpen() && !registry.isRegistered(session)) close(session, CloseStatus.SESSION_NOT_RELIABLE);
        }, AUTH_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    // 첫 메시지로 인증한다. 인증을 마친 뒤에 오는 메시지는 쓰지 않는다.
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        if (registry.isRegistered(session)) return;
        Optional<AuthUser> user = authenticate(message.getPayload());
        if (user.isPresent()) registry.register(user.get(), session);
        else close(session, AUTH_FAILED);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        registry.remove(session);
    }

    @PreDestroy
    void stop() {
        timeoutExecutor.shutdownNow();
    }

    // JwtAuthenticationFilter와 같은 기준: 유효한 ACCESS 토큰이고 계정이 사용 중(탈퇴·잠금이 아님)이어야 한다.
    private Optional<AuthUser> authenticate(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            if (node == null || !"AUTH".equals(node.path("type").asText())) return Optional.empty();
            return tokenProvider.parse(node.path("token").asText()).filter(user -> {
                String status = userAccountMapper.selectAccountStatus(user.userId());
                return status != null && !"WITHDRAWN".equals(status) && !"LOCKED".equals(status);
            });
        } catch (JsonProcessingException e) {
            return Optional.empty();
        }
    }

    private void close(WebSocketSession session, CloseStatus status) {
        try {
            session.close(status);
        } catch (IOException ignored) {
            // 이미 끊긴 연결이면 무시한다.
        }
    }
}
