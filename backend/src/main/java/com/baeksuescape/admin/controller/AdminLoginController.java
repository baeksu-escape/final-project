package com.baeksuescape.admin.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.service.AdminAuthService;

// FP-80 N-01-1 관리자 로그인 2단계 인증 — 인증 없이 부른다(짧은 1회용 토큰을 본문으로 받는다). AUTH-01 관리자 응답에서 이어진다.
@RestController
@RequestMapping("/api/auth/admin")
public class AdminLoginController {

    private final AdminAuthService adminAuth;

    public AdminLoginController(AdminAuthService adminAuth) {
        this.adminAuth = adminAuth;
    }

    // AUTH-11 { challengeToken, code } → { token, user, passwordChangeRequired: false } 또는 { passwordChangeRequired: true, passwordSetupToken }
    @PostMapping("/verify-code")
    public AdminDtos.AdminLogin verifyCode(@RequestBody(required = false) AdminDtos.VerifyCode request) {
        return adminAuth.verifyLogin(request);
    }

    // 🟡 첫 로그인 비밀번호 설정 { passwordSetupToken, newPassword } → { token, user }
    @PostMapping("/password-setup")
    public AdminDtos.AdminLogin passwordSetup(@RequestBody(required = false) AdminDtos.PasswordSetup request) {
        return adminAuth.setupPassword(request);
    }
}
