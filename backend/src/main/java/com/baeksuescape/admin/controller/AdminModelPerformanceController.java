package com.baeksuescape.admin.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.admin.dto.ModelPerformanceDtos;
import com.baeksuescape.admin.service.ModelPerformanceService;

// N-25 모형 성능 비교 (ADM-01·02, FP-184). /api/admin/**라 관리자(ROLE_ADMIN)만 부른다.
// 평가 표본은 합성 학습 고객(회원 아님)이라 회원 신용정보 열람 감사 로그(N-35) 대상이 아니다.
@RestController
@RequestMapping("/api/admin/model-performance")
public class AdminModelPerformanceController {

    private final ModelPerformanceService service;

    public AdminModelPerformanceController(ModelPerformanceService service) {
        this.service = service;
    }

    // N-25-1·2·4 ADM-01 컷오프 기준 지표 비교·직군별 오거절률
    @GetMapping
    public ModelPerformanceDtos.PerformanceView performance(@RequestParam(defaultValue = "LEGACY") String group,
            @RequestParam(defaultValue = "DELINQ") String label, @RequestParam(defaultValue = "700") int cutoff) {
        return service.performance(group, label, cutoff);
    }

    // N-25-3 ADM-02 ROC 곡선
    @GetMapping("/roc")
    public ModelPerformanceDtos.RocView roc(@RequestParam(defaultValue = "LEGACY") String group,
            @RequestParam(defaultValue = "DELINQ") String label) {
        return service.roc(group, label);
    }
}
