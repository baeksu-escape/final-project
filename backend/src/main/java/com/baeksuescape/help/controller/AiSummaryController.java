package com.baeksuescape.help.controller;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.help.dto.AiSummaryResponse;
import com.baeksuescape.help.service.AiSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * N-31-2 RPT-04 AI 요약 생성·저장 (FP-181, 담당 광희). 경로는 리포트(/api/report/**, ROLE_USER)지만
 * 범영 님 ReportController를 고치지 않으려고 help 패키지에 따로 둔다.
 */
@RestController
@RequiredArgsConstructor
public class AiSummaryController {

    private final AiSummaryService aiSummaryService;

    /** 저장된 요약이 있으면 그대로, 없으면 AI로 만들어 저장한 뒤 돌려준다 */
    @PostMapping("/api/report/{requestId}/ai-summary")
    public ResponseEntity<AiSummaryResponse> summarize(@AuthenticationPrincipal AuthUser user, @PathVariable String requestId) {
        return ResponseEntity.ok(aiSummaryService.summarize(user.userId(), requestId));
    }
}
