package com.baeksuescape.user.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.service.AuthService;
import com.baeksuescape.user.service.EmailVerificationService;

import jakarta.validation.Valid;

// FP-87 N-01~N-03 회원·인증 API (API 정의서 v0.2 AUTH-01~03, 06~10). 경로·필드는 프론트 authApi.js·authFeatureApi.js와 같다.
// 로그인·가입·이메일 인증·찾기는 인증 없이, 로그아웃·내 정보는 로그인한 상태로 부른다(SecurityConfig).
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerification;

    public AuthController(AuthService authService, EmailVerificationService emailVerification) {
        this.authService = authService;
        this.emailVerification = emailVerification;
    }

    // AUTH-01 N-01-1 로그인
    @PostMapping("/login")
    public AuthResponses.Login login(@Valid @RequestBody AuthRequests.Login request) {
        return authService.login(request);
    }

    // AUTH-02 N-01-4 로그아웃 — JWT는 서버에 상태가 없어 성공만 알린다. 토큰은 프론트가 지운다.
    @PostMapping("/logout")
    public Map<String, Object> logout() {
        return Map.of();
    }

    // AUTH-03 N-01-2 내 정보
    @GetMapping("/me")
    public AuthResponses.Me me(@AuthenticationPrincipal AuthUser user) {
        return authService.me(user.userId());
    }

    // AUTH-06 N-02-1·2·4 회원가입
    @PostMapping("/signup")
    public AuthResponses.Signup signup(@RequestBody AuthRequests.Signup request) {
        return authService.signup(request);
    }

    // AUTH-07 N-02-3 이메일 인증코드 발송
    @PostMapping("/email/send")
    public AuthResponses.EmailSent sendEmailCode(@Valid @RequestBody AuthRequests.EmailSend request) {
        return emailVerification.send(request);
    }

    // AUTH-08 N-02-3 이메일 인증코드 확인
    @PostMapping("/email/verify")
    public AuthResponses.EmailVerified verifyEmailCode(@Valid @RequestBody AuthRequests.EmailVerify request) {
        return emailVerification.verify(request);
    }

    // AUTH-09 N-03-1 아이디 찾기
    @PostMapping("/find-id")
    public AuthResponses.FoundId findId(@Valid @RequestBody AuthRequests.FindId request) {
        return authService.findId(request);
    }

    // AUTH-10 N-03-2·3 비밀번호 재설정
    @PostMapping("/password/reset")
    public Map<String, Object> resetPassword(@Valid @RequestBody AuthRequests.PasswordReset request) {
        authService.resetPassword(request);
        return Map.of();
    }
}
