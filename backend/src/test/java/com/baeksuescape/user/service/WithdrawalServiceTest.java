package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.DataInputFixtures.NOW;
import static com.baeksuescape.user.service.DataInputFixtures.consent;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionOperations;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.log.SystemLogMapper;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.user.dto.DataInputRows.ConsentRow;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.AltDataMapper;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserConsentMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.altdata.AltDataKind;

// FP-93 N-04-7 회원 탈퇴(MEM-07) 서비스 — 비밀번호 확인, 처리 순서, 덮어쓸 값(DDL CK_APU_PII_BY_STATUS), 지우는 표와 남기는 표.
// DB는 mock으로 대신하고, 덮어쓸 값·삭제 조건은 매퍼 XML의 SQL 문을 직접 읽어 확인한다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WithdrawalServiceTest {

    private static final Path MAPPER_DIR = Path.of("src/main/resources/mapper/user");
    // 이 요청 토큰의 발급 시각 — 기본은 방금 로그인(UserFixtures.CLOCK의 지금).
    private static final Instant JUST_NOW = UserFixtures.CLOCK.instant();

    @Mock
    private UserAccountMapper userMapper;
    @Mock
    private UserSocialAccountMapper socialMapper;
    @Mock
    private VerificationCodeMapper verificationMapper;
    @Mock
    private UserConsentMapper consentMapper;
    @Mock
    private AltDataMapper altDataMapper;
    @Mock
    private SystemLogMapper systemLogMapper;

    private WithdrawalService service;
    private UserAccount account;

    @BeforeEach
    void setUp() {
        ConsentService consentService = new ConsentService(consentMapper, altDataMapper, new DataInputUsers(userMapper, UserFixtures.CLOCK));
        service = new WithdrawalService(userMapper, socialMapper, verificationMapper, consentService, UserFixtures.ENCODER, UserFixtures.CLOCK,
                new SystemLogService(systemLogMapper, TransactionOperations.withoutTransaction(), UserFixtures.CLOCK));
        account = UserFixtures.user(7L, "employee");
        given(userMapper.selectById(7L)).willReturn(account);
        given(userMapper.updateWithdrawn(anyLong(), any())).willReturn(1);
        given(consentMapper.selectAltConsents(7L)).willReturn(List.of());
    }

    private static MyPageDtos.Withdraw password(String value) {
        return new MyPageDtos.Withdraw(value);
    }

    @Test
    void wrongOrEmptyPasswordIs400OnPasswordFieldAndWritesNothing() {
        for (String wrong : new String[] { "wrong-pass1", "", null }) {
            assertThatThrownBy(() -> service.withdraw(7L, password(wrong), JUST_NOW))
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.getStatus().value()).isEqualTo(400);
                        assertThat(e.getCode()).isEqualTo("INVALID_PASSWORD");
                        assertThat(e.getMessage()).isEqualTo("비밀번호가 올바르지 않습니다.");
                        assertThat(e.getFieldErrors()).singleElement().satisfies(item -> {
                            assertThat(item.field()).isEqualTo("password");
                            assertThat(item.message()).isEqualTo("비밀번호가 올바르지 않습니다.");
                        });
                    });
        }
        verify(userMapper, never()).updateWithdrawn(anyLong(), any());
        verifyNoInteractions(socialMapper, verificationMapper, consentMapper, altDataMapper);
    }

    // PR #52 리뷰 7 — 비밀번호가 없는 간편 로그인 전용 계정은 비밀번호 대신 "토큰 발급 후 10분 이내"를 확인한다.
    @Test
    void socialOnlyAccountCanWithdrawWithin10MinutesOfLogin() {
        account.setPasswordHash(null);

        service.withdraw(7L, password(""), JUST_NOW.minus(Duration.ofMinutes(9)));

        verify(userMapper).updateWithdrawn(7L, NOW);
    }

    @Test
    void socialOnlyAccountAfter10MinutesIs403RecentLoginRequired() {
        account.setPasswordHash(null);

        for (Instant issuedAt : new Instant[] { JUST_NOW.minus(Duration.ofMinutes(11)), null }) {
            assertThatThrownBy(() -> service.withdraw(7L, password("anything"), issuedAt))
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.getStatus().value()).isEqualTo(403);
                        assertThat(e.getCode()).isEqualTo("RECENT_LOGIN_REQUIRED");
                        assertThat(e.getFieldErrors()).singleElement().satisfies(item -> {
                            assertThat(item.field()).isEqualTo("password");
                            assertThat(item.message()).isEqualTo("보안을 위해 간편 로그인으로 다시 로그인한 뒤 10분 안에 탈퇴해 주세요.");
                        });
                    });
        }
        verify(userMapper, never()).updateWithdrawn(anyLong(), any());
        verifyNoInteractions(socialMapper, verificationMapper, consentMapper, altDataMapper);
    }

    @Test
    void accountWithPasswordIgnoresLoginTimeAndChecksPassword() {
        // 비밀번호가 있는 계정은 지금처럼 비밀번호만 본다 — 로그인한 지 오래돼도 비밀번호가 맞으면 탈퇴된다.
        service.withdraw(7L, password(UserFixtures.PASSWORD), JUST_NOW.minus(Duration.ofHours(2)));
        verify(userMapper).updateWithdrawn(7L, NOW);
    }

    @Test
    void alreadyWithdrawnOrMissingAccountIs401() {
        account.setAccountStatusCode(UserAccount.WITHDRAWN);
        assertThatThrownBy(() -> service.withdraw(7L, password(UserFixtures.PASSWORD), JUST_NOW))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus().value()).isEqualTo(401));

        assertThatThrownBy(() -> service.withdraw(99L, password(UserFixtures.PASSWORD), JUST_NOW))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus().value()).isEqualTo(401));
        verify(userMapper, never()).updateWithdrawn(anyLong(), any());
    }

    @Test
    void deletesLinksAndVerificationByHmacReadBeforeOverwriteThenOverwritesPii() {
        String emailHmac = account.getEmailHmac();
        String phoneHmac = account.getPhoneHmac();

        service.withdraw(7L, password(UserFixtures.PASSWORD), JUST_NOW);

        // 순서: 회원 행 잠금(PR #52 리뷰 4·5) → 계정 읽기 → 불러온 데이터·동의 → 간편 로그인 연결 → 인증 기록(덮어쓰기 전 HMAC) → 개인정보 덮어쓰기.
        // 시각은 서버의 서울 시각.
        InOrder order = inOrder(consentMapper, socialMapper, verificationMapper, userMapper);
        order.verify(userMapper).lockUser(7L);
        order.verify(userMapper).selectById(7L);
        order.verify(consentMapper).selectAltConsents(7L);
        order.verify(socialMapper).deleteByUserId(7L);
        order.verify(verificationMapper).deleteForWithdrawal(7L, emailHmac, phoneHmac);
        order.verify(userMapper).updateWithdrawn(7L, NOW);
        // ASSESSMENT 등 딸린 데이터는 보관한다 — 회원 표는 잠금·읽기·탈퇴 표시 외에는 건드리지 않는다.
        verifyNoMoreInteractions(userMapper, socialMapper, verificationMapper);
    }

    // FP-80 N-28-1 회원 탈퇴를 시스템 로그(INFO)에 남긴다 — 아이디는 덮어쓰기 전 값을 가려서.
    @Test
    void withdrawalIsRecordedInSystemLogWithMaskedLoginId() {
        service.withdraw(7L, password(UserFixtures.PASSWORD), JUST_NOW);

        verify(systemLogMapper).insertLog(eq("INFO"), eq("member-service"),
                eq("회원 탈퇴 (em***)"), eq(7L), any());
    }

    @Test
    void accountWithoutPhoneDeletesVerificationByEmailHmacOnly() {
        account.setPhoneEnc(null);
        account.setPhoneHmac(null);

        service.withdraw(7L, password(UserFixtures.PASSWORD), JUST_NOW);

        verify(verificationMapper).deleteForWithdrawal(7L, account.getEmailHmac(), null);
    }

    @Test
    void altDataOfEveryConsentIsDeletedAndOpenConsentsGetWithdrawnAt() {
        ConsentRow active = consent(1L, 7L, AltDataKind.TELECOM, true);
        ConsentRow alreadyWithdrawn = consent(2L, 7L, AltDataKind.UTILITY, true);
        alreadyWithdrawn.setWithdrawnAt(NOW.minusDays(3));
        ConsentRow expired = consent(3L, 7L, AltDataKind.EASYPAY, true);
        expired.setExpiresAt(NOW.minusDays(1));
        given(consentMapper.selectAltConsents(7L)).willReturn(List.of(active, alreadyWithdrawn, expired));

        service.withdraw(7L, password(UserFixtures.PASSWORD), JUST_NOW);

        for (long consentId : new long[] { 1L, 2L, 3L }) {
            verify(altDataMapper).deleteTelecomByConsent(consentId);
            verify(altDataMapper).deleteUtilityByConsent(consentId);
            verify(altDataMapper).deleteEasypayByConsent(consentId);
            verify(altDataMapper).deleteInsuranceByConsent(consentId);
            verify(altDataMapper).deleteLoanByConsent(consentId);
            verify(altDataMapper).deleteCreditProfileByConsent(consentId);
        }
        verify(consentMapper).withdraw(1L, NOW);
        verify(consentMapper).withdraw(3L, NOW);
        verify(consentMapper, never()).withdraw(2L, NOW);
    }

    // ---- 매퍼 SQL 문 확인 ----

    @Test
    void withdrawnUpdateWritesExactlyTheCheckConstraintValues() throws IOException {
        String sql = statement("UserAccountMapper.xml", "updateWithdrawn");

        assertThat(sql).contains(
                "ACCOUNT_STATUS_CODE = 'WITHDRAWN'",
                "WITHDRAWN_AT = #{now}",
                "LOGIN_ID = 'wd_' || TO_CHAR(USER_ID)",
                "NICKNAME = '탈퇴' || TO_CHAR(USER_ID)",
                "NAME_ENC = 'WITHDRAWN'",
                "EMAIL_ENC = 'WITHDRAWN'",
                "EMAIL_HMAC = 'WITHDRAWN:' || TO_CHAR(USER_ID)",
                "PHONE_ENC = NULL",
                "PHONE_HMAC = NULL",
                "PASSWORD_HASH = NULL",
                "AND ACCOUNT_STATUS_CODE &lt;&gt; 'WITHDRAWN'");
        assertThat(sql).doesNotContain("DELETE");
    }

    @Test
    void signupVerificationWithoutUserIdIsDeletedBySameEmailHmac() throws IOException {
        // 가입 인증 기록은 USER_ID가 NULL이다 — USER_ID와 AND로 묶지 않고 OR로 HMAC을 따로 봐야 지워진다.
        String sql = statement("VerificationCodeMapper.xml", "deleteForWithdrawal").replaceAll("\\s+", " ");

        assertThat(sql).contains("WHERE USER_ID = #{userId} OR TARGET_HMAC = #{emailHmac}");
        assertThat(sql).contains("<if test=\"phoneHmac != null\"> OR TARGET_HMAC = #{phoneHmac} </if>");
        assertThat(sql).doesNotContain(" AND ");
    }

    @Test
    void withdrawalStatementsNeverTouchAssessment() throws IOException {
        List<String> statements = List.of(
                statement("UserAccountMapper.xml", "updateWithdrawn"),
                statement("UserSocialAccountMapper.xml", "deleteByUserId"),
                statement("VerificationCodeMapper.xml", "deleteForWithdrawal"),
                statement("UserConsentMapper.xml", "withdraw"),
                statement("AltDataMapper.xml", "deleteTelecomByConsent"),
                statement("AltDataMapper.xml", "deleteUtilityByConsent"),
                statement("AltDataMapper.xml", "deleteEasypayByConsent"),
                statement("AltDataMapper.xml", "deleteInsuranceByConsent"),
                statement("AltDataMapper.xml", "deleteLoanByConsent"),
                statement("AltDataMapper.xml", "deleteCreditProfileByConsent"));
        assertThat(statements).allSatisfy(sql -> assertThat(sql).doesNotContain("ASSESSMENT"));
        // 동의로 불러온 행만 지운다(직접 입력한 MANUAL 행은 CONSENT_ID가 NULL이라 걸리지 않는다).
        assertThat(statements.subList(4, 10)).allSatisfy(sql -> assertThat(sql).contains("CONSENT_ID = #{consentId}"));
    }

    // 매퍼 XML에서 id가 같은 SQL 문 하나(<update|delete|insert|select id="...">…</…>)를 꺼낸다.
    private static String statement(String fileName, String id) throws IOException {
        String xml = Files.readString(MAPPER_DIR.resolve(fileName));
        Matcher matcher = Pattern.compile("<(update|delete|insert|select) id=\"" + id + "\"[^>]*>(.*?)</\\1>", Pattern.DOTALL).matcher(xml);
        assertThat(matcher.find()).as(fileName + " " + id).isTrue();
        return matcher.group(2);
    }
}
