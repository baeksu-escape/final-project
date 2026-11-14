package com.baeksuescape.user.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.service.social.SocialLoginService;

import jakarta.validation.Valid;

// FP-87 N-01-6 간편 로그인 API (AUTH-04·05) + 시작 주소. 경로는 프론트 socialLoginConfig.js SOCIAL_API와 같다.
// 지금은 개발용 가짜 제공자(avenue.auth.social.mode=DEV)로만 동작하고, 응답에 devMode=true를 붙인다.
@RestController
public class SocialLoginController {

    private final SocialLoginService socialLoginService;

    public SocialLoginController(SocialLoginService socialLoginService) {
        this.socialLoginService = socialLoginService;
    }

    // N-01-6 시작 주소 — 브라우저가 이동해 오면 프론트 콜백(/oauth/callback?code=…)으로 돌려보낸다. 외부 제공자로 나가지 않는다.
    @GetMapping("/oauth2/authorization/{provider}")
    public ResponseEntity<Void> start(@PathVariable("provider") String provider) {
        return ResponseEntity.status(HttpStatus.FOUND).location(socialLoginService.authorizationRedirect(provider)).build();
    }

    // AUTH-04 일회용 코드 교환
    @PostMapping("/api/auth/social/exchange")
    public AuthResponses.SocialExchange exchange(@RequestBody AuthRequests.SocialExchange request) {
        return socialLoginService.exchange(request);
    }

    // AUTH-05 기존 계정에 연결
    @PostMapping("/api/auth/social/link")
    public AuthResponses.Login link(@Valid @RequestBody AuthRequests.SocialLink request) {
        return socialLoginService.link(request);
    }
}
