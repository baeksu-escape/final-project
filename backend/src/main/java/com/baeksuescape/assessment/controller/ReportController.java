package com.baeksuescape.assessment.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.service.ReportService;
import com.baeksuescape.global.security.AuthUser;

// FP-142 RPT-02 N-12 나의 신용 리포트·N-14 영역별 영향도, RPT-03 N-04-6 진단 내역 상세 (B팀 명세서 3-2·3-3).
@RestController
@RequestMapping("/api/report")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    // RPT-02 내 최신 평가. 없으면 404 ASSESSMENT_NOT_FOUND
    @GetMapping("/me")
    public ReportDtos.Report latest(@AuthenticationPrincipal AuthUser user) {
        return reportService.latest(user.userId());
    }

    // RPT-03 진단 내역에서 고른 평가(diagnosisId = requestId). 남의 평가·없는 평가는 404
    @GetMapping("/{requestId}")
    public ReportDtos.Report byRequestId(@AuthenticationPrincipal AuthUser user, @PathVariable String requestId) {
        return reportService.byRequestId(user.userId(), requestId);
    }
}
