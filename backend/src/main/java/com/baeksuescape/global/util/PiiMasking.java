package com.baeksuescape.global.util;

// FP-87 N-04-1 개인정보 가림 처리 — 화면·로그에는 이 함수로 가린 값만 보낸다. 규칙은 프론트 mock(myPageMockHandlers.js)과 같다.
// 세 함수 모두 값이 없으면(null·빈 값) null을 돌려준다. 휴대폰은 DDL에서 비어 있을 수 있다(PHONE_ENC nullable).
public final class PiiMasking {

    private PiiMasking() {
    }

    // 이름은 첫 글자(세 글자 이상이면 마지막 글자도)만 남긴다. 예) 홍길동 → 홍*동, 홍길 → 홍*
    public static String name(String name) {
        if (isEmpty(name)) return null;
        if (name.length() <= 2) return name.substring(0, 1) + "*".repeat(name.length() - 1);
        return name.charAt(0) + "*".repeat(name.length() - 2) + name.charAt(name.length() - 1);
    }

    // 휴대폰 가운데 자리를 가린다. 숫자만 있는 값을 받는다. 예) 01012345678 → 010-****-5678, 0101234567 → 010-***-4567
    public static String phone(String phone) {
        if (isEmpty(phone)) return null;
        String head = phone.substring(0, Math.min(3, phone.length()));
        int middleEnd = phone.length() == 11 ? 7 : Math.min(6, phone.length());
        String middle = phone.substring(head.length(), Math.max(head.length(), middleEnd));
        String tail = phone.substring(Math.max(head.length(), middleEnd));
        return head + "-" + "*".repeat(middle.length()) + "-" + tail;
    }

    // 이메일 아이디 부분의 앞 두 글자만 남긴다(아이디가 짧으면 마지막 한 글자는 가린다). 예) employee@example.com → em******@example.com
    public static String email(String email) {
        if (isEmpty(email)) return null;
        int at = email.indexOf('@');
        String local = at < 0 ? email : email.substring(0, at);
        String domain = at < 0 ? "" : email.substring(at);
        int visible = Math.max(0, Math.min(2, local.length() - 1));
        return local.substring(0, visible) + "*".repeat(local.length() - visible) + domain;
    }

    private static boolean isEmpty(String value) {
        return value == null || value.isEmpty();
    }
}
