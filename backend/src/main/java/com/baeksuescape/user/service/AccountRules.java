package com.baeksuescape.user.service;

import java.util.regex.Pattern;

// FP-87 N-02 회원 입력 규칙 — 프론트 features/auth/validation.js와 같은 규칙·문구. 가입·찾기·마이페이지가 함께 쓴다.
public final class AccountRules {

    public static final int BIRTH_YEAR_MIN = 1930;
    public static final int MIN_SIGNUP_AGE = 20;
    public static final int NICKNAME_MIN = 2;
    public static final int NICKNAME_MAX = 12;
    public static final int NAME_MAX = 50;
    public static final int EMAIL_MAX = 100;
    // BCrypt는 72바이트까지만 쓰므로 그보다 짧게 받는다.
    public static final int PASSWORD_MAX = 64;
    // 탈퇴 회원 표시값으로 예약된 닉네임 접두어(DDL CK_APU_PII_BY_STATUS).
    public static final String WITHDRAWN_NICKNAME_PREFIX = "탈퇴";

    private static final Pattern LOGIN_ID = Pattern.compile("^[a-z][a-z0-9]{3,19}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PHONE = Pattern.compile("^01[016-9]\\d{7,8}$");
    private static final Pattern LETTER = Pattern.compile("[A-Za-z]");
    private static final Pattern DIGIT = Pattern.compile("\\d");

    private AccountRules() {
    }

    // 아이디: 영문 소문자로 시작하는 4~20자 영문 소문자·숫자(프론트 isValidLoginId, 팀 확정 전 임시 규칙).
    public static boolean isValidLoginId(String value) {
        return value != null && LOGIN_ID.matcher(value).matches();
    }

    public static boolean isValidEmail(String value) {
        return value != null && value.length() <= EMAIL_MAX && EMAIL.matcher(value).matches();
    }

    // 비밀번호: 영문과 숫자를 섞어 8자 이상(decisions.md 1-2). 기호는 요구하지 않는다.
    public static boolean isValidPassword(String value) {
        return value != null && value.length() >= 8 && value.length() <= PASSWORD_MAX
                && LETTER.matcher(value).find() && DIGIT.matcher(value).find();
    }

    // 휴대폰에서 숫자만 남긴다. 하이픈을 넣거나 빼도 같은 값이 된다. null이면 빈 문자열.
    public static String normalizePhone(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    // 숫자만 남긴 휴대폰 형식(010·011·016~019로 시작하는 10~11자리).
    public static boolean isValidPhone(String digits) {
        return digits != null && PHONE.matcher(digits).matches();
    }

    // 가입할 수 있는 가장 늦은 출생연도(올해 − 20). 팀 결정 A안: 생일은 따지지 않는다.
    public static int maxBirthYear(int thisYear) {
        return thisYear - MIN_SIGNUP_AGE;
    }

    // 출생연도 오류 문구. 문제없으면 null.
    public static String birthYearError(Integer birthYear, int thisYear) {
        if (birthYear == null) return "출생연도를 넣어 주세요.";
        int max = maxBirthYear(thisYear);
        if (birthYear < BIRTH_YEAR_MIN || birthYear > max) {
            return "올해 기준 " + MIN_SIGNUP_AGE + "세 이상(" + max + "년생까지)만 가입할 수 있습니다. 출생연도를 확인해 주세요.";
        }
        return null;
    }

    // 닉네임 오류 문구(앞뒤 공백을 뺀 값으로 검사). 문제없으면 null.
    public static String nicknameError(String nickname) {
        String text = nickname == null ? "" : nickname.strip();
        if (text.isEmpty()) return "닉네임을 넣어 주세요.";
        if (text.length() < NICKNAME_MIN || text.length() > NICKNAME_MAX) return "닉네임은 " + NICKNAME_MIN + "~" + NICKNAME_MAX + "자로 넣어 주세요.";
        if (text.startsWith(WITHDRAWN_NICKNAME_PREFIX)) return "쓸 수 없는 닉네임입니다.";
        return null;
    }

    // 아이디 앞부분만 남기고 가린다(프론트 mock maskLoginId와 같음). 예) jwc1226 → jwc****
    public static String maskLoginId(String loginId) {
        int visible = Math.min(3, Math.max(1, loginId.length() - 2));
        return loginId.substring(0, visible) + "*".repeat(loginId.length() - visible);
    }
}
