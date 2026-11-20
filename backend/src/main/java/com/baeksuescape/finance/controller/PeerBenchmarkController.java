package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse;
import com.baeksuescape.finance.service.PeerBenchmarkService;
import com.baeksuescape.global.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * FP-160 N-15 동년배·같은 직군 비교 API (팀 공통 규칙: 내 데이터는 /api/members/me/**).
 * 로그인 확인은 보안 설정이 먼저 한다(ROLE_USER만, 토큰 없음 401·관리자 403). 회원은 토큰에서만 꺼낸다.
 */
@RestController
@RequestMapping("/api/members/me")
@RequiredArgsConstructor
public class PeerBenchmarkController {

    private final PeerBenchmarkService peerBenchmarkService;

    /** N-15-2 DIAG-01 내 직군·연령대와 같은 직군·같은 연령대 회원 평균(연소득·총자산·총부채). */
    @GetMapping("/peer-benchmark")
    public ResponseEntity<PeerBenchmarkResponse> getPeerBenchmark(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(peerBenchmarkService.benchmark(user.userId()));
    }
}
