package com.baeksuescape.admin.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.admin.mapper.AdminAuditMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-80 N-35 회원 정보 열람(ADM-08) — 열람 사유를 받아 ACCESS_AUDIT_LOG에 먼저 남긴 뒤 회원 상세를 돌려준다.
// 기록이 실패하면 같은 트랜잭션이라 예외가 나고 데이터도 주지 않는다. 응답은 모두 가린 값·요약 값이다.
@Service
public class AdminMemberService {

    static final String RESOURCE = "MEMBER_DETAIL";
    static final int REASON_MAX = 300;

    private final UserAccountMapper userMapper;
    private final AdminAuditMapper auditMapper;
    private final AdminPii pii;
    private final Clock clock;

    public AdminMemberService(UserAccountMapper userMapper, AdminAuditMapper auditMapper, AdminPii pii, Clock clock) {
        this.userMapper = userMapper;
        this.auditMapper = auditMapper;
        this.pii = pii;
        this.clock = clock;
    }

    // ADM-08 열람 — 사유가 비면 400(열람 불가), 대상이 일반 회원이 아니면 404. 감사 로그 저장 → 데이터 조회 순서.
    @Transactional
    public AdminDtos.CreditData creditData(long adminId, long userId, AdminDtos.CreditDataRequest request, String clientIp) {
        String reason = request == null || request.reason() == null ? "" : request.reason().strip();
        if (reason.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ACCESS_REASON_REQUIRED", "열람 사유를 입력해야 볼 수 있습니다.",
                    List.of(new FieldErrorItem("reason", "열람 사유를 입력해 주세요.")));
        }
        if (reason.length() > REASON_MAX) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "열람 사유는 300자 이하로 입력해 주세요.",
                    List.of(new FieldErrorItem("reason", "열람 사유는 300자 이하로 입력해 주세요.")));
        }
        UserAccount target = userMapper.selectById(userId);
        if (target == null || !UserAccount.ROLE_USER.equals(target.getRoleCode())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "회원을 찾을 수 없습니다.");
        }

        auditMapper.insertAccessAudit(adminId, userId, reason, RESOURCE, clientIp, LocalDateTime.now(clock));

        AdminDtos.MemberProfile profile = new AdminDtos.MemberProfile(target.getLoginId(), pii.maskedName(userId, target.getNameEnc()),
                pii.maskedEmail(userId, target.getEmailEnc()), pii.maskedPhone(userId, target.getPhoneEnc()), target.getWorkerTypeCode(),
                target.getAccountStatusCode(), target.getCreatedAt() == null ? null : target.getCreatedAt().toLocalDate().toString());
        return new AdminDtos.CreditData(profile, latestAssessment(userId), creditProfile(userId), altDataSummary(userId));
    }

    private AdminDtos.LatestAssessment latestAssessment(long userId) {
        AdminRows.AssessmentData row = auditMapper.selectLatestAssessment(userId);
        if (row == null) return null;
        return new AdminDtos.LatestAssessment(row.getRequestId(), row.getTradScore(), row.getAltScore(), row.getAltGradeBandCode(),
                offset(row.getAssessedAt()));
    }

    private AdminDtos.CreditProfile creditProfile(long userId) {
        CreditRow row = auditMapper.selectLatestCreditProfile(userId);
        if (row == null) return null;
        return new AdminDtos.CreditProfile(row.getBaseDate(), row.getCardLimitAmt(), row.getCardMonthlySpendAmt(), row.getDelinqCount12m(),
                row.getCashAdvanceMonths(), row.getNewLoanCount3m(), row.getPrivateLenderLoanBalanceAmt());
    }

    // 대안 데이터 5종의 불러온 개월 수. key는 데이터 입력 화면의 종류 key와 같다.
    private Map<String, Integer> altDataSummary(long userId) {
        AdminRows.AltMonths months = auditMapper.selectAltMonths(userId);
        Map<String, Integer> summary = new LinkedHashMap<>();
        summary.put("telecom", months == null ? 0 : months.getTelecom());
        summary.put("utility", months == null ? 0 : months.getUtility());
        summary.put("easypay", months == null ? 0 : months.getEasypay());
        summary.put("nationalPension", months == null ? 0 : months.getNationalPension());
        summary.put("healthInsurance", months == null ? 0 : months.getHealthInsurance());
        return summary;
    }

    private OffsetDateTime offset(LocalDateTime time) {
        return time == null ? null : time.atZone(clock.getZone()).toOffsetDateTime();
    }
}
