package com.baeksuescape.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

// FP-87 N-01~N-03 인증 API 응답. 모양은 프론트 mock(authMockHandlers.js·socialLoginMockHandlers.js)과 같다.
public final class AuthResponses {

    private AuthResponses() {
    }

    // 화면이 들고 있는 사용자 정보(프론트 common/types UserInfo). name은 가린 값이다. hasScore는 일반 사용자만 보낸다.
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UserView(Long userId, String name, String role, String jobType, Boolean hasScore) {
    }

    // AUTH-01 로그인, AUTH-05 간편 로그인 연결
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Login(String accessToken, UserView user, Boolean devMode) {

        public Login(String accessToken, UserView user) {
            this(accessToken, user, null);
        }
    }

    // AUTH-03 내 정보, MEM-05 직군 저장
    public record Me(UserView user) {
    }

    // AUTH-06 회원가입
    public record Signup(Long userId) {
    }

    // AUTH-07 인증코드 발송
    public record EmailSent(int expiresInSeconds) {
    }

    // AUTH-08 인증코드 확인
    public record EmailVerified(String verificationToken) {
    }

    // AUTH-09 아이디 찾기
    public record FoundId(String maskedLoginId) {
    }

    // AUTH-04 간편 로그인 교환. result가 LINKED면 accessToken·user, LINK_REQUIRED면 linkKey·provider·profile이 온다.
    // devMode: 개발용 가짜 제공자로 만든 응답이라는 표시(avenue.auth.social.mode=DEV).
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SocialExchange(String result, String accessToken, UserView user, String linkKey, String provider,
            SocialProfile profile, boolean devMode) {

        public static SocialExchange linked(Login login) {
            return new SocialExchange("LINKED", login.accessToken(), login.user(), null, null, null, true);
        }

        public static SocialExchange linkRequired(String linkKey, String provider, SocialProfile profile) {
            return new SocialExchange("LINK_REQUIRED", null, null, linkKey, provider, profile, true);
        }
    }

    // 제공자가 준 것처럼 보여 주는 프로필(가입 화면에 미리 채움).
    public record SocialProfile(String name, String email) {
    }
}
