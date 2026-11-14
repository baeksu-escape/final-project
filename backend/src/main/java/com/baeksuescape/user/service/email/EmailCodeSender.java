package com.baeksuescape.user.service.email;

// FP-87 N-02-3 인증코드 보내기 — avenue.auth.email.mode(LOG·FIXED·SMTP)에 맞는 구현 하나만 뜬다.
public interface EmailCodeSender {

    // email로 인증코드를 보낸다. purpose는 메일 제목·로그 구분용(SIGNUP·RESET_PASSWORD·CHANGE_EMAIL).
    void send(String email, String code, String purpose);
}
