package com.baeksuescape.chat.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.baeksuescape.global.config.AvenueProperties;

// FP-287 N-07-6 웹소켓 경로 등록. /api 밖의 경로라 SecurityConfig가 막지 않으며, 로그인은 ChatWebSocketHandler가 확인한다.
// 접속을 허용하는 출처는 CORS 설정(avenue.cors.allowed-origins)과 같다.
@Configuration
@EnableWebSocket
public class ChatWebSocketConfig implements WebSocketConfigurer {

    static final String PATH = "/ws/chat";

    private final ChatWebSocketHandler handler;
    private final AvenueProperties properties;

    public ChatWebSocketConfig(ChatWebSocketHandler handler, AvenueProperties properties) {
        this.handler = handler;
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, PATH)
                .setAllowedOrigins(properties.getCors().getAllowedOrigins().toArray(String[]::new));
    }
}
