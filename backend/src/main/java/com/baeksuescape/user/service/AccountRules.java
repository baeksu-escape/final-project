package com.baeksuescape.user.service;

import java.util.Locale;
import java.util.regex.Pattern;

// FP-87 N-02 회원 입력 규칙 — 프론트 features/auth/validation.js와 같은 규칙·문구. 가입·찾기·마이페이지가 함께 쓴다.
public final class AccountRules {

    public static final int BIRTH_YEAR_MIN = 1930;
    public static final int MIN_SIGNUP_AGE = 20;
    public static final int NICKNAME_MIN = 2;
    // N-02-1 닉네임: 한글(완성형)·영문·숫자 2~7자(11/18 화면 확인 후속, 프론트 validation.js NICKNAME_PATTERN과 같음).
    // DDL(2~12자)보다 좁게 막는 것이라 새로 가입할 때만 적용한다. 관리자 자동 닉네임('관리자'+4자리)은 이 검사를 거치지 않는다.
    public static final int NICKNAME_MAX = 7;
    public static final int NAME_MAX = 50;
    public static final int EMAIL_MAX = 100;
    // BCrypt는 72바이트까지만 쓰므로 그보다 짧게 받는다.
    public static final int PASSWORD_MAX = 64;
    // 탈퇴 회원 표시값으로 예약된 닉네임 접두어(DDL CK_APU_PII_BY_STATUS).
    public static final String WITHDRAWN_NICKNAME_PREFIX = "탈퇴";

    private static final Pattern LOGIN_ID = Pattern.compile("^[a-z][a-z0-9]{3,19}$");
    // N-02 이름: 완성형 한글 2~20자(11/18 1차 시연 후속, 프론트 validation.js NAME_PATTERN과 같음).
    private static final Pattern NAME = Pattern.compile("^[가-힣]{2,20}$");
    private static final Pattern NICKNAME = Pattern.compile("^[A-Za-z0-9가-힣]{" + NICKNAME_MIN + "," + NICKNAME_MAX + "}$");
    public static final String NICKNAME_RULE_MESSAGE = "닉네임은 한글·영문·숫자 2~7자로 입력해 주세요.";
    public static final String NAME_RULE_MESSAGE = "이름은 한글 2~20자로 입력해 주세요. (숫자·영문·기호 불가)";
    // FP-258 이메일 규칙(프론트 validation.js와 같음) — 앞부분 a-z0-9._-(처음·끝 a-z0-9, 점 연속 불가, 64자), 도메인 덩어리는 a-z0-9로 시작·끝, 마지막은 영문 2자 이상.
    private static final Pattern EMAIL_LOCAL = Pattern.compile("^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$");
    private static final Pattern DOMAIN_LABEL = Pattern.compile("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$");
    private static final Pattern TOP_LEVEL_DOMAIN = Pattern.compile("^[a-z]{2,}$");
    private static final Pattern PHONE = Pattern.compile("^01[016-9]\\d{7,8}$");
    private static final Pattern LETTER = Pattern.compile("[A-Za-z]");
    private static final Pattern DIGIT = Pattern.compile("\\d");
    // FP-258 13차 N-02-4 새 비밀번호에 쓸 수 있는 글자 — ASCII 출력 문자(영문·숫자·키보드 기호)와 공백(프론트 filterPassword와 같음). 64자라 BCrypt 72바이트 안이다.
    private static final Pattern PRINTABLE_ASCII = Pattern.compile("^[\\x20-\\x7E]*$");

    private AccountRules() {
    }

    // 아이디: 영문 소문자로 시작하는 4~20자 영문 소문자·숫자(프론트 isValidLoginId, 팀 확정 전 임시 규칙).
    public static boolean isValidLoginId(String value) {
        return value != null && LOGIN_ID.matcher(value).matches();
    }

    // FP-258 N-03-1·N-03-2 기존 이메일 기본 형식(새 규칙 전 develop 규칙, 100자 이하). 아이디·비밀번호 찾기와 관리자 업무 이메일이 쓴다.
    private static final Pattern BASIC_EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    // + 같은 글자가 든 기존 이메일도 통과한다. 프론트 validation.js isBasicEmail과 같다.
    public static boolean isBasicEmail(String value) {
        return value != null && value.length() <= EMAIL_MAX && BASIC_EMAIL.matcher(value).matches();
    }

    // 이메일 형식 — 소문자로 바꾼 값을 '앞부분@도메인'으로 나눠 위 규칙으로 본다(100자 이하). 대소문자 때문에 거절하지는 않는다.
    // FP-258 새 규칙은 가입(AUTH-06·SIGNUP 인증)과 이메일 변경(MEM-03·CHANGE_EMAIL 인증)에만 쓴다.
    public static boolean isValidEmail(String value) {
        if (value == null) return false;
        String text = value.toLowerCase(Locale.ROOT);
        if (text.length() > EMAIL_MAX) return false;
        String[] parts = text.split("@", -1);
        if (parts.length != 2) return false;
        String local = parts[0];
        if (!EMAIL_LOCAL.matcher(local).matches() || local.contains("..")) return false;
        String[] labels = parts[1].split("\\.", -1);
        if (labels.length < 2) return false;
        for (String label : labels) {
            if (!DOMAIN_LABEL.matcher(label).matches()) return false;
        }
        return TOP_LEVEL_DOMAIN.matcher(labels[labels.length - 1]).matches();
    }

    // FP-258 이메일 정리 — 앞뒤 공백을 빼고 소문자로 바꾼다. 가입·이메일 변경·인증코드·아이디 찾기·재설정이 이 값으로 판정·저장한다.
    public static String normalizeEmail(String value) {
        return value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
    }

    // FP-258 로그인 아이디 정리 — 앞뒤 공백을 빼고 소문자로 바꾼다(로그인·비밀번호 찾기 조회).
    public static String normalizeLoginId(String value) {
        return value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
    }

    // 비밀번호: 영문과 숫자를 섞어 8자 이상(decisions.md 1-2). 기호는 요구하지 않는다.
    // FP-258 13차 새 비밀번호(가입·재설정·변경·관리자 비밀번호 설정)에만 쓴다 — 64자 이하, ASCII 출력 문자만. 로그인·현재 비밀번호 확인·탈퇴는 이 검사를 하지 않는다.
    public static boolean isValidPassword(String value) {
        return value != null && value.length() >= 8 && value.length() <= PASSWORD_MAX && PRINTABLE_ASCII.matcher(value).matches()
                && LETTER.matcher(value).find() && DIGIT.matcher(value).find();
    }

    // 휴대폰에서 숫자만 남긴다. 하이픈을 넣거나 빼도 같은 값이 된다. null이면 빈 문자열.
    public static String normalizePhone(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    // FP-258 아이디·비밀번호 찾기 본인 확인 — 입력한 이름(앞뒤 공백 제거)이 복호화한 가입 이름과 같은지 본다.
    public static boolean nameMatches(String input, String storedName) {
        return input != null && !input.isBlank() && input.strip().equals(storedName);
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

    // 가입 이름 오류 문구. 숫자·영문·기호·공백·자음만 입력은 거절한다. 문제없으면 null.
    // FP-258 아이디·비밀번호 찾기도 이 규칙을 쓴다(AuthErrors.requireValidName). 관리자 계정 만들기는 쓰지 않는다.
    public static String nameError(String name) {
        if (name == null || name.isBlank()) return "이름을 입력해 주세요.";
        if (!NAME.matcher(name).matches()) return NAME_RULE_MESSAGE;
        return null;
    }

    // 닉네임 오류 문구(앞뒤 공백을 뺀 값으로 검사). 공백·기호·자음/모음만은 거절한다. 문제없으면 null. 닉네임 확인 API와 가입 검사가 함께 쓴다.
    public static String nicknameError(String nickname) {
        String text = nickname == null ? "" : nickname.strip();
        if (text.isEmpty()) return "닉네임을 넣어 주세요.";
        if (!NICKNAME.matcher(text).matches()) return NICKNAME_RULE_MESSAGE;
        if (text.startsWith(WITHDRAWN_NICKNAME_PREFIX)) return "쓸 수 없는 닉네임입니다.";
        return null;
    }

    // 아이디 앞부분만 남기고 가린다(프론트 mock maskLoginId와 같음). 예) jwc1226 → jwc****
    public static String maskLoginId(String loginId) {
        int visible = Math.min(3, Math.max(1, loginId.length() - 2));
        return loginId.substring(0, visible) + "*".repeat(loginId.length() - visible);
    }
}
