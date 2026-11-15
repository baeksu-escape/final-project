package com.baeksuescape.admin.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.service.AdminLogQueryService;

// FP-80 N-28-2 로그 조회(ADM-09·10). 조회만 있고 수정·삭제 API는 만들지 않는다(DDL: 수정·삭제 금지).
@RestController
@RequestMapping("/api/admin")
public class AdminLogController {

    private final AdminLogQueryService logs;

    public AdminLogController(AdminLogQueryService logs) {
        this.logs = logs;
    }

    // ADM-09 열람 감사 로그(최신순)
    @GetMapping("/access-logs")
    public AdminDtos.PageResponse<AdminDtos.AccessLogRow> accessLogs(@RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return logs.accessLogs(page, size);
    }

    // ADM-10 시스템 로그(최신순, type 필터)
    @GetMapping("/system-logs")
    public AdminDtos.PageResponse<AdminDtos.SystemLogRow> systemLogs(@RequestParam(required = false) String type,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return logs.systemLogs(type, page, size);
    }
}
