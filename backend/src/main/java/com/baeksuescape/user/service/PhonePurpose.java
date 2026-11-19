package com.baeksuescape.user.service;

import java.util.Arrays;
import java.util.Optional;

// N-02 휴대폰 인증 목적(11/18 1차 시연 후속) — 프론트 값(authConstants.js PHONE_PURPOSES)과 DB VERIFICATION_CODE.PURPOSE_CODE의 짝.
// 지금은 회원가입만 쓴다(DDL CK_VCD_PURPOSE의 SIGNUP).
public enum PhonePurpose {
    SIGNUP("SIGNUP");

    private final String dbCode;

    PhonePurpose(String dbCode) {
        this.dbCode = dbCode;
    }

    public String dbCode() {
        return dbCode;
    }

    // 프론트가 보낸 값으로 찾는다. 모르는 값이면 빈 값.
    public static Optional<PhonePurpose> fromRequest(String value) {
        return Arrays.stream(values()).filter(purpose -> purpose.name().equals(value)).findFirst();
    }
}
