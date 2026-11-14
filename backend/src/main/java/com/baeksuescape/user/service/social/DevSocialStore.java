package com.baeksuescape.user.service.social;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

// FP-87 N-01-6 간편 로그인 임시 값 보관 — 일회용 코드(5분)와 연결 키(10분)를 서버 메모리에만 둔다.
// 서버를 다시 켜면 사라지고, 서버가 여러 대면 공유되지 않는다(시연·개발용 DEV 모드 범위).
@Component
public class DevSocialStore {

    static final Duration CODE_LIFETIME = Duration.ofMinutes(5);
    static final Duration LINK_KEY_LIFETIME = Duration.ofMinutes(10);

    // 아직 계정에 연결되지 않은 제공자 사용자. 기존 계정 연결(AUTH-05)이나 가입(AUTH-06 socialLinkKey)에서 쓴다.
    public record PendingLink(String providerCode, String providerUserId) {
    }

    private record Entry<T>(T value, Instant expiresAt) {
    }

    private final Map<String, Entry<SocialProvider>> codes = new ConcurrentHashMap<>();
    private final Map<String, Entry<PendingLink>> linkKeys = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final Clock clock;

    public DevSocialStore(Clock clock) {
        this.clock = clock;
    }

    // 시작 주소에서 콜백으로 넘길 일회용 코드.
    public String issueCode(SocialProvider provider) {
        String code = randomKey();
        codes.put(code, new Entry<>(provider, clock.instant().plus(CODE_LIFETIME)));
        return code;
    }

    // 코드를 꺼내고 바로 지운다(한 번만 사용). 없거나 만료면 빈 값.
    public Optional<SocialProvider> takeCode(String code) {
        if (code == null) return Optional.empty();
        Entry<SocialProvider> entry = codes.remove(code);
        return entry != null && entry.expiresAt().isAfter(clock.instant()) ? Optional.of(entry.value()) : Optional.empty();
    }

    public String issueLinkKey(PendingLink link) {
        String key = randomKey();
        linkKeys.put(key, new Entry<>(link, clock.instant().plus(LINK_KEY_LIFETIME)));
        return key;
    }

    // 연결 키를 확인만 한다(연결·가입이 성공했을 때 removeLinkKey로 지운다). 없거나 만료면 빈 값.
    public Optional<PendingLink> findLinkKey(String key) {
        if (key == null) return Optional.empty();
        Entry<PendingLink> entry = linkKeys.get(key);
        if (entry == null) return Optional.empty();
        if (!entry.expiresAt().isAfter(clock.instant())) {
            linkKeys.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    public void removeLinkKey(String key) {
        if (key != null) linkKeys.remove(key);
    }

    private String randomKey() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
