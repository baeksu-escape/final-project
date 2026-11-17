package com.baeksuescape.assessment.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.assessment.dto.ScoreDtos;
import com.baeksuescape.assessment.service.ScoreCalculationService;
import com.baeksuescape.global.security.AuthUser;

// FP-142 RPT-01 N-12-2 기존·대안 점수·3등급 계산·저장. 경로·필드는 화면 dataInputApi.js와 같다(B팀 명세서 3-1).
@RestController
@RequestMapping("/api/members/me")
public class ScoreController {

    private final ScoreCalculationService scoreCalculationService;

    public ScoreController(ScoreCalculationService scoreCalculationService) {
        this.scoreCalculationService = scoreCalculationService;
    }

    // N-12-2 [점수 산출하기] — 입력·동의가 덜 차면 409 INPUT_INCOMPLETE, 산출 결과(SCORED·NOT_SCORABLE)는 200
    @PostMapping("/score-calculation")
    public ScoreDtos.ScoreResponse calculate(@AuthenticationPrincipal AuthUser user,
            @RequestBody(required = false) ScoreDtos.ScoreRequest request) {
        return scoreCalculationService.calculate(user.userId(), request == null ? null : request.requestId());
    }
}
