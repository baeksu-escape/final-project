package com.baeksuescape.admin.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.service.AdminAuthService;
import com.baeksuescape.global.security.AuthUser;

// FP-80 로그인한 관리자 본인 — 재확인(step-up)과 내 비밀번호 변경(🟡 제안 경로, ROLE_ADMIN + ACCESS 토큰).
@RestController
@RequestMapping("/api/admin/me")
public class AdminMeController {

    // 재확인 토큰을 보내는 헤더
    public static final String STEP_UP_HEADER = "X-Step-Up-Token";

    private final AdminAuthService adminAuth;

    public AdminMeController(AdminAuthService adminAuth) {
        this.adminAuth = adminAuth;
    }

    // 업무 이메일로 6자리 번호(1분에 1번) → { expiresInSeconds, maskedEmail }
    @PostMapping("/step-up/send")
    public AdminDtos.StepUpSent sendStepUp(@AuthenticationPrincipal AuthUser user) {
        return adminAuth.sendStepUp(user.userId());
    }

    // { code } → { stepUpToken, expiresIn }(5분, 1회용)
    @PostMapping("/step-up/verify")
    public AdminDtos.StepUpToken verifyStepUp(@AuthenticationPrincipal AuthUser user, @RequestBody(required = false) AdminDtos.StepUpVerify request) {
        return adminAuth.verifyStepUp(user.userId(), request);
    }

    // { currentPassword, newPassword } + X-Step-Up-Token → {}
    @PutMapping("/password")
    public Map<String, Object> changePassword(@AuthenticationPrincipal AuthUser user, @RequestBody(required = false) AdminDtos.PasswordChange request,
            @RequestHeader(value = STEP_UP_HEADER, required = false) String stepUpToken) {
        adminAuth.changeMyPassword(user.userId(), request, stepUpToken);
        return Map.of();
    }
}
