package com.baeksuescape.global.security;

// FP-80 JWT 종류(클레임 scope). JWT 필터는 ACCESS만 로그인으로 받고, 나머지는 각 API가 직접 확인하는 짧은 1회용 토큰이다.
public enum TokenScope {
    // 로그인 완료 — 그 밖의 모든 API(유효 시간은 avenue.auth.jwt.expires-minutes)
    ACCESS,
    // 관리자 비밀번호가 맞은 뒤 6자리 번호를 기다리는 동안(5분) — AUTH-11
    ADMIN_LOGIN_CHALLENGE,
    // 관리자 2단계 인증 통과 + 비밀번호 변경이 필요할 때(10분) — 첫 로그인 비밀번호 설정
    ADMIN_PASSWORD_SETUP,
    // 로그인한 관리자가 6자리 번호를 다시 확인한 뒤(5분) — 비밀번호 변경·관리자 추가·임시 비밀번호 재발급
    ADMIN_STEP_UP
}
