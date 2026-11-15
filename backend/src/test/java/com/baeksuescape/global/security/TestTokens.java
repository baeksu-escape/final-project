package com.baeksuescape.global.security;

import java.time.Clock;

import com.baeksuescape.global.config.AvenueProperties;

// 테스트용 — 다른 패키지의 테스트가 시각을 정한 JwtTokenProvider를 만들 때 쓴다(생성자가 패키지 전용이라).
public final class TestTokens {

    private TestTokens() {
    }

    public static JwtTokenProvider provider(AvenueProperties properties, Clock clock) {
        return new JwtTokenProvider(properties, clock);
    }
}
