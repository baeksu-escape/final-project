package com.baeksuescape.community.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.service.ReportService;
import com.baeksuescape.global.security.AuthUser;

import jakarta.validation.Valid;

// FP-193 N-33 글·댓글 신고 API (API 정의서 v0.2 COMM-07). 로그인한 사용자만 신고할 수 있다.
@RestController
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    // COMM-07 N-33-1 신고 접수, N-33-2 기준 건수 자동 숨김
    @PostMapping("/api/reports")
    public ReportDtos.ReportCreated submit(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ReportDtos.ReportCreate request) {
        return reportService.submit(user.userId(), request);
    }
}
