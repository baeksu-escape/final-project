package com.baeksuescape.admin.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.admin.dto.AdminStatsDtos;
import com.baeksuescape.admin.service.AdminStatsService;

// FP-161 N-26-1~4 관리자 직군·연령별 통계(ADM-03). 관리자만(보안 설정: /api/admin/** = ROLE_ADMIN), 조회만 있다.
@RestController
@RequestMapping("/api/admin")
public class AdminStatsController {

    private final AdminStatsService stats;

    public AdminStatsController(AdminStatsService stats) {
        this.stats = stats;
    }

    // ADM-03 groupBy = WORKER_TYPE(직군별, 기본)·AGE_BAND(연령대별)
    @GetMapping("/stats")
    public AdminStatsDtos.StatsResponse stats(@RequestParam(required = false) String groupBy) {
        return stats.stats(groupBy);
    }
}
