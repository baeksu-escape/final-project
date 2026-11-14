package com.baeksuescape.user.dto;

import jakarta.validation.constraints.NotBlank;

// FP-87 N-04 마이페이지·N-05-1 직군 API 요청·응답. 모양은 프론트 myPageApi.js·myPageMockHandlers.js·dataInputApi.js와 같다.
public final class MyPageDtos {

    private MyPageDtos() {
    }

    // MEM-01 내 정보(이름·휴대폰·이메일은 가린 값, 휴대폰이 없으면 null). joinedAt은 'YYYY-MM-DD'.
    public record Profile(String loginId, String nickname, String name, String phone, String email, String joinedAt, String jobType) {
    }

    public record ProfileResponse(Profile profile) {
    }

    // MEM-02 가림 해제 결과(원래 값, 휴대폰은 010-1234-5678 꼴).
    public record UnmaskedProfile(String name, String phone, String email) {
    }

    public record UnmaskedResponse(UnmaskedProfile profile) {
    }

    // MEM-02 가림 해제 요청
    public record Unmask(String password) {
    }

    // MEM-03 이메일 변경
    public record EmailChange(
            @NotBlank(message = "이메일을 입력해 주세요.") String email,
            @NotBlank(message = "이메일 인증을 완료해 주세요.") String emailVerificationToken) {
    }

    // MEM-04 비밀번호 변경
    public record PasswordChange(
            @NotBlank(message = "현재 비밀번호를 입력해 주세요.") String currentPassword,
            @NotBlank(message = "새 비밀번호를 입력해 주세요.") String newPassword) {
    }

    // MEM-05 직군 선택. EMPLOYEE | SELF_EMPLOYED | FREELANCER
    public record JobType(String jobType) {
    }
}
