package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.UserFixtures.CLOCK;
import static com.baeksuescape.user.service.UserFixtures.ENCODER;
import static com.baeksuescape.user.service.UserFixtures.HMAC;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.AuthRequests;
import com.baeksuescape.user.dto.AuthResponses;
import com.baeksuescape.user.dto.VerificationCode;
import com.baeksuescape.user.mapper.VerificationCodeMapper;
import com.baeksuescape.user.service.phone.FixedPhoneCodeSender;
import com.baeksuescape.user.service.phone.LogPhoneCodeSender;

// N-02 PhoneVerificationService(11/18 1차 시연 후속) — 발송(PHONE 행·HMAC·해시만 저장), 확인(틀린 코드·만료·5회), 인증 토큰 한 번 쓰기,
// 그리고 발송 로그에 번호 원문이 남지 않는지. DB는 mock으로 대신한다. 번호는 합성 값이다.
@ExtendWith({ MockitoExtension.class, OutputCaptureExtension.class })
@MockitoSettings(strictness = Strictness.LENIENT)
class PhoneVerificationServiceTest {

    private static final String PHONE = "01012345678";
    private static final LocalDateTime NOW = LocalDateTime.now(CLOCK);

    @Mock
    private VerificationCodeMapper codeMapper;

    private final List<String> sentCodes = new ArrayList<>();
    private AvenueProperties properties;
    private VerificationTokenService tokenService;
    private PhoneVerificationService service;

    @BeforeEach
    void setUp() {
        properties = TestKeys.properties();
        tokenService = new VerificationTokenService(properties, CLOCK);
        service = new PhoneVerificationService(codeMapper, tokenService, (phone, code, purpose) -> sentCodes.add(code), ENCODER, HMAC, properties, CLOCK);
    }

    private static String codeOf(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            String field = e.getFieldErrors() == null || e.getFieldErrors().isEmpty() ? "" : " " + e.getFieldErrors().get(0).field();
            return e.getStatus().value() + " " + e.getCode() + field;
        }
        return "no error";
    }

    private static VerificationCode row(long id, String code, int attempts, LocalDateTime expiresAt) {
        VerificationCode row = new VerificationCode();
        row.setVerificationId(id);
        row.setPurposeCode("SIGNUP");
        row.setChannelCode("PHONE");
        row.setTargetHmac(HMAC.phone(PHONE));
        row.setCodeHash(ENCODER.encode(code));
        row.setAttemptCount(attempts);
        row.setExpiresAt(expiresAt);
        return row;
    }

    // ---- 발송 ----

    @Test
    void 발송하면_PHONE_행에_HMAC과_해시만_저장하고_응답에는_유효_시간만_있다() {
        AuthResponses.PhoneSent result = service.send(new AuthRequests.PhoneSend("010-1234-5678", "SIGNUP"));

        assertThat(result.expiresInSeconds()).isEqualTo(300);
        assertThat(result.toString()).doesNotContain(PHONE).doesNotContain("5678");
        ArgumentCaptor<VerificationCode> saved = ArgumentCaptor.forClass(VerificationCode.class);
        verify(codeMapper).insertCode(saved.capture());
        String code = sentCodes.get(0);
        assertThat(code).matches("^\\d{6}$");
        assertThat(result.toString()).doesNotContain(code);
        VerificationCode value = saved.getValue();
        assertThat(value.getChannelCode()).isEqualTo("PHONE");
        assertThat(value.getPurposeCode()).isEqualTo("SIGNUP");
        assertThat(value.getTargetHmac()).isEqualTo(HMAC.phone(PHONE)).doesNotContain(PHONE);
        assertThat(value.getCodeHash()).isNotEqualTo(code);
        assertThat(ENCODER.matches(code, value.getCodeHash())).isTrue();
        assertThat(value.getExpiresAt()).isEqualTo(NOW.plusSeconds(300));
    }

    @Test
    void 번호_형식이_틀리거나_목적을_모르면_400() {
        assertThat(codeOf(() -> service.send(new AuthRequests.PhoneSend("02-123-4567", "SIGNUP")))).isEqualTo("400 INVALID_INPUT phone");
        assertThat(codeOf(() -> service.send(new AuthRequests.PhoneSend(PHONE, "RESET_PASSWORD")))).isEqualTo("400 INVALID_INPUT purpose");
        verify(codeMapper, never()).insertCode(any());
    }

    @Test
    void FIXED_모드는_고정_번호를_쓴다() {
        properties.getAuth().getPhone().setMode(AvenueProperties.PhoneMode.FIXED);
        properties.getAuth().getPhone().setFixedCode("111111");
        service.send(new AuthRequests.PhoneSend(PHONE, "SIGNUP"));
        assertThat(sentCodes).containsExactly("111111");
    }

    @Test
    void LOG_발송자는_가린_번호만_남기고_FIXED_발송자는_코드를_남기지_않는다(CapturedOutput output) {
        new LogPhoneCodeSender().send(PHONE, "482913", "SIGNUP");
        assertThat(output.getAll()).contains("[개발용 휴대폰 인증코드] 번호=010-****-5678 목적=SIGNUP 코드=482913").doesNotContain(PHONE);

        new FixedPhoneCodeSender().send("01099998888", "730519", "SIGNUP");
        assertThat(output.getAll()).contains("010-****-8888").doesNotContain("01099998888").doesNotContain("730519");
    }

    // ---- 확인 ----

    @Test
    void 맞는_코드면_확인을_기록하고_휴대폰_인증_토큰을_준다() {
        given(codeMapper.selectLatest("SIGNUP", HMAC.phone(PHONE))).willReturn(row(5L, "123456", 0, NOW.plusMinutes(3)));
        String token = service.verify(new AuthRequests.PhoneVerify("010-1234-5678", "123456", "SIGNUP")).verificationToken();
        assertThat(tokenService.parsePhone(token)).contains(new VerificationTokenService.Claim(5L, "SIGNUP", HMAC.phone(PHONE)));
        // 이메일 인증 토큰으로는 읽히지 않는다(종류가 다르다).
        assertThat(tokenService.parse(token)).isEmpty();
        verify(codeMapper).markVerified(eq(5L), isNull(), eq(NOW), eq(NOW.plusMinutes(10)));
    }

    @Test
    void 틀린_코드는_400이고_시도_횟수를_올린다() {
        given(codeMapper.selectLatest("SIGNUP", HMAC.phone(PHONE))).willReturn(row(5L, "123456", 0, NOW.plusMinutes(3)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.PhoneVerify(PHONE, "000000", "SIGNUP")))).isEqualTo("400 INVALID_VERIFICATION_CODE");
        verify(codeMapper).increaseAttempt(5L);
    }

    @Test
    void 다섯_번_틀린_코드와_만료된_코드와_이미_확인한_코드와_이메일_행은_맞아도_400() {
        given(codeMapper.selectLatest("SIGNUP", HMAC.phone(PHONE))).willReturn(row(5L, "123456", 5, NOW.plusMinutes(3)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.PhoneVerify(PHONE, "123456", "SIGNUP")))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        given(codeMapper.selectLatest("SIGNUP", HMAC.phone(PHONE))).willReturn(row(6L, "123456", 0, NOW.minusSeconds(1)));
        assertThat(codeOf(() -> service.verify(new AuthRequests.PhoneVerify(PHONE, "123456", "SIGNUP")))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        VerificationCode verified = row(7L, "123456", 0, NOW.plusMinutes(3));
        verified.setVerifiedAt(NOW.minusMinutes(1));
        given(codeMapper.selectLatest("SIGNUP", HMAC.phone(PHONE))).willReturn(verified);
        assertThat(codeOf(() -> service.verify(new AuthRequests.PhoneVerify(PHONE, "123456", "SIGNUP")))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        VerificationCode emailRow = row(8L, "123456", 0, NOW.plusMinutes(3));
        emailRow.setChannelCode("EMAIL");
        given(codeMapper.selectLatest("SIGNUP", HMAC.phone(PHONE))).willReturn(emailRow);
        assertThat(codeOf(() -> service.verify(new AuthRequests.PhoneVerify(PHONE, "123456", "SIGNUP")))).isEqualTo("400 INVALID_VERIFICATION_CODE");

        verify(codeMapper, never()).increaseAttempt(anyLong());
        verify(codeMapper, never()).markVerified(anyLong(), any(), any(), any());
    }

    // ---- 인증 토큰 한 번 쓰기 ----

    private VerificationCode verifiedRow(long id) {
        VerificationCode row = row(id, "123456", 0, NOW.plusMinutes(10));
        row.setVerifiedAt(NOW);
        return row;
    }

    @Test
    void 휴대폰_인증_토큰은_같은_번호일_때_한_번만_쓴다() {
        String token = tokenService.issuePhone(5L, "SIGNUP", HMAC.phone(PHONE));
        given(codeMapper.selectById(5L)).willReturn(verifiedRow(5L));
        given(codeMapper.consume(eq(5L), any())).willReturn(1, 0);

        assertThat(codeOf(() -> service.consume(token, PhonePurpose.SIGNUP, "010-1234-5678"))).isEqualTo("no error");
        assertThat(codeOf(() -> service.consume(token, PhonePurpose.SIGNUP, PHONE))).isEqualTo("400 INVALID_INPUT phone");
    }

    @Test
    void 다른_번호의_토큰_이메일_인증_토큰_깨진_토큰_빈_토큰은_쓰지_못한다() {
        given(codeMapper.selectById(5L)).willReturn(verifiedRow(5L));
        given(codeMapper.consume(eq(5L), any())).willReturn(1);

        String otherPhone = tokenService.issuePhone(5L, "SIGNUP", HMAC.phone("01099998888"));
        assertThat(codeOf(() -> service.consume(otherPhone, PhonePurpose.SIGNUP, PHONE))).isEqualTo("400 INVALID_INPUT phone");

        // 이메일 인증 토큰(같은 vid·같은 목적·심지어 같은 대상값이어도)은 종류가 달라 휴대폰 인증으로 쓸 수 없다.
        String emailToken = tokenService.issue(5L, "SIGNUP", HMAC.phone(PHONE));
        assertThat(codeOf(() -> service.consume(emailToken, PhonePurpose.SIGNUP, PHONE))).isEqualTo("400 INVALID_INPUT phone");

        assertThat(codeOf(() -> service.consume("broken", PhonePurpose.SIGNUP, PHONE))).isEqualTo("400 INVALID_INPUT phone");
        assertThat(codeOf(() -> service.consume(null, PhonePurpose.SIGNUP, PHONE))).isEqualTo("400 INVALID_INPUT phone");
        verify(codeMapper, never()).consume(anyLong(), any());

        String ok = tokenService.issuePhone(5L, "SIGNUP", HMAC.phone(PHONE));
        assertThat(codeOf(() -> service.consume(ok, PhonePurpose.SIGNUP, PHONE))).isEqualTo("no error");
    }

    @Test
    void 이메일_채널_행을_가리키는_휴대폰_토큰은_쓰지_못한다() {
        VerificationCode emailRow = verifiedRow(9L);
        emailRow.setChannelCode("EMAIL");
        given(codeMapper.selectById(9L)).willReturn(emailRow);
        String token = tokenService.issuePhone(9L, "SIGNUP", HMAC.phone(PHONE));
        assertThat(codeOf(() -> service.consume(token, PhonePurpose.SIGNUP, PHONE))).isEqualTo("400 INVALID_INPUT phone");
        verify(codeMapper, never()).consume(anyLong(), any());
    }
}
