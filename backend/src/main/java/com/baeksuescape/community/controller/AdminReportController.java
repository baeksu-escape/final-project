package com.baeksuescape.community.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.service.AdminReportService;
import com.baeksuescape.global.security.AuthUser;

import jakarta.validation.Valid;

// FP-193 N-34 신고 접수 게시판 API (API 정의서 v0.2 ADM-11~13). /api/admin/**라 관리자(ROLE_ADMIN)만 부른다.
// 자동 숨김 기준(건) 조회·변경은 ADM-14 /api/admin/settings가 맡는다.
@RestController
@RequestMapping("/api/admin/reports")
public class AdminReportController {

    private final AdminReportService adminReportService;

    public AdminReportController(AdminReportService adminReportService) {
        this.adminReportService = adminReportService;
    }

    // ADM-11 N-34-1 신고 목록 (status·reason·기간 필터는 모두 선택, 날짜는 YYYY-MM-DD)
    @GetMapping
    public ReportDtos.ReportList list(@RequestParam(required = false) String status, @RequestParam(required = false) String reason,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return adminReportService.list(status, reason, from, to);
    }

    // ADM-12 N-34-2 신고 상세
    @GetMapping("/{reportId}")
    public ReportDtos.ReportDetail detail(@PathVariable long reportId) {
        return adminReportService.detail(reportId);
    }

    // ADM-13 N-34-3 처리 결과 저장 (같은 대상의 미처리 신고를 함께 처리)
    @PatchMapping("/{reportId}")
    public ReportDtos.ReportProcessed process(@AuthenticationPrincipal AuthUser admin, @PathVariable long reportId,
            @Valid @RequestBody ReportDtos.ReportProcess request) {
        return adminReportService.process(admin.userId(), reportId, request);
    }
}
