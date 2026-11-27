package com.baeksuescape.chat.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.baeksuescape.chat.dto.ChatMessageSavedEvent;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-287 N-07-6 웹소켓 — 실제 포트로 연결해 첫 메시지 인증, 커밋 뒤 신호 전달 대상, 허용하지 않은 출처 거절을 본다.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChatWebSocketTest {

    private static final String AUTH_OK = "{\"type\":\"AUTH_OK\"}";
    private static final String SIGNAL = "{\"type\":\"MESSAGE\",\"roomId\":3}";

    @LocalServerPort
    private int port;
    @Autowired
    private JwtTokenProvider tokenProvider;
    @Autowired
    private ApplicationEventPublisher publisher;
    @Autowired
    private PlatformTransactionManager transactionManager;
    @MockBean
    private UserAccountMapper userAccountMapper;

    private final List<WebSocketSession> opened = new ArrayList<>();

    // 받은 글과 닫힌 이유를 모아 두는 시험용 화면
    private static final class Client extends TextWebSocketHandler {
        final BlockingQueue<String> received = new LinkedBlockingQueue<>();
        final CompletableFuture<CloseStatus> closed = new CompletableFuture<>();
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession s, TextMessage message) {
            received.add(message.getPayload());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession s, CloseStatus status) {
            closed.complete(status);
        }

        String next() throws InterruptedException {
            return received.poll(5, TimeUnit.SECONDS);
        }
    }

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    @AfterEach
    void closeAll() throws Exception {
        for (WebSocketSession session : opened) session.close();
    }

    private Client connect(String origin) throws Exception {
        Client client = new Client();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        if (origin != null) headers.setOrigin(origin);
        client.session = new StandardWebSocketClient()
                .execute(client, headers, URI.create("ws://localhost:" + port + "/ws/chat")).get(5, TimeUnit.SECONDS);
        opened.add(client.session);
        return client;
    }

    private Client login(long userId, String role) throws Exception {
        Client client = connect(null);
        client.session.sendMessage(new TextMessage(
                "{\"type\":\"AUTH\",\"token\":\"" + tokenProvider.issue(userId, role) + "\"}"));
        assertEquals(AUTH_OK, client.next());
        return client;
    }

    @Test
    void 커밋_뒤_방_주인과_관리자만_신호를_받는다() throws Exception {
        Client owner = login(7L, "ROLE_USER");
        Client other = login(8L, "ROLE_USER");
        Client admin = login(1L, "ROLE_ADMIN");

        new TransactionTemplate(transactionManager)
                .executeWithoutResult(status -> publisher.publishEvent(new ChatMessageSavedEvent(3L, 7L)));

        assertEquals(SIGNAL, owner.next());
        assertEquals(SIGNAL, admin.next());
        assertNull(other.received.poll(500, TimeUnit.MILLISECONDS));
    }

    @Test
    void 되돌린_저장은_알리지_않는다() throws Exception {
        Client owner = login(7L, "ROLE_USER");

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            publisher.publishEvent(new ChatMessageSavedEvent(3L, 7L));
            status.setRollbackOnly();
        });

        assertNull(owner.received.poll(500, TimeUnit.MILLISECONDS));
    }

    @Test
    void 잘못된_토큰이면_닫는다() throws Exception {
        Client client = connect(null);

        client.session.sendMessage(new TextMessage("{\"type\":\"AUTH\",\"token\":\"wrong\"}"));

        assertEquals(4401, client.closed.get(5, TimeUnit.SECONDS).getCode());
    }

    @Test
    void 잠긴_계정은_닫는다() throws Exception {
        given(userAccountMapper.selectAccountStatus(7L)).willReturn("LOCKED");
        Client client = connect(null);

        client.session.sendMessage(new TextMessage(
                "{\"type\":\"AUTH\",\"token\":\"" + tokenProvider.issue(7L, "ROLE_USER") + "\"}"));

        assertEquals(4401, client.closed.get(5, TimeUnit.SECONDS).getCode());
    }

    @Test
    void JSON이_아닌_첫_메시지는_닫는다() throws Exception {
        Client client = connect(null);

        client.session.sendMessage(new TextMessage("hello"));

        assertNotNull(client.closed.get(5, TimeUnit.SECONDS));
    }

    @Test
    void 허용하지_않은_출처는_연결할_수_없다() {
        assertThrows(ExecutionException.class, () -> connect("http://evil.example.com"));
    }
}
