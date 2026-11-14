package com.baeksuescape.global.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.config.AvenueProperties;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

// FP-87 JWT 발급·검증 — subject는 USER_ID, role 클레임은 ROLE_USER·ROLE_ADMIN, HS256 서명. 유효 시간은 avenue.auth.jwt.expires-minutes.
@Component
public class JwtTokenProvider {

    private static final String ROLE_CLAIM = "role";

    private final SecretKey key;
    private final Duration lifetime;
    private final Clock clock;

    @Autowired
    public JwtTokenProvider(AvenueProperties properties) {
        this(properties, Clock.systemUTC());
    }

    // 테스트에서 시각을 바꿔 만료를 확인할 때 쓴다.
    JwtTokenProvider(AvenueProperties properties, Clock clock) {
        this.key = Keys.hmacShaKeyFor(properties.jwtSecretBytes());
        this.lifetime = Duration.ofMinutes(properties.getAuth().getJwt().getExpiresMinutes());
        this.clock = clock;
    }

    // 로그인 성공 때 액세스 토큰을 만든다.
    public String issue(long userId, String role) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(ROLE_CLAIM, role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(lifetime)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    // 토큰을 검증해 사용자를 꺼낸다. 서명이 틀리거나 만료됐거나 모양이 이상하면 빈 값을 돌려준다.
    public Optional<AuthUser> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String role = claims.get(ROLE_CLAIM, String.class);
            if (role == null) return Optional.empty();
            return Optional.of(new AuthUser(Long.parseLong(claims.getSubject()), role));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    // 토큰 유효 시간(초). 로그인 응답에 함께 줄 때 쓴다.
    public long lifetimeSeconds() {
        return lifetime.toSeconds();
    }
}
