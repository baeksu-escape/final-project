package com.baeksuescape.user.dto;

import jakarta.validation.constraints.NotBlank;

// FP-87 N-01~N-03 인증 API 요청 본문. 필드 이름은 프론트 features/auth/api/*.js와 같다(✅ 바꾸지 않는다).
public final class AuthRequests {

    private AuthRequests() {
    }

    // AUTH-01 로그인
    public record Login(
            @NotBlank(message = "아이디를 입력해 주세요.") String loginId,
            @NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
    }

    // AUTH-06 회원가입. 칸별 검사는 AuthService가 한 번에 한다(프론트와 같은 문구).
    //   ageGroup: 프론트가 birthYear로 계산해 함께 보내지만 서버는 쓰지 않는다(프론트 TODO(D-20)와 같음).
    //   agreeCreditInfo: 지금 화면의 체크 하나. 시연용 임시로 필수 동의 2개(이용약관·개인정보)를 함께 기록한다.
    //   agreeMarketing: 선택 동의(새 필드). 화면에 아직 없어 보내지 않으면 미동의로 기록한다.
    //   phoneVerificationToken: 휴대폰 인증 확인(phone/verify)에서 받은 토큰. 필수(11/18 1차 시연 후속).
    public record Signup(
            String loginId,
            String name,
            String nickname,
            String phone,
            String email,
            String password,
            Integer birthYear,
            String ageGroup,
            Boolean agreeCreditInfo,
            Boolean agreeMarketing,
            String emailVerificationToken,
            String socialLinkKey,
            String phoneVerificationToken) {
    }

    // N-02-1 닉네임 중복 확인. 형식 검사는 서비스가 칸별 오류로 한다(화면과 같은 문구).
    public record NicknameCheck(String nickname) {
    }

    // N-02 휴대폰 인증번호 발송. purpose: SIGNUP
    public record PhoneSend(
            @NotBlank(message = "휴대폰 번호를 입력해 주세요.") String phone,
            @NotBlank(message = "인증 목적이 필요합니다.") String purpose) {
    }

    // N-02 휴대폰 인증번호 확인
    public record PhoneVerify(
            @NotBlank(message = "휴대폰 번호를 입력해 주세요.") String phone,
            @NotBlank(message = "인증번호를 입력해 주세요.") String code,
            @NotBlank(message = "인증 목적이 필요합니다.") String purpose) {
    }

    // AUTH-07 인증코드 발송. purpose: SIGNUP | RESET_PASSWORD | CHANGE_EMAIL | FIND_ID(FP-258)
    public record EmailSend(
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "인증 목적이 필요합니다.") String purpose,
            String loginId) {
    }

    // AUTH-08 인증코드 확인. 재설정 목적이면 loginId와 name(FP-258)도 온다.
    public record EmailVerify(
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "인증코드를 입력해 주세요.") String code,
            @NotBlank(message = "인증 목적이 필요합니다.") String purpose,
            String loginId,
            String name) {
    }

    // AUTH-09 아이디 찾기(FP-258) — 이름 + 휴대폰 또는 이메일 인증. method: PHONE | EMAIL.
    // 방법에 맞는 칸(phone 또는 email)과 그 인증 토큰(FIND_ID 목적)을 함께 보낸다. 칸 검사는 서비스가 방법에 따라 한다.
    public record FindId(
            @NotBlank(message = "이름을 입력해 주세요.") String name,
            String phone,
            String method,
            String email,
            String verificationToken) {
    }

    // AUTH-10 비밀번호 재설정. FP-258 name이 아이디·이메일과 같은 계정이어야 한다.
    public record PasswordReset(
            @NotBlank(message = "아이디를 입력해 주세요.") String loginId,
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "이메일 인증을 완료해 주세요.") String emailVerificationToken,
            @NotBlank(message = "비밀번호를 입력해 주세요.") String newPassword,
            String name) {
    }

    // AUTH-04 간편 로그인 코드 교환
    public record SocialExchange(String code) {
    }

    // AUTH-05 간편 로그인 기존 계정 연결
    public record SocialLink(
            String linkKey,
            @NotBlank(message = "아이디를 입력해 주세요.") String loginId,
            @NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
    }
}
