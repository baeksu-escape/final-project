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
import com.baeksuescape.user.service.ClientRateLimiter;
import com.baeksuescape.user.service.ClientRateLimiter.Rule;
import com.baeksuescape.user.service.EmailVerificationService;
import com.baeksuescape.user.service.PhoneVerificationService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

// FP-87 N-01~N-03 회원·인증 API (API 정의서 v0.2 AUTH-01~03, 06~10). 경로·필드는 프론트 authApi.js·authFeatureApi.js와 같다.
// 로그인·가입·이메일 인증·찾기는 인증 없이, 로그아웃·내 정보는 로그인한 상태로 부른다(SecurityConfig).
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerification;
    private final PhoneVerificationService phoneVerification;
    private final ClientRateLimiter rateLimiter;

    public AuthController(AuthService authService, EmailVerificationService emailVerification, PhoneVerificationService phoneVerification,
            ClientRateLimiter rateLimiter) {
        this.authService = authService;
        this.emailVerification = emailVerification;
        this.phoneVerification = phoneVerification;
        this.rateLimiter = rateLimiter;
    }

    // AUTH-01 N-01-1 로그인. 일반 사용자는 { accessToken, user }, 관리자는 { twoFactorRequired, challengeToken, maskedEmail }(FP-80).
    // FP-258 13차 같은 IP의 로그인 실패가 많으면 계정과 상관없이 429(ClientRateLimiter LOGIN_FAILURE).
    @PostMapping("/login")
    public AuthResponses.LoginResult login(@Valid @RequestBody AuthRequests.Login request, HttpServletRequest http) {
        return rateLimiter.countFailures(Rule.LOGIN_FAILURE, http.getRemoteAddr(), () -> authService.login(request));
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
    public AuthResponses.EmailSent sendEmailCode(@Valid @RequestBody AuthRequests.EmailSend request, HttpServletRequest http) {
        // FP-258 13차 같은 IP의 인증코드 요청은 1시간 횟수 제한(ClientRateLimiter CODE_SEND)
        rateLimiter.hit(Rule.CODE_SEND, http.getRemoteAddr());
        return emailVerification.send(request);
    }

    // AUTH-08 N-02-3 이메일 인증코드 확인
    @PostMapping("/email/verify")
    public AuthResponses.EmailVerified verifyEmailCode(@Valid @RequestBody AuthRequests.EmailVerify request) {
        return emailVerification.verify(request);
    }

    // N-02-1 닉네임 중복 확인(11/18 1차 시연 후속) — { nickname } → { available }. 닉네임을 주소에 남기지 않으려고 POST로 받는다.
    @PostMapping("/nickname/check")
    public AuthResponses.NicknameAvailability checkNickname(@RequestBody AuthRequests.NicknameCheck request, HttpServletRequest http) {
        // FP-258 13차 같은 IP의 중복 확인은 1분 횟수 제한(ClientRateLimiter AVAILABILITY_CHECK, 아이디 확인과 함께 센다)
        rateLimiter.hit(Rule.AVAILABILITY_CHECK, http.getRemoteAddr());
        return authService.checkNickname(request);
    }

    // AUTH-16 N-02-1 아이디 중복 확인(FP-258) — { loginId } → { available }. 닉네임 확인처럼 아이디를 주소에 남기지 않으려고 POST로 받는다.
    @PostMapping("/login-id/check")
    public AuthResponses.LoginIdAvailability checkLoginId(@RequestBody AuthRequests.LoginIdCheck request, HttpServletRequest http) {
        rateLimiter.hit(Rule.AVAILABILITY_CHECK, http.getRemoteAddr());
        return authService.checkLoginId(request);
    }

    // N-02 휴대폰 인증번호 발송(11/18 1차 시연 후속) — { phone, purpose } → { expiresInSeconds }
    @PostMapping("/phone/send")
    public AuthResponses.PhoneSent sendPhoneCode(@Valid @RequestBody AuthRequests.PhoneSend request, HttpServletRequest http) {
        rateLimiter.hit(Rule.CODE_SEND, http.getRemoteAddr());
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
