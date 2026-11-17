package com.baeksuescape.assessment.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.service.ReportService;
import com.baeksuescape.global.security.AuthUser;

// FP-142 MEM-06 N-04-6 진단 내역 조회(목록). 경로·필드는 화면 diagnosisHistoryApi.js·mock과 같다(B팀 명세서 3-4).
@RestController
@RequestMapping("/api/members/me")
public class DiagnosisController {

    private final ReportService reportService;

    public DiagnosisController(ReportService reportService) {
        this.reportService = reportService;
    }

    // N-04-6 지난 평가 최신순 { items: [...] }. 점수를 아직 산출하지 않았으면 빈 목록
    @GetMapping("/diagnoses")
    public ReportDtos.DiagnosisList diagnoses(@AuthenticationPrincipal AuthUser user) {
        return reportService.diagnoses(user.userId());
    }
}
