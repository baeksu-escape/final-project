package com.baeksuescape.admin.service;

import static com.baeksuescape.admin.service.AdminAccountServiceTest.CLOCK;
import static com.baeksuescape.admin.service.AdminAuthServiceTest.CRYPTO;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.admin.mapper.AdminAuditMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-80 N-35 회원 정보 열람(ADM-08) — 사유 필수, 일반 회원만, 감사 로그가 데이터보다 먼저 저장, 기록 실패면 데이터 없음, 복호화 실패 견디기.
// ADM-09·10 로그 조회의 대상 표시·type 검사도 함께 본다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminMemberServiceTest {

    @Mock
    private UserAccountMapper userMapper;
    @Mock
    private AdminAuditMapper auditMapper;

    private AdminMemberService service;
    private AdminLogQueryService logs;

    @BeforeEach
    void setUp() {
        AdminPii pii = new AdminPii(CRYPTO);
        service = new AdminMemberService(userMapper, auditMapper, pii, CLOCK);
        logs = new AdminLogQueryService(auditMapper, pii, CLOCK);
        given(userMapper.selectById(7L)).willReturn(member(7L, CRYPTO.encrypt("홍길동")));
        given(userMapper.selectById(1L)).willReturn(AdminAuthServiceTest.admin(1L, "admin01"));
    }

    static UserAccount member(long userId, String nameEnc) {
        UserAccount account = new UserAccount();
        account.setUserId(userId);
        account.setLoginId("employee");
        account.setNameEnc(nameEnc);
        account.setEmailEnc(CRYPTO.encrypt("employee@example.com"));
        account.setPhoneEnc(CRYPTO.encrypt("01012345678"));
        account.setRoleCode(UserAccount.ROLE_USER);
        account.setWorkerTypeCode("EMPLOYEE");
        account.setAccountStatusCode(UserAccount.ACTIVE);
        account.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));
        return account;
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getStatus().value() + " " + e.getCode();
        }
        return "no error";
    }

    @Test
    void reasonIsRequiredAndOnlyMembersCanBeViewed() {
        assertThat(codeOf(() -> service.creditData(1L, 7L, new AdminDtos.CreditDataRequest("  "), "127.0.0.1"))).isEqualTo("400 ACCESS_REASON_REQUIRED");
        assertThat(codeOf(() -> service.creditData(1L, 7L, null, "127.0.0.1"))).isEqualTo("400 ACCESS_REASON_REQUIRED");
        assertThat(codeOf(() -> service.creditData(1L, 1L, new AdminDtos.CreditDataRequest("점수 이의 문의 응대"), "127.0.0.1")))
                .isEqualTo("404 NOT_FOUND");
        assertThat(codeOf(() -> service.creditData(1L, 404L, new AdminDtos.CreditDataRequest("점수 이의 문의 응대"), "127.0.0.1")))
                .isEqualTo("404 NOT_FOUND");
        verify(auditMapper, never()).insertAccessAudit(anyLong(), anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    void auditLogIsSavedBeforeAnyDataIsRead() {
        AdminRows.AssessmentData assessment = new AdminRows.AssessmentData();
        assessment.setRequestId("0f8fad5b-d9cb-469f-a165-70867728950e");
        assessment.setTradScore(640);
        assessment.setAltScore(712);
        assessment.setAltGradeBandCode("B");
        assessment.setAssessedAt(LocalDateTime.of(2026, 11, 1, 10, 0));
        given(auditMapper.selectLatestAssessment(7L)).willReturn(assessment);
        CreditRow credit = new CreditRow();
        credit.setBaseDate(LocalDate.of(2026, 10, 31));
        credit.setCardLimitAmt(3000000L);
        credit.setDelinqCount12m(1);
        given(auditMapper.selectLatestCreditProfile(7L)).willReturn(credit);
        AdminRows.AltMonths months = new AdminRows.AltMonths();
        months.setTelecom(12);
        given(auditMapper.selectAltMonths(7L)).willReturn(months);

        AdminDtos.CreditData data = service.creditData(1L, 7L, new AdminDtos.CreditDataRequest(" 점수 이의 문의 응대 "), "10.0.0.5");

        InOrder order = inOrder(auditMapper);
        order.verify(auditMapper).insertAccessAudit(eq(1L), eq(7L), eq("점수 이의 문의 응대"), eq("MEMBER_DETAIL"), eq("10.0.0.5"), any());
        order.verify(auditMapper).selectLatestAssessment(7L);
        assertThat(data.profile().maskedName()).isEqualTo("홍*동");
        assertThat(data.profile().maskedEmail()).isEqualTo("em******@example.com");
        assertThat(data.profile().maskedPhone()).isEqualTo("010-****-5678");
        assertThat(data.profile().joinedAt()).isEqualTo("2026-10-01");
        assertThat(data.latestAssessment().altScore()).isEqualTo(712);
        assertThat(data.latestAssessment().assessedAt().toString()).isEqualTo("2026-11-01T10:00+09:00");
        assertThat(data.creditProfile().cardLimitAmount()).isEqualTo(3000000L);
        assertThat(data.creditProfile().delinquencyCount12m()).isEqualTo(1);
        assertThat(data.altDataSummary()).containsEntry("telecom", 12).containsEntry("healthInsurance", 0).hasSize(5);
    }

    @Test
    void whenAuditLogFailsNoDataIsReturned() {
        given(auditMapper.insertAccessAudit(anyLong(), anyLong(), anyString(), anyString(), any(), any()))
                .willThrow(new DataIntegrityViolationException("insert failed"));

        assertThatThrownBy(() -> service.creditData(1L, 7L, new AdminDtos.CreditDataRequest("점수 이의 문의 응대"), "127.0.0.1"))
                .isInstanceOf(DataIntegrityViolationException.class);
        verify(auditMapper, never()).selectLatestAssessment(anyLong());
        verify(auditMapper, never()).selectLatestCreditProfile(anyLong());
        verify(auditMapper, never()).selectAltMonths(anyLong());
    }

    @Test
    void undecryptableMemberIsShownAsUnreadableNot500() {
        given(userMapper.selectById(8L)).willReturn(member(8L, new PiiCrypto(new byte[32]).encrypt("홍길동")));

        AdminDtos.CreditData data = service.creditData(1L, 8L, new AdminDtos.CreditDataRequest("모형 검증용 표본 점검"), "127.0.0.1");

        assertThat(data.profile().maskedName()).isEqualTo("(복호화 불가)");
        assertThat(data.latestAssessment()).isNull();
        assertThat(data.creditProfile()).isNull();
    }

    // ── ADM-09·10 ──

    @Test
    void accessLogShowsMaskedTargetAndSystemLogChecksType() {
        AdminRows.AccessLogData row = new AdminRows.AccessLogData();
        row.setAccessedAt(LocalDateTime.of(2026, 11, 15, 9, 0));
        row.setViewerLoginId("admin01");
        row.setTargetUserId(7L);
        row.setTargetLoginId("employee");
        row.setTargetNameEnc(CRYPTO.encrypt("홍길동"));
        row.setReason("점수 이의 문의 응대");
        row.setAccessedResource("MEMBER_DETAIL");
        given(auditMapper.selectAccessLogs(0, 50)).willReturn(List.of(row));
        given(auditMapper.countAccessLogs()).willReturn(1L);

        AdminDtos.PageResponse<AdminDtos.AccessLogRow> page = logs.accessLogs(null, null);

        assertThat(page.items().get(0).targetLabel()).isEqualTo("홍*동 (emp*****)");
        assertThat(page.items().get(0).viewerLoginId()).isEqualTo("admin01");
        assertThat(page.size()).isEqualTo(50);
        assertThat(codeOf(() -> logs.systemLogs("DEBUG", null, null))).isEqualTo("400 INVALID_INPUT");
        logs.systemLogs("WARN", 1, 10);
        verify(auditMapper).selectSystemLogs("WARN", 10, 10);
    }
}
