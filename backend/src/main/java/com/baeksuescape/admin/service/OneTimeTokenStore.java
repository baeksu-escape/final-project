package com.baeksuescape.admin.service;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

// FP-80 관리자 짧은 토큰(2단계 인증 대기·첫 비밀번호 설정·재확인)의 1회 사용 확인 — 발급한 jti를 만료 시각과 함께 메모리에 둔다.
// 쓰면(consume) 목록에서 빠지므로 두 번째 사용은 거부된다. 서버가 재시작되면 목록이 비어 이미 낸 1회용 토큰은 모두 무효가 된다.
// TODO(2차) 서버가 여러 대이거나 재시작에도 유지해야 하면 DB·Redis로 옮긴다.
@Component
public class OneTimeTokenStore {

    // jti → 만료 시각과 묶인 값(2단계 인증 대기 토큰이면 VERIFICATION_ID, 그 밖에는 null)
    private record Entry(Instant expiresAt, Long reference) {
    }

    private final Map<String, Entry> issued = new ConcurrentHashMap<>();
    private final Clock clock;

    public OneTimeTokenStore(Clock clock) {
        this.clock = clock;
    }

    // 발급한 토큰을 등록한다. 등록할 때마다 만료된 항목을 지운다.
    public void register(String jti, Instant expiresAt, Long reference) {
        Instant now = clock.instant();
        issued.values().removeIf(entry -> !entry.expiresAt().isAfter(now));
        issued.put(jti, new Entry(expiresAt, reference));
    }

    // 아직 쓰지 않았고 만료되지 않았는지 본다(쓰지는 않는다). 묶인 값이 있으면 그 값, 없으면 0. 쓸 수 없으면 null.
    public Long peek(String jti) {
        Entry entry = issued.get(jti);
        if (entry == null || !entry.expiresAt().isAfter(clock.instant())) return null;
        return entry.reference() == null ? 0L : entry.reference();
    }

    // 한 번 쓴다. 처음 쓰는 유효한 토큰이면 true, 이미 썼거나 만료됐거나 모르는 토큰이면 false.
    public boolean consume(String jti) {
        Entry entry = issued.remove(jti);
        return entry != null && entry.expiresAt().isAfter(clock.instant());
    }
}
