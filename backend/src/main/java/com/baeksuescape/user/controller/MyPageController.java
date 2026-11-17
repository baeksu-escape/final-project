package com.baeksuescape.user.controller;

import java.time.Instant;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.service.MyPageService;
import com.baeksuescape.user.service.WithdrawalService;

import jakarta.validation.Valid;

// FP-87 N-04 마이페이지·N-05-1 직군 API (API 정의서 v0.2 MEM-01~05). 경로·필드는 프론트 myPageApi.js·dataInputApi.js와 같다.
// /api/members/me/**는 일반 사용자(ROLE_USER)만 부르고, USER_ID는 토큰에서 받는다(URL에 넣지 않는다).
@RestController
@RequestMapping("/api/members/me")
public class MyPageController {

    private static final String BEARER = "Bearer ";

    private final MyPageService myPageService;
    private final WithdrawalService withdrawalService;
    private final JwtTokenProvider tokenProvider;

    public MyPageController(MyPageService myPageService, WithdrawalService withdrawalService, JwtTokenProvider tokenProvider) {
        this.myPageService = myPageService;
        this.withdrawalService = withdrawalService;
        this.tokenProvider = tokenProvider;
    }

    // MEM-01 N-04-1 내 정보 조회(가린 값)
    @GetMapping("/profile")
    public MyPageDtos.ProfileResponse profile(@AuthenticationPrincipal AuthUser user) {
        return myPageService.profile(user.userId());
    }

    // MEM-02 N-04-2 가림 해제
    @PostMapping("/profile/unmask")
    public MyPageDtos.UnmaskedResponse unmask(@AuthenticationPrincipal AuthUser user, @RequestBody MyPageDtos.Unmask request) {
        return myPageService.unmask(user.userId(), request);
    }

    // MEM-03 N-04-3 이메일 변경
    @PutMapping("/email")
    public Map<String, Object> changeEmail(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody MyPageDtos.EmailChange request) {
        myPageService.changeEmail(user.userId(), request);
        return Map.of();
    }

    // MEM-04 N-04-3 비밀번호 변경
    @PutMapping("/password")
    public Map<String, Object> changePassword(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody MyPageDtos.PasswordChange request) {
        myPageService.changePassword(user.userId(), request);
        return Map.of();
    }

    // MEM-07 N-04-7 회원 탈퇴(상태 변경, DDL v0.3.2 W1). 본문 { password } → {} (프론트 myPageMockHandlers.js와 같다).
    // 간편 로그인 전용 계정의 최근 로그인 확인용으로 이 요청 토큰의 발급 시각(iat)을 함께 넘긴다. 토큰은 JWT 필터가 이미 검증했다.
    @DeleteMapping
    public Map<String, Object> withdraw(@AuthenticationPrincipal AuthUser user, @RequestBody(required = false) MyPageDtos.Withdraw request,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        Instant issuedAt = tokenProvider.issuedAt(authorization.substring(BEARER.length()).trim()).orElse(null);
        withdrawalService.withdraw(user.userId(), request, issuedAt);
        return Map.of();
    }

    // MEM-05 N-05-1 직군 선택(첫 선택만, N-04-8 변경은 미정)
    @PatchMapping("/job-type")
    public AuthResponses.Me selectJobType(@AuthenticationPrincipal AuthUser user, @RequestBody MyPageDtos.JobType request) {
        return myPageService.selectJobType(user.userId(), request);
    }
}
