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
            String socialLinkKey) {
    }

    // AUTH-07 인증코드 발송. purpose: SIGNUP | RESET_PASSWORD | CHANGE_EMAIL
    public record EmailSend(
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "인증 목적이 필요합니다.") String purpose,
            String loginId) {
    }

    // AUTH-08 인증코드 확인. 재설정 목적이면 loginId도 온다.
    public record EmailVerify(
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "인증코드를 입력해 주세요.") String code,
            @NotBlank(message = "인증 목적이 필요합니다.") String purpose,
            String loginId) {
    }

    // AUTH-09 아이디 찾기(이름·휴대폰, 사용자 결정)
    public record FindId(
            @NotBlank(message = "이름을 입력해 주세요.") String name,
            @NotBlank(message = "휴대폰 번호를 입력해 주세요.") String phone) {
    }

    // AUTH-10 비밀번호 재설정
    public record PasswordReset(
            @NotBlank(message = "아이디를 입력해 주세요.") String loginId,
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "이메일 인증을 완료해 주세요.") String emailVerificationToken,
            @NotBlank(message = "비밀번호를 입력해 주세요.") String newPassword) {
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
