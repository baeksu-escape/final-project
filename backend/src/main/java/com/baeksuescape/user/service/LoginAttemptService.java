package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-258 N-01-3 로그인 확인의 DB 부분 — 계정 조회·행 잠금·실패 횟수 갱신만 자기 트랜잭션에서 하고 결과를 돌려준다.
// 로그·오류 응답은 AuthService.authenticate가 커넥션을 돌려준 뒤 처리한다(잠근 채 로그가 커넥션을 더 기다리면 몰린 요청이 풀을 바닥낸다).
@Service
public class LoginAttemptService {

    // 확인 결과. SUCCESS 말고는 모두 로그인 실패이고, 무엇을 알릴지는 AuthService가 정한다.
    public enum Outcome {
        SUCCESS,
        REJECTED,      // 없는 계정·탈퇴·비밀번호 없는 계정, 잠긴 계정의 틀린 비밀번호 → 401(횟수 안 셈)
        LOCKED,        // 잠긴 계정의 맞는 비밀번호 → 423
        BLOCKED,       // 5분 제한 중(비밀번호와 상관없이) → 429(횟수 안 셈)
        FAILED,        // 틀린 비밀번호, 횟수를 올림 → 401
        TEMP_BLOCKED,  // 이번이 5회째 → 429(5분 제한 시작)
        AUTO_LOCKED    // 이번이 10회째 → 잠금, 423
    }

    // account: 찾은 계정(REJECTED면 없을 수 있음), failures: 이번에 저장한 실패 횟수, blockedMinutes: 5분 제한의 남은 분.
    public record Attempt(Outcome outcome, UserAccount account, int failures, long blockedMinutes) {
    }

    private final UserAccountMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public LoginAttemptService(UserAccountMapper userMapper, PasswordEncoder passwordEncoder, Clock clock) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    // 같은 계정 행을 잠근(lockUser, 1차 캐시도 비움) 뒤 다시 읽은 횟수로 판단한다. 동시에 보낸 로그인은 커밋까지 줄을 서므로 횟수가 덜 오르지 않는다(FP-290).
    // 예외를 던지지 않고 결과만 돌려주므로 실패 횟수 갱신은 늘 커밋된다.
    @Transactional
    public Attempt attempt(String loginId, String password) {
        // FP-258 가입 아이디는 소문자만 받으므로 소문자로 바꿔 조회한다.
        String normalizedLoginId = AccountRules.normalizeLoginId(loginId);
        UserAccount account = userMapper.selectByLoginId(normalizedLoginId);
        if (account == null) return new Attempt(Outcome.REJECTED, null, 0, 0);
        userMapper.lockUser(account.getUserId());
        account = userMapper.selectByLoginId(normalizedLoginId);
        if (account == null || account.isWithdrawn() || account.getPasswordHash() == null) return new Attempt(Outcome.REJECTED, account, 0, 0);
        boolean passwordMatches = passwordEncoder.matches(password, account.getPasswordHash());
        if (account.isLocked()) return new Attempt(passwordMatches ? Outcome.LOCKED : Outcome.REJECTED, account, 0, 0);
        LocalDateTime now = LocalDateTime.now(clock);
        long blockedMinutes = remainingBlockMinutes(account, now);
        if (blockedMinutes > 0) return new Attempt(Outcome.BLOCKED, account, account.getLoginFailCount(), blockedMinutes);
        if (passwordMatches) return new Attempt(Outcome.SUCCESS, account, account.getLoginFailCount(), 0);

        int failures = account.getLoginFailCount() + 1;
        boolean lock = failures >= AuthService.MAX_LOGIN_FAILURES;
        userMapper.updateLoginFailure(account.getUserId(), failures, lock, now);
        if (lock) return new Attempt(Outcome.AUTO_LOCKED, account, failures, 0);
        if (failures == AuthService.TEMP_BLOCK_FAILURES) return new Attempt(Outcome.TEMP_BLOCKED, account, failures, AuthService.TEMP_BLOCK_MINUTES);
        return new Attempt(Outcome.FAILED, account, failures, 0);
    }

    // FP-258 5분 제한의 남은 분(올림). 실패가 정확히 5회이고 마지막 실패 시각(LAST_LOGIN_FAIL_AT)에서 5분이 안 지났을 때만 0보다 크다.
    private static long remainingBlockMinutes(UserAccount account, LocalDateTime now) {
        if (account.getLoginFailCount() != AuthService.TEMP_BLOCK_FAILURES || account.getLastLoginFailAt() == null) return 0;
        long seconds = Duration.between(now, account.getLastLoginFailAt().plusMinutes(AuthService.TEMP_BLOCK_MINUTES)).getSeconds();
        if (seconds <= 0) return 0;
        return (seconds + 59) / 60;
    }
}
