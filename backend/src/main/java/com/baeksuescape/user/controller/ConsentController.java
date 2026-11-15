package com.baeksuescape.user.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.service.ConsentService;

// FP-85 N-05-9 정보 제공 동의 API(API 정의서 v0.2 INP-04~06, 🟡 제안 경로 — 이 경로로 확정 요청). 경로는 프론트 dataInputApi.js와 같다.
@RestController
@RequestMapping("/api/members/me/consents")
public class ConsentController {

    private final ConsentService consentService;

    public ConsentController(ConsentService consentService) {
        this.consentService = consentService;
    }

    // INP-04 내 정보 제공 동의 목록
    @GetMapping
    public DataInputDtos.ConsentList list(@AuthenticationPrincipal AuthUser user) {
        return consentService.list(user.userId());
    }

    // INP-05 항목별 동의
    @PostMapping
    public DataInputDtos.ConsentAgreed agree(@AuthenticationPrincipal AuthUser user, @RequestBody DataInputDtos.ConsentAgree request) {
        return consentService.agree(user.userId(), request);
    }

    // INP-06 동의 철회([연결 해제]) — 그 동의로 불러온 데이터도 지운다.
    @DeleteMapping("/{consentId}")
    public DataInputDtos.ConsentWithdrawn withdraw(@AuthenticationPrincipal AuthUser user, @PathVariable long consentId) {
        return consentService.withdraw(user.userId(), consentId);
    }
}
