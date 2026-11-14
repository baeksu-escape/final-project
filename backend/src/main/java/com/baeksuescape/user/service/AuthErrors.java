package com.baeksuescape.user.service;

import org.springframework.http.HttpStatus;

import com.baeksuescape.global.exception.ApiException;

// FP-87 인증·회원 API가 함께 쓰는 오류. 문구와 code는 프론트 authConstants.js·socialLoginConfig.js·mock과 같다.
public final class AuthErrors {

    public static final String LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";
    public static final String ACCOUNT_LOCKED_MESSAGE = "잠긴 계정입니다. 관리자에게 문의해 주세요.";
    public static final String NO_MATCH_MESSAGE = "입력한 정보와 일치하는 계정이 없습니다.";
    // 423 Locked. Spring HttpStatus에도 있지만 숫자를 그대로 두어 프론트 mock과 같은 값임을 보인다.
    public static final HttpStatus LOCKED = HttpStatus.valueOf(423);

    private AuthErrors() {
    }

    public static ApiException loginFailed() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", LOGIN_FAILED_MESSAGE);
    }

    public static ApiException accountLocked() {
        return new ApiException(LOCKED, "ACCOUNT_LOCKED", ACCOUNT_LOCKED_MESSAGE);
    }

    public static ApiException accountNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", NO_MATCH_MESSAGE);
    }

    public static ApiException duplicateLoginId() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_LOGIN_ID", "이미 사용 중인 아이디입니다.");
    }

    public static ApiException duplicateEmail() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다.");
    }

    public static ApiException duplicateNickname() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_NICKNAME", "이미 사용 중인 닉네임입니다.");
    }

    public static ApiException socialLinkExpired() {
        return new ApiException(HttpStatus.BAD_REQUEST, "SOCIAL_LINK_EXPIRED", "소셜 로그인을 처음부터 다시 진행해 주세요.");
    }

    public static ApiException socialAdminNotAllowed() {
        return new ApiException(HttpStatus.FORBIDDEN, "SOCIAL_ADMIN_NOT_ALLOWED", "관리자 계정은 소셜 로그인을 쓸 수 없습니다.");
    }
}
