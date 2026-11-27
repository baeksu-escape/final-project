package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.UserFixtures.CLOCK;
import static com.baeksuescape.user.service.UserFixtures.CRYPTO;
import static com.baeksuescape.user.service.UserFixtures.ENCODER;
import static com.baeksuescape.user.service.UserFixtures.HMAC;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;

// FP-87 EmailVerificationService — 발송(중복 이메일·목적 짝), 확인(틀린 코드 횟수·5회·만료), 인증 토큰 한 번 쓰기.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EmailVerificationServiceTest {

    private static final String EMAIL = "newbie@example.com";
    private static final LocalDateTime NOW = LocalDateTime.now(CLOCK);

    @Mock
    private VerificationCodeMapper codeMapper;
    @Mock
    private UserAccountMapper userMapper;

    private final List<String> sentCodes = new ArrayList<>();
    private AvenueProperties properties;
    private VerificationTokenService tokenService;
    private EmailVerificationService service;

    @BeforeEach
    void setUp() {
        properties = TestKeys.properties();
        tokenService = new VerificationTokenService(properties, CLOCK);
        service = new EmailVerificationService(codeMapper, userMapper, tokenService, (email, code, purpose) -> sentCodes.add(code),
                ENCODER, HMAC, CRYPTO, properties, CLOCK);
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.getStatus().value() + " " + e.getCode();
        }
        return "no error";
    }

    private static VerificationCode row(long id, String purpose, String code, int attempts, LocalDateTime expiresAt) {
        VerificationCode row = new VerificationCode();
        row.setVerificationId(id);
        row.setPurposeCode(purpose);
        row.setTargetHmac(HMAC.email(EMAIL));
        row.setCodeHash(ENCODER.encode(code));
        row.setAttemptCount(attempts);
        row.setExpiresAt(expiresAt);
        return row;
    }

    // ---- AUTH-07 발송 ----

    @Test
    void 발송하면_해시와_HMAC만_저장하고_6자리_코드를_보낸다() {
        assertThat(service.send(new AuthRequests.EmailSend(EMAIL, "SIGNUP", null)).expiresInSeconds()).isEqualTo(300);
        ArgumentCaptor<VerificationCode> saved = ArgumentCaptor.forClass(VerificationCode.class);
        verify(codeMapper).insertCode(saved.capture());
        assertThat(sentCodes).hasSize(1);
        String code = sentCodes.get(0);
        assertThat(code).matches("^\\d{6}$");
        assertThat(saved.getValue().getPurposeCode()).isEqualTo("SIGNUP");
        assertThat(saved.getValue().getChannelCode()).isEqualTo("EMAIL");
        assertThat(saved.getValue().getTargetHmac()).isEqualTo(HMAC.email(EMAIL));
        assertThat(saved.getValue().getCodeHash()).isNotEqualTo(code);
        assertThat(ENCODER.matches(code, saved.getValue().getCodeHash())).isTrue();
        assertThat(saved.getValue().getExpiresAt()).isEqualTo(NOW.plusSeconds(300));
    }

    @Test
    void 가입과_이메일_변경은_이미_가입된_이메일이면_409_재설정은_항상_보낸다() {
        given(userMapper.countByEmailHmac(HMAC.email(EMAIL))).willReturn(1);
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(EMAIL, "SIGNUP", null)))).isEqualTo("409 DUPLICATE_EMAIL");
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(EMAIL, "CHANGE_EMAIL", null)))).isEqualTo("409 DUPLICATE_EMAIL");
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(EMAIL, "RESET_PASSWORD", "newbie01")))).isEqualTo("no error");
        ArgumentCaptor<VerificationCode> saved = ArgumentCaptor.forClass(VerificationCode.class);
        verify(codeMapper).insertCode(saved.capture());
        assertThat(saved.getValue().getPurposeCode()).isEqualTo("FIND_PASSWORD");
    }

    // FP-258 13차 N-02-3 같은 이메일로 오늘 0시부터 10회 보냈으면 429이고 보내지 않는다. 가입 여부와 상관없이 보내는 아이디 찾기(FIND_ID)도 같다.
    @Test
    void 같은_이메일로_오늘_10회_보냈으면_목적과_상관없이_429() {
        LocalDateTime today = LocalDateTime.now(CLOCK).toLocalDate().atStartOfDay();
        given(codeMapper.countSentSince("EMAIL", HMAC.email(EMAIL), today)).willReturn(10);
        for (String purpose : new String[] { "FIND_ID", "RESET_PASSWORD", "SIGNUP" }) {
            assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(EMAIL, purpose, "newbie01")))).as(purpose)
                    .isEqualTo("429 CODE_SEND_DAILY_LIMIT");
        }
        verify(codeMapper, never()).insertCode(any());
        assertThat(sentCodes).isEmpty();
    }

    @Test
    void 모르는_목적과_틀린_이메일_형식은_400() {
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(EMAIL, "UNKNOWN", null)))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend("not-an-email", "SIGNUP", null)))).isEqualTo("400 INVALID_INPUT");
    }

    // FP-258 이메일 규칙 — 한글·점 연속·처음/끝 점·허용하지 않는 기호·밑줄 도메인·짧은 최상위 도메인은 보내지 않고 400.
    @Test
    void 규칙에_맞지_않는_이메일은_발송하지_않고_400() {
        for (String email : new String[] { "홍길동@example.com", "newbie@예시.com", "a..b@example.com", ".ab@example.com", "ab.@example.com",
                "a+b@example.com", "ab@ex_ample.com", "ab@example-.com", "ab@example.c", "ab@@example.com" }) {
            assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(email, "SIGNUP", null)))).as(email).isEqualTo("400 INVALID_INPUT");
        }
        verify(codeMapper, never()).insertCode(any());
        assertThat(sentCodes).isEmpty();
    }

    // FP-258 PR #164 검수 — 새 이메일 규칙은 가입·이메일 변경만. 아이디·비밀번호 찾기는 + 같은 글자가 든 기존 이메일도 보내고, 기본 형식이 틀리면 400.
    @Test
    void 찾기와_재설정은_기존_이메일_형식도_보내고_가입과_변경은_새_규칙으로_막는다() {
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend(" A+B@Example.com ", "FIND_ID", null)))).isEqualTo("no error");
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend("a+b@example.com", "RESET_PASSWORD", "newbie01")))).isEqualTo("no error");
        assertThat(sentCodes).hasSize(2);
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend("a+b@example.com", "SIGNUP", null)))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend("a+b@example.com", "CHANGE_EMAIL", null)))).isEqualTo("400 INVALID_INPUT");
        assertThat(codeOf(() -> service.send(new AuthRequests.EmailSend("not-an-email", "FIND_ID", null)))).isEqualTo("400 INVALID_INPUT");
        assertThat(sentCodes).hasSize(2);
    }

    // FP-258 대문자·앞뒤 공백이 있는 이메일은 소문자로 바꿔 판정하고, 그 주소로 보낸다(HMAC도 같은 값).
    @Test
    void 대문자_이메일은_소문자로_바꿔_보낸다() {
        List<String> sentTo = new ArrayList<>();
        EmailVerificationService capturing = new EmailVerificationService(codeMapper, userMapper, tokenService,
                (email, code, purpose) -> sentTo.add(email), ENCODER, HMAC, CRYPTO, properties, CLOCK);
        capturing.send(new AuthRequests.EmailSend(" NewBie@Example.COM ", "SIGNUP", null));
        assertThat(sentTo).containsExactly(EMAIL);
        ArgumentCaptor<VerificationCode> saved = ArgumentCaptor.forClass(VerificationCode.class);
        verify(codeMapper).insertCode(saved.capture());
        assertThat(saved.getValue().getTargetHmac()).isEqualTo(HMAC.email(EMAIL));
    }

    // FP-258 재설정 목적의 이름 형식이 틀리면 코드를 보기 전에 400 name 칸이고, 시도 횟수를 올리지 않는다.
    @Test
    void 재설정_확인의_이름_형식이_틀리면_400_name_칸() {
        for (String name : new String[] { "hong", "홍 길동", "ㄱㄴ", "" }) {
            assertThatThrownBy(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "000000", "RESET_PASSWORD", "newbie01", name)))
                    .as(name)
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.getCode()).isEqualTo("INVALID_INPUT");
                        assertThat(e.getFieldErrors().get(0).field()).isEqualTo("name");
                    });
        }
        verify(codeMapper, never()).selectLatest(anyString(), anyString());
        verify(codeMapper, never()).increaseAttempt(anyLong());
    }

    @Test
    void FIXED_모드는_고정_코드를_쓴다() {
        properties.getAuth().getEmail().setMode(AvenueProperties.EmailMode.FIXED);
        properties.getAuth().getEmail().setFixedCode("111111");
        service.send(new AuthRequests.EmailSend(EMAIL, "SIGNUP", null));
        assertThat(sentCodes).containsExactly("111111");
    }

    // ---- AUTH-08 확인 ----

    @Test
    void 맞는_코드면_확인을_기록하고_인증_토큰을_준다() {
        given(codeMapper.selectLatest("SIGNUP", HMAC.email(EMAIL))).willReturn(row(5L, "SIGNUP", "123456", 0, NOW.plusMinutes(3)));
        String token = service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "SIGNUP", null, null)).verificationToken();
        assertThat(tokenService.parse(token)).contains(new VerificationTokenService.Claim(5L, "SIGNUP", HMAC.email(EMAIL)));
        verify(codeMapper).markVerified(eq(5L), isNull(), eq(NOW), eq(NOW.plusMinutes(10)));
    }

    @Test
    void 틀린_코드는_400이고_시도_횟수를_올린다() {
        given(codeMapper.selectLatest("SIGNUP", HMAC.email(EMAIL))).willReturn(row(5L, "SIGNUP", "123456", 0, NOW.plusMinutes(3)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "000000", "SIGNUP", null, null)))).isEqualTo("400 INVALID_VERIFICATION_CODE");
        verify(codeMapper).increaseAttempt(5L);
    }

    @Test
    void 다섯_번_틀린_코드와_만료된_코드와_이미_확인한_코드는_맞아도_400() {
        given(codeMapper.selectLatest("SIGNUP", HMAC.email(EMAIL))).willReturn(row(5L, "SIGNUP", "123456", 5, NOW.plusMinutes(3)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "SIGNUP", null, null)))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        given(codeMapper.selectLatest("SIGNUP", HMAC.email(EMAIL))).willReturn(row(6L, "SIGNUP", "123456", 0, NOW.minusSeconds(1)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "SIGNUP", null, null)))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        VerificationCode verified = row(7L, "SIGNUP", "123456", 0, NOW.plusMinutes(3));
        verified.setVerifiedAt(NOW.minusMinutes(1));
        given(codeMapper.selectLatest("SIGNUP", HMAC.email(EMAIL))).willReturn(verified);
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "SIGNUP", null, null)))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        verify(codeMapper, never()).increaseAttempt(anyLong());
        verify(codeMapper, never()).markVerified(anyLong(), any(), any(), any());
    }

    @Test
    void 재설정_목적은_아이디와_이메일과_이름이_같은_계정이_있어야_한다() {
        given(codeMapper.selectLatest("FIND_PASSWORD", HMAC.email(EMAIL))).willReturn(row(5L, "FIND_PASSWORD", "123456", 0, NOW.plusMinutes(3)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "RESET_PASSWORD", "nobody", "홍길동")))).isEqualTo("404 ACCOUNT_NOT_FOUND");

        given(userMapper.selectUserByLoginIdAndEmailHmac("newbie01", HMAC.email(EMAIL))).willReturn(UserFixtures.user(42L, "newbie01"));
        // FP-258 이름이 다르면 아이디·이메일이 맞아도 같은 404이고, 코드는 확인 처리되지 않는다.
        // FP-258 이름이 비었거나 형식이 틀리면(가입과 같은 규칙) 코드를 보기 전에 400 INVALID_INPUT(name 칸)이다.
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "RESET_PASSWORD", "newbie01", "김철수")))).isEqualTo("404 ACCOUNT_NOT_FOUND");
        assertThat(codeOf(() -> service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "RESET_PASSWORD", "newbie01", null)))).isEqualTo("400 INVALID_INPUT");
        verify(codeMapper, never()).markVerified(anyLong(), any(), any(), any());

        // FP-258 아이디·이메일은 소문자로 바꿔 찾는다.
        service.verify(new AuthRequests.EmailVerify(" NewBie@Example.com ", "123456", "RESET_PASSWORD", " NEWBIE01 ", "홍길동"));
        verify(codeMapper).markVerified(eq(5L), eq(42L), any(), any());
    }

    @Test
    void 아이디_찾기_목적은_가입_여부와_상관없이_보내고_확인에서_계정을_보지_않는다() {
        given(userMapper.countByEmailHmac(HMAC.email(EMAIL))).willReturn(1);
        service.send(new AuthRequests.EmailSend(EMAIL, "FIND_ID", null));
        ArgumentCaptor<VerificationCode> saved = ArgumentCaptor.forClass(VerificationCode.class);
        verify(codeMapper).insertCode(saved.capture());
        assertThat(saved.getValue().getPurposeCode()).isEqualTo("FIND_ID");
        assertThat(sentCodes).hasSize(1);

        given(codeMapper.selectLatest("FIND_ID", HMAC.email(EMAIL))).willReturn(row(7L, "FIND_ID", "123456", 0, NOW.plusMinutes(3)));
        assertThat(service.verify(new AuthRequests.EmailVerify(EMAIL, "123456", "FIND_ID", null, null)).verificationToken()).isNotBlank();
        verify(codeMapper).markVerified(eq(7L), isNull(), any(), any());
        verify(userMapper, never()).selectUserByLoginIdAndEmailHmac(any(), any());
    }

    // ---- 인증 토큰 한 번 쓰기 ----

    private VerificationCode verifiedRow(long id, String purpose, Long userId) {
        VerificationCode row = row(id, purpose, "123456", 0, NOW.plusMinutes(10));
        row.setVerifiedAt(NOW);
        row.setUserId(userId);
        return row;
    }

    @Test
    void 인증_토큰은_목적과_이메일이_같을_때_한_번만_쓴다() {
        String token = tokenService.issue(5L, "SIGNUP", HMAC.email(EMAIL));
        given(codeMapper.selectById(5L)).willReturn(verifiedRow(5L, "SIGNUP", null));
        given(codeMapper.consume(eq(5L), any())).willReturn(1, 0);

        assertThat(codeOf(() -> service.consume(token, EmailPurpose.SIGNUP, " Newbie@Example.com ", null))).isEqualTo("no error");
        assertThat(codeOf(() -> service.consume(token, EmailPurpose.SIGNUP, EMAIL, null))).isEqualTo("400 EMAIL_VERIFICATION_REQUIRED");
    }

    @Test
    void 다른_이메일_다른_목적_다른_계정_깨진_토큰은_쓰지_못한다() {
        String token = tokenService.issue(5L, "FIND_PASSWORD", HMAC.email(EMAIL));
        given(codeMapper.selectById(5L)).willReturn(verifiedRow(5L, "FIND_PASSWORD", 42L));
        given(codeMapper.consume(eq(5L), any())).willReturn(1);

        assertThat(codeOf(() -> service.consume(token, EmailPurpose.RESET_PASSWORD, "other@example.com", 42L))).isEqualTo("400 EMAIL_VERIFICATION_REQUIRED");
        assertThat(codeOf(() -> service.consume(token, EmailPurpose.SIGNUP, EMAIL, null))).isEqualTo("400 EMAIL_VERIFICATION_REQUIRED");
        assertThat(codeOf(() -> service.consume(token, EmailPurpose.RESET_PASSWORD, EMAIL, 43L))).isEqualTo("400 EMAIL_VERIFICATION_REQUIRED");
        assertThat(codeOf(() -> service.consume("broken", EmailPurpose.RESET_PASSWORD, EMAIL, 42L))).isEqualTo("400 EMAIL_VERIFICATION_REQUIRED");
        assertThat(codeOf(() -> service.consume(token, EmailPurpose.RESET_PASSWORD, EMAIL, 42L))).isEqualTo("no error");
    }
}
