package com.baeksuescape.user.service;

import java.util.Arrays;
import java.util.Optional;

// N-02 휴대폰 인증 목적(11/18 1차 시연 후속) — 프론트 값(authConstants.js PHONE_PURPOSES)과 DB VERIFICATION_CODE.PURPOSE_CODE의 짝.
// 회원가입(SIGNUP)과 아이디 찾기(FIND_ID, FP-258)가 쓴다(DDL CK_VCD_PURPOSE).
public enum PhonePurpose {
    SIGNUP("SIGNUP"),
    // FP-258 아이디 찾기(휴대폰 인증). 가입 여부와 상관없이 보낸다.
    FIND_ID("FIND_ID");

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
