package com.baeksuescape.user.service;

import static com.baeksuescape.user.service.UserFixtures.CLOCK;
import static com.baeksuescape.user.service.UserFixtures.ENCODER;
import static com.baeksuescape.user.service.UserFixtures.PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-258 N-01-3 로그인 확인의 DB 부분 — 5분 제한 중에는 BCrypt 전에 막고, 성공 처리는 확인과 같은 행 잠금 안에서 한다(관리자는 2단계 인증 뒤).
// 매퍼는 가짜, 비밀번호 비교는 진짜 BCrypt를 감싼 모의 객체라 호출 횟수를 셀 수 있다.
class LoginAttemptServiceTest {

    private static final long USER_ID = 7L;
    private static final String LOGIN_ID = "member07";

    private UserAccountMapper userMapper;
    private PasswordEncoder encoder;
    private LoginAttemptService service;
    private UserAccount account;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserAccountMapper.class);
        encoder = mock(PasswordEncoder.class);
        given(encoder.matches(anyString(), anyString())).willAnswer(invocation -> ENCODER.matches(invocation.getArgument(0), invocation.getArgument(1)));
        service = new LoginAttemptService(userMapper, encoder, CLOCK);
        account = UserFixtures.user(USER_ID, LOGIN_ID);
        given(userMapper.selectByLoginId(LOGIN_ID)).willAnswer(invocation -> account);
        given(userMapper.selectById(USER_ID)).willAnswer(invocation -> account);
    }

    // 마지막 실패에서 minutesAgo분 지난 5회 실패 계정
    private void blockedSince(int minutesAgo) {
        account.setLoginFailCount(AuthService.TEMP_BLOCK_FAILURES);
        account.setLastLoginFailAt(LocalDateTime.now(CLOCK).minusMinutes(minutesAgo));
    }

    @Test
    void 제한_중이면_비밀번호를_비교하지_않고_BLOCKED이며_횟수를_바꾸지_않는다() {
        blockedSince(1);
        for (String password : new String[] { PASSWORD, "wrongpass1" }) {
            LoginAttemptService.Attempt attempt = service.attempt(LOGIN_ID, password, true);
            assertThat(attempt.outcome()).isEqualTo(LoginAttemptService.Outcome.BLOCKED);
            assertThat(attempt.blockedMinutes()).isEqualTo(4);
        }
        verify(encoder, never()).matches(anyString(), anyString());
        verify(userMapper, never()).updateLoginFailure(anyLong(), anyInt(), anyBoolean(), any());
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    @Test
    void 잠긴_계정은_지금처럼_비밀번호를_비교해_맞을_때만_LOCKED() {
        account.setAccountStatusCode(UserAccount.LOCKED);
        assertThat(service.attempt(LOGIN_ID, "wrongpass1", true).outcome()).isEqualTo(LoginAttemptService.Outcome.REJECTED);
        assertThat(service.attempt(LOGIN_ID, PASSWORD, true).outcome()).isEqualTo(LoginAttemptService.Outcome.LOCKED);
        verify(encoder, times(2)).matches(anyString(), anyString());
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    @Test
    void 제한이_끝난_뒤에는_비밀번호를_비교한다() {
        blockedSince(5);
        assertThat(service.attempt(LOGIN_ID, "wrongpass1", true).outcome()).isEqualTo(LoginAttemptService.Outcome.FAILED);
        verify(encoder).matches(anyString(), anyString());
    }

    @Test
    void 일반_회원_성공은_행을_잠근_뒤_같은_트랜잭션에서_실패_횟수를_0으로_만든다() {
        account.setLoginFailCount(9);
        LoginAttemptService.Attempt attempt = service.attempt(LOGIN_ID, PASSWORD, true);

        assertThat(attempt.outcome()).isEqualTo(LoginAttemptService.Outcome.SUCCESS);
        InOrder order = inOrder(userMapper);
        order.verify(userMapper).lockUser(USER_ID);
        order.verify(userMapper).updateLoginSuccess(eq(USER_ID), eq(LocalDateTime.now(CLOCK)));
    }

    @Test
    void 관리자와_성공_처리를_뒤로_미룬_확인은_attempt에서_초기화하지_않는다() {
        assertThat(service.attempt(LOGIN_ID, PASSWORD, false).outcome()).isEqualTo(LoginAttemptService.Outcome.SUCCESS);
        account.setRoleCode(UserAccount.ROLE_ADMIN);
        assertThat(service.attempt(LOGIN_ID, PASSWORD, true).outcome()).isEqualTo(LoginAttemptService.Outcome.SUCCESS);
        verify(userMapper, never()).updateLoginSuccess(anyLong(), any());
    }

    @Test
    void recordSuccess는_잠근_뒤_다시_읽어_잠겼으면_false이고_아니면_초기화한다() {
        assertThat(service.recordSuccess(USER_ID)).isTrue();
        InOrder order = inOrder(userMapper);
        order.verify(userMapper).lockUser(USER_ID);
        order.verify(userMapper).selectById(USER_ID);
        order.verify(userMapper).updateLoginSuccess(eq(USER_ID), any());

        account.setAccountStatusCode(UserAccount.LOCKED);
        assertThat(service.recordSuccess(USER_ID)).isFalse();
        verify(userMapper).updateLoginSuccess(eq(USER_ID), any());
    }
}
