package com.baeksuescape.user.service;

import java.util.Arrays;
import java.util.Optional;

// FP-87 이메일 인증 목적 — 프론트 값(authConstants.js EMAIL_PURPOSES)과 DB VERIFICATION_CODE.PURPOSE_CODE의 짝.
// 프론트 RESET_PASSWORD는 DB에서 FIND_PASSWORD다(DDL CK_VCD_PURPOSE).
public enum EmailPurpose {
    SIGNUP("SIGNUP"),
    RESET_PASSWORD("FIND_PASSWORD"),
    CHANGE_EMAIL("CHANGE_EMAIL");

    private final String dbCode;

    EmailPurpose(String dbCode) {
        this.dbCode = dbCode;
    }

    public String dbCode() {
        return dbCode;
    }

    // 프론트가 보낸 값으로 찾는다. 모르는 값이면 빈 값.
    public static Optional<EmailPurpose> fromRequest(String value) {
        return Arrays.stream(values()).filter(purpose -> purpose.name().equals(value)).findFirst();
    }

    // 이미 가입된 이메일로는 코드를 보내지 않는 목적(가입·이메일 변경).
    public boolean blocksUsedEmail() {
        return this == SIGNUP || this == CHANGE_EMAIL;
    }
}
