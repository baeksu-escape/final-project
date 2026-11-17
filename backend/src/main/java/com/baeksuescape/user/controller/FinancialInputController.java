package com.baeksuescape.user.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.service.FinancialInputService;

// FP-85·FP-86 N-05 데이터 입력 API(API 정의서 v0.2 INP-01·02). 경로·필드는 프론트 dataInputApi.js와 같다.
@RestController
@RequestMapping("/api/members/me")
public class FinancialInputController {

    private final FinancialInputService financialInputService;

    public FinancialInputController(FinancialInputService financialInputService) {
        this.financialInputService = financialInputService;
    }

    // INP-01 N-05-8 저장된 입력·입력 완료 현황·불러온 대안 데이터
    @GetMapping("/financial-input")
    public DataInputDtos.FinancialInputResponse load(@AuthenticationPrincipal AuthUser user) {
        return financialInputService.load(user.userId());
    }

    // INP-02 N-05-2~5·N-05-7 입력 검사·저장(기준월별, D-16)
    @PutMapping("/financial-input")
    public DataInputDtos.SaveResponse save(@AuthenticationPrincipal AuthUser user, @RequestBody DataInputDtos.FinancialInput request) {
        return financialInputService.save(user.userId(), request);
    }
}
