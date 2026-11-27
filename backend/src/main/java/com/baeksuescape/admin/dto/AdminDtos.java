package com.baeksuescape.admin.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.baeksuescape.user.dto.AuthResponses;
import com.fasterxml.jackson.annotation.JsonInclude;

// FP-80 관리자 API 요청·응답(API 정의서 AUTH-11, ADM-05~10과 🟡 제안 경로). 화면(작업 8) mock과 같은 필드 이름을 쓴다.
// 개인정보는 모두 가린 값으로만 보낸다.
public final class AdminDtos {

    private AdminDtos() {
    }

    // ── 관리자 로그인 2단계 인증 ──

    // AUTH-11 요청
    public record VerifyCode(String challengeToken, String code) {
    }

    // 첫 로그인 비밀번호 설정 요청(POST /api/auth/admin/password-setup)
    public record PasswordSetup(String passwordSetupToken, String newPassword) {
    }

    // AUTH-11·비밀번호 설정 응답. 로그인 완료면 { token, user, passwordChangeRequired: false },
    // 비밀번호를 바꿔야 하면 token 없이 { passwordChangeRequired: true, passwordSetupToken }. 비밀번호 설정 뒤에는 { token, user }.
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AdminLogin(String token, AuthResponses.UserView user, Boolean passwordChangeRequired, String passwordSetupToken) {
    }

    // ── 재확인(step-up)·내 비밀번호 ──

    public record StepUpSent(int expiresInSeconds, String maskedEmail) {
    }

    public record StepUpVerify(String code) {
    }

    public record StepUpToken(String stepUpToken, long expiresIn) {
    }

    public record PasswordChange(String currentPassword, String newPassword) {
    }

    // ── ADM-05·06 계정 목록·잠금 ──

    // 계정 한 줄. 이름은 가린 값, 최근 대안 점수·작성 글 신고 건수는 요약 값, 닉네임(FP-273)은 가리지 않은 값.
    public record UserRow(Long userId, String loginId, String maskedName, String role, String workerTypeCode, Integer latestAltScore,
            String status, int reportedPostCount, OffsetDateTime createdAt, OffsetDateTime lastLoginAt, String nickname) {
    }

    public record PageResponse<T>(List<T> items, int page, int size, long totalCount) {
    }

    public record LockRequest(Boolean locked, String reason) {
    }

    // ── ADM-07 관리자 추가·임시 비밀번호 ──

    public record NewAdmin(String loginId, String name, String workEmail) {
    }

    // 임시 비밀번호는 이 응답에서 한 번만 준다(로그·SYSTEM_LOG에 남기지 않는다).
    public record TemporaryPassword(Long userId, String loginId, String temporaryPassword) {
    }

    // ── ADM-08 열람 사유·회원 상세 ──

    public record CreditDataRequest(String reason) {
    }

    public record CreditData(MemberProfile profile, LatestAssessment latestAssessment, CreditProfile creditProfile,
            Map<String, Integer> altDataSummary) {
    }

    // joinedAt은 'YYYY-MM-DD'.
    public record MemberProfile(String loginId, String maskedName, String maskedEmail, String maskedPhone, String workerTypeCode,
            String status, String joinedAt) {
    }

    public record LatestAssessment(String requestId, Integer tradScore, Integer altScore, String altGradeBandCode, OffsetDateTime assessedAt) {
    }

    // USER_CREDIT_PROFILE 최신 행. 이름은 데이터 입력 화면(creditProfile 섹션)과 같다.
    public record CreditProfile(LocalDate baseDate, Long cardLimitAmount, Long cardMonthlySpendAmount, Integer delinquencyCount12m,
            Integer cashAdvanceMonths, Integer newLoanCount3m, Long privateLenderLoanBalanceAmount) {
    }

    // ── ADM-09·10 로그 ──

    public record AccessLogRow(OffsetDateTime accessedAt, String viewerLoginId, String targetLabel, String reason, String resource) {
    }

    public record SystemLogRow(OffsetDateTime createdAt, String type, String source, String message) {
    }
}
