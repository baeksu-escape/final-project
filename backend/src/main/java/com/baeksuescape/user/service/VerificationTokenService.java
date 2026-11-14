package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import com.baeksuescape.global.config.AvenueProperties;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

// FP-87 N-02-3 이메일 인증 토큰 — 코드 확인에 성공하면 주는 짧은 토큰(10분). 어떤 발송 이력(verificationId)·목적·대상(이메일 HMAC)인지 묶는다.
// 접근 토큰과 같은 키로 서명하지만 typ 클레임이 다르고 role이 없어서 서로 대신 쓸 수 없다. 한 번만 쓰는 것은 VERIFICATION_CODE로 막는다.
@Component
public class VerificationTokenService {

    public static final Duration LIFETIME = Duration.ofMinutes(10);
    private static final String TYPE = "email-verification";

    // 토큰에서 꺼낸 값.
    public record Claim(long verificationId, String purposeCode, String targetHmac) {
    }

    private final SecretKey key;
    private final Clock clock;

    public VerificationTokenService(AvenueProperties properties, Clock clock) {
        this.key = Keys.hmacShaKeyFor(properties.jwtSecretBytes());
        this.clock = clock;
    }

    public String issue(long verificationId, String purposeCode, String targetHmac) {
        Instant now = clock.instant();
        return Jwts.builder()
                .claim("typ", TYPE)
                .claim("vid", verificationId)
                .claim("purpose", purposeCode)
                .claim("target", targetHmac)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(LIFETIME)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    // 서명·만료·종류가 맞으면 값을 꺼낸다. 아니면 빈 값.
    public Optional<Claim> parse(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            if (!TYPE.equals(claims.get("typ", String.class))) return Optional.empty();
            Number vid = claims.get("vid", Number.class);
            String purpose = claims.get("purpose", String.class);
            String target = claims.get("target", String.class);
            if (vid == null || purpose == null || target == null) return Optional.empty();
            return Optional.of(new Claim(vid.longValue(), purpose, target));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
