package com.baeksuescape.user.service;

import java.util.List;

import org.springframework.http.HttpStatus;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

// FP-87 인증·회원 API가 함께 쓰는 오류. 문구와 code는 프론트 authConstants.js·socialLoginConfig.js·mock과 같다.
public final class AuthErrors {

    public static final String LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";
    // FP-258 잠금은 비밀번호 찾기(AUTH-10 재설정)로 풀린다는 것을 함께 알린다.
    public static final String ACCOUNT_LOCKED_MESSAGE = "잠긴 계정입니다. 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정하면 풀립니다.";
    // FP-258 N-01-3 관리자는 비밀번호 찾기(재설정)를 쓸 수 없어 다른 관리자에게 해제를 요청하게 한다.
    public static final String ADMIN_ACCOUNT_LOCKED_MESSAGE = "잠긴 관리자 계정입니다. 다른 관리자에게 잠금 해제를 요청해 주세요.";
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

    // FP-258 잠긴 관리자 계정이 맞는 비밀번호로 로그인할 때(423). 일반 회원은 accountLocked().
    public static ApiException adminAccountLocked() {
        return new ApiException(LOCKED, "ADMIN_ACCOUNT_LOCKED", ADMIN_ACCOUNT_LOCKED_MESSAGE);
    }

    // FP-258 로그인 5회 실패 뒤 잠깐 막을 때(429). minutes는 남은 분(올림, 최소 1).
    public static ApiException loginTemporarilyBlocked(long minutes) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_TEMPORARILY_BLOCKED",
                "로그인 시도가 너무 많습니다. " + minutes + "분 뒤에 다시 시도해 주세요.");
    }

    // FP-258 13차 N-02-3 같은 이메일·휴대폰으로 하루에 보낼 수 있는 인증코드 수(가입·찾기·이메일 변경 등 모든 목적을 함께 센다, 관리자 로그인 번호 제외).
    public static final int DAILY_CODE_SEND_LIMIT = 10;

    // FP-258 13차 하루 발송 상한을 넘었을 때(429). target은 "이메일" 또는 "번호".
    public static ApiException codeSendDailyLimit(String target) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "CODE_SEND_DAILY_LIMIT",
                "오늘 이 " + target + "로 받을 수 있는 인증코드 " + DAILY_CODE_SEND_LIMIT + "회를 모두 받았습니다. 내일 다시 시도해 주세요.");
    }

    public static ApiException accountNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", NO_MATCH_MESSAGE);
    }

    // FP-258 아이디·비밀번호 찾기의 이름 형식 검사 — 가입과 같은 규칙(AccountRules.nameError)이고, 틀리면 400 INVALID_INPUT(name 칸).
    public static void requireValidName(String name) {
        String error = AccountRules.nameError(name);
        if (error != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", error, List.of(new FieldErrorItem("name", error)));
        }
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
