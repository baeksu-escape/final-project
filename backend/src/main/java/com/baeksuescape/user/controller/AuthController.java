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
import com.baeksuescape.user.service.PhoneVerificationService;

import jakarta.validation.Valid;

// FP-87 N-01~N-03 회원·인증 API (API 정의서 v0.2 AUTH-01~03, 06~10). 경로·필드는 프론트 authApi.js·authFeatureApi.js와 같다.
// 로그인·가입·이메일 인증·찾기는 인증 없이, 로그아웃·내 정보는 로그인한 상태로 부른다(SecurityConfig).
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerification;
    private final PhoneVerificationService phoneVerification;

    public AuthController(AuthService authService, EmailVerificationService emailVerification, PhoneVerificationService phoneVerification) {
        this.authService = authService;
        this.emailVerification = emailVerification;
        this.phoneVerification = phoneVerification;
    }

    // AUTH-01 N-01-1 로그인. 일반 사용자는 { accessToken, user }, 관리자는 { twoFactorRequired, challengeToken, maskedEmail }(FP-80).
    @PostMapping("/login")
    public AuthResponses.LoginResult login(@Valid @RequestBody AuthRequests.Login request) {
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

    // N-02-1 닉네임 중복 확인(11/18 1차 시연 후속) — { nickname } → { available }. 닉네임을 주소에 남기지 않으려고 POST로 받는다.
    @PostMapping("/nickname/check")
    public AuthResponses.NicknameAvailability checkNickname(@RequestBody AuthRequests.NicknameCheck request) {
        return authService.checkNickname(request);
    }

    // N-02 휴대폰 인증번호 발송(11/18 1차 시연 후속) — { phone, purpose } → { expiresInSeconds }
    @PostMapping("/phone/send")
    public AuthResponses.PhoneSent sendPhoneCode(@Valid @RequestBody AuthRequests.PhoneSend request) {
        return phoneVerification.send(request);
    }

    // N-02 휴대폰 인증번호 확인(11/18 1차 시연 후속) — { phone, code, purpose } → { verificationToken }
    @PostMapping("/phone/verify")
    public AuthResponses.PhoneVerified verifyPhoneCode(@Valid @RequestBody AuthRequests.PhoneVerify request) {
        return phoneVerification.verify(request);
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
