package com.baeksuescape.assessment.controller;

import com.baeksuescape.assessment.dto.ScorePercentileResponse;
import com.baeksuescape.assessment.service.ScorePercentileService;
import com.baeksuescape.global.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * FP-251 N-13 비교 분석 '내 위치' API (팀 공통 규칙: 내 데이터는 /api/members/me/**).
 * 로그인 확인은 보안 설정이 먼저 한다(ROLE_USER만, 토큰 없음 401·관리자 403). 회원은 토큰에서만 꺼낸다.
 */
@RestController
@RequestMapping("/api/members/me")
@RequiredArgsConstructor
public class ScorePercentileController {

    private final ScorePercentileService scorePercentileService;

    /** N-13-1~3 RPT-05 같은 직군·연령대·직군+연령대 안에서 내 대안 점수의 상위 n%와 평균 대비 차이. */
    @GetMapping("/score-percentile")
    public ResponseEntity<ScorePercentileResponse> getScorePercentile(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(scorePercentileService.percentile(user.userId()));
    }
}
