package com.baeksuescape.user.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.service.AltDataImportService;

// FP-85 N-05-6 대안 데이터 모의 연동 불러오기 API(API 정의서 v0.2 INP-03).
// source: easypay, telecom, national-pension, health-insurance, utility(프론트 altDataSources.js apiSegment).
@RestController
@RequestMapping("/api/members/me/alt-data")
public class AltDataController {

    private final AltDataImportService altDataImportService;

    public AltDataController(AltDataImportService altDataImportService) {
        this.altDataImportService = altDataImportService;
    }

    // INP-03 { baseMonth, consentId } → { source, importedAt, rows, consentId, notice? }
    @PostMapping("/{source}/import")
    public DataInputDtos.AltDataImportResponse importData(@AuthenticationPrincipal AuthUser user, @PathVariable String source,
            @RequestBody DataInputDtos.AltDataImportRequest request) {
        return altDataImportService.importData(user.userId(), source, request);
    }
}
