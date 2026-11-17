package com.baeksuescape.global.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

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
    private static final String SCOPE_CLAIM = "scope";

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

    // 로그인 성공 때 액세스 토큰을 만든다. scope=ACCESS(FP-80: 관리자 2단계 인증용 짧은 토큰과 구분한다).
    public String issue(long userId, String role) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(ROLE_CLAIM, role)
                .claim(SCOPE_CLAIM, TokenScope.ACCESS.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(lifetime)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    // 토큰을 검증해 사용자를 꺼낸다. 서명이 틀리거나 만료됐거나 모양이 이상하면 빈 값을 돌려준다.
    // FP-80 scope가 ACCESS인 토큰만 받는다. 관리자 2단계 인증·재확인 토큰(다른 scope)으로는 /api/**에 로그인한 것으로 보지 않는다(401).
    public Optional<AuthUser> parse(String token) {
        return claims(token).flatMap(claims -> {
            String role = claims.get(ROLE_CLAIM, String.class);
            if (role == null || !TokenScope.ACCESS.name().equals(claims.get(SCOPE_CLAIM, String.class))) return Optional.empty();
            return Optional.of(new AuthUser(Long.parseLong(claims.getSubject()), role));
        });
    }

    // FP-80 짧은 1회용 토큰(관리자 2단계 인증 대기·첫 비밀번호 설정·재확인)을 만든다. jti로 1회 사용을 확인한다(OneTimeTokenStore).
    public ScopedToken issueScoped(long userId, String role, TokenScope scope, Duration ttl) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(ttl);
        String jti = UUID.randomUUID().toString();
        String token = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(ROLE_CLAIM, role)
                .claim(SCOPE_CLAIM, scope.name())
                .id(jti)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        return new ScopedToken(token, jti, expiresAt);
    }

    // FP-80 짧은 토큰을 검증한다. 서명·만료가 맞고 scope가 기대한 값이어야 한다. 아니면 빈 값.
    public Optional<ScopedClaims> parseScoped(String token, TokenScope expected) {
        if (token == null || token.isBlank()) return Optional.empty();
        return claims(token.trim()).flatMap(claims -> {
            if (!expected.name().equals(claims.get(SCOPE_CLAIM, String.class)) || claims.getId() == null) return Optional.empty();
            return Optional.of(new ScopedClaims(Long.parseLong(claims.getSubject()), claims.getId(), claims.getExpiration().toInstant()));
        });
    }

    // 짧은 토큰 발급 결과.
    public record ScopedToken(String token, String jti, Instant expiresAt) {
    }

    // 짧은 토큰에서 꺼낸 값.
    public record ScopedClaims(long userId, String jti, Instant expiresAt) {
    }

    private Optional<Claims> claims(String token) {
        try {
            return Optional.of(Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    // FP-93 토큰 발급 시각(iat). 간편 로그인 전용 계정 탈퇴의 "최근 로그인" 확인에 쓴다. 검증에 실패하거나 iat가 없으면 빈 값.
    public Optional<Instant> issuedAt(String token) {
        return claims(token).map(Claims::getIssuedAt).map(Date::toInstant);
    }

    // 토큰 유효 시간(초). 로그인 응답에 함께 줄 때 쓴다.
    public long lifetimeSeconds() {
        return lifetime.toSeconds();
    }
}
