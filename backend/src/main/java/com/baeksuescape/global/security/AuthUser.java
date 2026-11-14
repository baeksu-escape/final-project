package com.baeksuescape.global.security;

// FP-87 로그인한 사용자 — JWT에서 꺼낸 USER_ID와 역할(ROLE_USER·ROLE_ADMIN).
// 컨트롤러에서 받는 법: public Foo me(@AuthenticationPrincipal AuthUser user) { long userId = user.userId(); }
public record AuthUser(long userId, String role) {
}
