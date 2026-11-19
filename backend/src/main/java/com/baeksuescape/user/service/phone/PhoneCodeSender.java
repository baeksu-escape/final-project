package com.baeksuescape.user.service.phone;

// N-02 휴대폰 인증번호 보내기(11/18 1차 시연 후속) — avenue.auth.phone.mode(LOG·FIXED)에 맞는 구현 하나만 뜬다.
// TODO(2차: 실제 문자 발송 업체 연동 — 업체·키는 팀 결정) 업체가 정해지면 이 인터페이스의 구현 하나만 추가한다.
public interface PhoneCodeSender {

    // phone(숫자만)으로 인증번호를 보낸다. purpose는 로그 구분용(SIGNUP).
    void send(String phone, String code, String purpose);
}
