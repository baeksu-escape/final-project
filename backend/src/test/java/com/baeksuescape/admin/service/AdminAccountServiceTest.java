package com.baeksuescape.admin.service;

import static com.baeksuescape.admin.service.AdminAuthServiceTest.CRYPTO;
import static com.baeksuescape.admin.service.AdminAuthServiceTest.ENCODER;
import static com.baeksuescape.admin.service.AdminAuthServiceTest.HMAC;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionOperations;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.service.AccountRules;

// FP-80 N-27 계정·권한 관리 — 목록(가린 이름·복호화 실패 견디기·검색어 처리), 잠금(본인 거부·사유 필수·탈퇴 거부), 관리자 추가(재확인·중복·닉네임 자동).
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminAccountServiceTest {

    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-15T03:00:00Z"), ZoneId.of("Asia/Seoul"));

    @Mock
    private AdminAccountMapper adminMapper;
    @Mock
    private UserAccountMapper userMapper;
    @Mock
    private AdminAuthService adminAuth;
    @Mock
    private SystemLogMapper systemLogMapper;

    private AdminAccountService service;

    @BeforeEach
    void setUp() {
        service = new AdminAccountService(adminMapper, userMapper, adminAuth, new AdminPii(CRYPTO), ENCODER, CRYPTO, HMAC,
                new SystemLogService(systemLogMapper, TransactionOperations.withoutTransaction(), CLOCK), CLOCK);
        // 재확인 토큰 "step-ok"만 통과한다.
        given(adminAuth.checkStepUp(eq(1L), eq("step-ok"))).willReturn("jti-1");
        given(adminAuth.checkStepUp(anyLong(), isNull())).willThrow(AdminAuthService.stepUpRequired());
        given(adminMapper.updateLocked(anyLong(), anyString(), any())).willReturn(1);
        given(adminMapper.updateUnlocked(anyLong(), any())).willReturn(1);
    }

    static AdminRows.UserData row(long userId, String loginId, String nameEnc, String status) {
        AdminRows.UserData row = new AdminRows.UserData();
        row.setUserId(userId);
        row.setLoginId(loginId);
        row.setNameEnc(nameEnc);
        row.setRoleCode(UserAccount.ROLE_USER);
        row.setWorkerTypeCode("EMPLOYEE");
        row.setLatestAltScore(712);
        row.setAccountStatusCode(status);
        row.setReportedPostCount(2);
        row.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));
        // FP-273 탈퇴 회원 닉네임은 DB 표시값('탈퇴'+회원 번호) 그대로다.
        row.setNickname(UserAccount.WITHDRAWN.equals(status) ? "탈퇴" + userId : "닉네임" + userId);
        return row;
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getStatus().value() + " " + e.getCode();
        }
        return "no error";
    }

    // ── ADM-05 ──

    @Test
    void listMasksNamesAndSurvivesUndecryptableRows() {
        // 다른 키로 만든 암호문(팀 키로 암호화한 시드 회원 흉내)
        String otherKeyName = new PiiCrypto(new byte[32]).encrypt("홍길동");
        given(adminMapper.selectUsers(any(), any(), any(), any(), anyBoolean(), anyInt(), anyInt())).willReturn(List.of(
                row(7L, "employee", CRYPTO.encrypt("홍길동"), "ACTIVE"),
                row(8L, "seeduser", otherKeyName, "ACTIVE")));
        given(adminMapper.countUsers(any(), any(), any(), any(), anyBoolean())).willReturn(2L);

        AdminDtos.PageResponse<AdminDtos.UserRow> page = service.list(null, null, null, null, null, null);

        assertThat(page.items()).extracting(AdminDtos.UserRow::maskedName).containsExactly("홍*동", "(복호화 불가)");
        assertThat(page.items().get(0).latestAltScore()).isEqualTo(712);
        assertThat(page.items().get(0).reportedPostCount()).isEqualTo(2);
        assertThat(page.items().get(0).createdAt().toString()).isEqualTo("2026-10-01T09:30+09:00");
        assertThat(page.size()).isEqualTo(20);
        assertThat(page.totalCount()).isEqualTo(2);
        // 상태를 고르지 않으면 탈퇴 계정은 뺀다(includeWithdrawn=false)
        verify(adminMapper).selectUsers(isNull(), isNull(), isNull(), isNull(), eq(false), eq(0), eq(20));
    }

    @Test
    void listEscapesLikeCharactersClampsSizeAndChecksFilters() {
        service.list("ad_1%", "ROLE_ADMIN", "LOCKED", null, 2, 500);
        verify(adminMapper).selectUsers(eq("%ad\\_1\\%%"), eq("ROLE_ADMIN"), eq("LOCKED"), isNull(), eq(false), eq(200), eq(100));
        assertThat(codeOf(() -> service.list(null, "ROLE_ROOT", null, null, 0, 20))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.list(null, null, "DELETED", null, 0, 20))).isEqualTo("400 INVALID_INPUT");
    }

    // FP-273 ACCT-03 닉네임 열·직군 필터
    @Test
    void listCarriesNicknameAndFiltersByWorkerType() {
        given(adminMapper.selectUsers(any(), any(), any(), any(), anyBoolean(), anyInt(), anyInt())).willReturn(List.of(
                row(7L, "employee", CRYPTO.encrypt("홍길동"), "ACTIVE"),
                row(9L, "wd_9", "WITHDRAWN", "WITHDRAWN")));

        AdminDtos.PageResponse<AdminDtos.UserRow> page = service.list(null, null, null, "SELF_EMPLOYED", 0, 20);

        // 탈퇴 회원 닉네임은 DB 표시값 그대로 내보낸다.
        assertThat(page.items()).extracting(AdminDtos.UserRow::nickname).containsExactly("닉네임7", "탈퇴9");
        verify(adminMapper).selectUsers(isNull(), isNull(), isNull(), eq("SELF_EMPLOYED"), eq(false), eq(0), eq(20));
        verify(adminMapper).countUsers(isNull(), isNull(), isNull(), eq("SELF_EMPLOYED"), eq(false));
        // 빈 값은 거르지 않고, 코드 3개 밖의 값은 role·status와 같은 400이다.
        service.list(null, null, null, " ", 0, 20);
        verify(adminMapper).selectUsers(isNull(), isNull(), isNull(), isNull(), eq(false), eq(0), eq(20));
        assertThat(codeOf(() -> service.list(null, null, null, "STUDENT", 0, 20))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.list(null, null, null, "employee", 0, 20))).isEqualTo("400 INVALID_INPUT");
    }

    // ── ADM-06 ──

    @Test
    void lockNeedsReasonAndRejectsSelfAndWithdrawn() {
        given(adminMapper.selectUser(7L)).willReturn(row(7L, "employee", CRYPTO.encrypt("홍길동"), "ACTIVE"));
        given(adminMapper.selectUser(9L)).willReturn(row(9L, "wd_9", "WITHDRAWN", "WITHDRAWN"));

        assertThat(codeOf(() -> service.lock(1L, 7L, new AdminDtos.LockRequest(true, " ")))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.lock(1L, 7L, new AdminDtos.LockRequest(true, "가".repeat(301))))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.lock(1L, 1L, new AdminDtos.LockRequest(true, "테스트")))).isEqualTo("409 CANNOT_CHANGE_SELF");
        assertThat(codeOf(() -> service.lock(1L, 9L, new AdminDtos.LockRequest(true, "테스트")))).isEqualTo("409 ACCOUNT_WITHDRAWN");
        assertThat(codeOf(() -> service.lock(1L, 404L, new AdminDtos.LockRequest(true, "테스트")))).isEqualTo("404 NOT_FOUND");
        verify(adminMapper, never()).updateLocked(anyLong(), anyString(), any());
    }

    @Test
    void lockAndUnlockChangeStatusAndRecordAuthLogWithoutReason() {
        given(adminMapper.selectUser(7L)).willReturn(row(7L, "employee", CRYPTO.encrypt("홍길동"), "ACTIVE"));

        AdminDtos.UserRow locked = service.lock(1L, 7L, new AdminDtos.LockRequest(true, "  신고 누적 확인  "));
        service.lock(1L, 7L, new AdminDtos.LockRequest(false, null));

        verify(adminMapper).updateLocked(eq(7L), eq("신고 누적 확인"), any());
        verify(adminMapper).updateUnlocked(eq(7L), any());
        assertThat(locked.userId()).isEqualTo(7L);
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("admin-service"), eq("관리자가 계정 잠금 (em***)"), eq(1L), any());
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("admin-service"), eq("관리자가 계정 잠금 해제 (em***)"), eq(1L), any());
    }

    // ── ADM-07 ──

    @Test
    void addAdminNeedsStepUpToken() {
        assertThat(codeOf(() -> service.addAdmin(1L, new AdminDtos.NewAdmin("newadmin", "김관리", "new@example.com"), null)))
                .isEqualTo("401 STEP_UP_REQUIRED");
        verify(adminMapper, never()).insertAdmin(any());
    }

    @Test
    void addAdminRejectsBadInputAndDuplicatesWithoutUsingStepUp() {
        assertThat(codeOf(() -> service.addAdmin(1L, new AdminDtos.NewAdmin("1bad", "김관리", "new@example.com"), "step-ok")))
                .isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.addAdmin(1L, new AdminDtos.NewAdmin("wd_admin", "김관리", "new@example.com"), "step-ok")))
                .isEqualTo("400 INVALID_INPUT");
        given(userMapper.countByLoginId("dupadmin")).willReturn(1);
        assertThat(codeOf(() -> service.addAdmin(1L, new AdminDtos.NewAdmin("dupadmin", "김관리", "new@example.com"), "step-ok")))
                .isEqualTo("409 DUPLICATE_LOGIN_ID");
        given(userMapper.countByEmailHmac(HMAC.email("used@example.com"))).willReturn(1);
        assertThat(codeOf(() -> service.addAdmin(1L, new AdminDtos.NewAdmin("newadmin", "김관리", "used@example.com"), "step-ok")))
                .isEqualTo("409 DUPLICATE_EMAIL");
        verify(adminAuth, never()).consumeStepUp(anyString());
    }

    @Test
    void addAdminMakesNicknameAgainWhenTakenAndReturnsTemporaryPasswordOnce() {
        // 첫 두 번 지은 닉네임은 이미 있다고 답한다.
        given(userMapper.countByNickname(anyString())).willReturn(1, 1, 0);
        doAnswer(invocation -> {
            invocation.<UserAccount>getArgument(0).setUserId(30L);
            return 1;
        }).when(adminMapper).insertAdmin(any());

        AdminDtos.TemporaryPassword result = service.addAdmin(1L, new AdminDtos.NewAdmin("new_admin", "김관리", "new@example.com"), "step-ok");

        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(adminMapper).insertAdmin(saved.capture());
        UserAccount account = saved.getValue();
        assertThat(account.getNickname()).matches("관리자\\d{4}");
        verify(userMapper, atLeastOnce()).countByNickname(anyString());
        assertThat(CRYPTO.decrypt(account.getEmailEnc())).isEqualTo("new@example.com");
        assertThat(account.getEmailHmac()).isEqualTo(HMAC.email("new@example.com"));
        assertThat(result).extracting(AdminDtos.TemporaryPassword::userId, AdminDtos.TemporaryPassword::loginId).containsExactly(30L, "new_admin");
        assertThat(result.temporaryPassword()).hasSize(12);
        assertThat(AccountRules.isValidPassword(result.temporaryPassword())).isTrue();
        assertThat(ENCODER.matches(result.temporaryPassword(), account.getPasswordHash())).isTrue();
        verify(adminAuth).consumeStepUp("jti-1");
        // 임시 비밀번호는 시스템 로그에 남기지 않는다.
        ArgumentCaptor<String> messages = ArgumentCaptor.forClass(String.class);
        verify(systemLogMapper).insertLog(eq("AUTH"), eq("admin-service"), messages.capture(), eq(1L), any());
        assertThat(messages.getValue()).isEqualTo("관리자 계정 추가 (ne***)").doesNotContain(result.temporaryPassword());
    }

    // ── 임시 비밀번호 재발급 ──

    @Test
    void reissueOnlyForOtherAdmins() {
        UserAccount member = new UserAccount();
        member.setUserId(7L);
        member.setRoleCode(UserAccount.ROLE_USER);
        member.setAccountStatusCode(UserAccount.ACTIVE);
        given(userMapper.selectById(7L)).willReturn(member);
        UserAccount otherAdmin = AdminAuthServiceTest.admin(2L, "admin02");
        given(userMapper.selectById(2L)).willReturn(otherAdmin);
        given(adminMapper.updateTemporaryPassword(eq(2L), anyString(), any())).willReturn(1);

        assertThat(codeOf(() -> service.reissueTemporaryPassword(1L, 1L, "step-ok"))).isEqualTo("409 CANNOT_CHANGE_SELF");
        assertThat(codeOf(() -> service.reissueTemporaryPassword(1L, 7L, "step-ok"))).isEqualTo("404 NOT_FOUND");
        assertThat(service.reissueTemporaryPassword(1L, 2L, "step-ok").temporaryPassword()).hasSize(12);
        verify(adminMapper).updateTemporaryPassword(eq(2L), anyString(), any());
    }

    @Test
    void temporaryPasswordGeneratorAlwaysMixesLettersAndDigits() {
        for (int i = 0; i < 200; i++) {
            String password = service.newTemporaryPassword();
            assertThat(password).hasSize(12);
            assertThat(AccountRules.isValidPassword(password)).isTrue();
        }
    }
}
