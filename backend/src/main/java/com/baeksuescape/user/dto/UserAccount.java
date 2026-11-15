package com.baeksuescape.user.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-87 APP_USER 한 행(DDL v0.3.2). 이름·휴대폰·이메일은 암호문(*Enc)과 검색용 HMAC만 들고 있다. 응답으로 바로 내보내지 않는다.
@Getter
@Setter
public class UserAccount {

    public static final String ROLE_USER = "ROLE_USER";
    public static final String ROLE_ADMIN = "ROLE_ADMIN";
    public static final String ACTIVE = "ACTIVE";
    public static final String LOCKED = "LOCKED";
    public static final String WITHDRAWN = "WITHDRAWN";

    private Long userId;
    private String loginId;
    private String passwordHash;
    private String nickname;
    private String nameEnc;
    private String phoneEnc;
    private String phoneHmac;
    private String emailEnc;
    private String emailHmac;
    private Integer birthYear;
    private String workerTypeCode;
    private String roleCode;
    private String accountStatusCode;
    private int loginFailCount;
    // FP-80 관리자 첫 로그인·임시 비밀번호 재발급 뒤 'Y'(비밀번호를 바꿔야 ACCESS 토큰을 받는다)
    private String passwordChangeRequiredYn;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;

    public boolean isAdmin() {
        return ROLE_ADMIN.equals(roleCode);
    }

    public boolean isLocked() {
        return LOCKED.equals(accountStatusCode);
    }

    public boolean isPasswordChangeRequired() {
        return "Y".equals(passwordChangeRequiredYn);
    }

    public boolean isWithdrawn() {
        return WITHDRAWN.equals(accountStatusCode);
    }
}
