package com.baeksuescape.global.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;

// FP-87 JwtTokenProvider — 발급한 토큰을 검증해 USER_ID·역할을 꺼내고, 만료·다른 키·깨진 토큰은 거부한다.
class JwtTokenProviderTest {

    private static final Instant NOW = Instant.parse("2026-11-14T03:00:00Z");

    private JwtTokenProvider providerAt(Instant instant, AvenueProperties properties) {
        return new JwtTokenProvider(properties, Clock.fixed(instant, ZoneOffset.UTC));
    }

    @Test
    void 발급한_토큰에서_사용자를_꺼낸다() {
        JwtTokenProvider provider = providerAt(NOW, TestKeys.properties());
        String token = provider.issue(42L, "ROLE_USER");
        assertThat(provider.parse(token)).contains(new AuthUser(42L, "ROLE_USER"));
        assertThat(provider.lifetimeSeconds()).isEqualTo(3600);
    }

    @Test
    void 만료된_토큰은_거부한다() {
        String token = providerAt(NOW, TestKeys.properties()).issue(42L, "ROLE_USER");
        assertThat(providerAt(NOW.plus(Duration.ofMinutes(59)), TestKeys.properties()).parse(token)).isPresent();
        assertThat(providerAt(NOW.plus(Duration.ofMinutes(61)), TestKeys.properties()).parse(token)).isEmpty();
    }

    @Test
    void 다른_키로_서명한_토큰과_깨진_토큰은_거부한다() {
        AvenueProperties other = TestKeys.properties();
        other.getAuth().getJwt().setSecret(TestKeys.b64(TestKeys.HMAC));
        String foreign = providerAt(NOW, other).issue(42L, "ROLE_ADMIN");
        JwtTokenProvider provider = providerAt(NOW, TestKeys.properties());
        assertThat(provider.parse(foreign)).isEmpty();
        assertThat(provider.parse("not-a-token")).isEmpty();
        assertThat(provider.parse("")).isEmpty();
    }
}
