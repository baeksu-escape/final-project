package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.log.SystemLogService;
import com.baeksuescape.user.dto.MyPageDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.mapper.UserSocialAccountMapper;
import com.baeksuescape.user.mapper.VerificationCodeMapper;

// FP-93 N-04-7 회원 탈퇴(MEM-07) — 상태 변경 방식(DDL v0.3.2 W1). 회원 행과 진단 내역(ASSESSMENT) 등 딸린 데이터는 남긴다.
// 한 트랜잭션에서 ① 동의로 불러온 대안 데이터 삭제·동의 철회 ② 간편 로그인 연결 삭제 ③ 인증 기록 삭제 ④ 개인정보 덮어쓰기 순서로 처리한다.
@Service
public class WithdrawalService {

    // 프론트 myPageMockHandlers.js의 탈퇴 비밀번호 오류 문구와 같다. code는 MEM-02와 같은 INVALID_PASSWORD.
    static final String WRONG_PASSWORD_MESSAGE = "비밀번호가 올바르지 않습니다.";
    // 간편 로그인 전용 계정 탈퇴 — 비밀번호 대신 "로그인한 지 10분 이내"를 확인한다(팀 결정, PR #52 리뷰 7).
    // TODO(2차: 간편 로그인 재인증 화면) 탈퇴 직전에 간편 로그인으로 다시 인증하는 화면이 생기면 그 확인으로 바꾼다.
    static final Duration RECENT_LOGIN_WINDOW = Duration.ofMinutes(10);
    static final String RECENT_LOGIN_REQUIRED = "RECENT_LOGIN_REQUIRED";
    static final String RECENT_LOGIN_MESSAGE = "보안을 위해 간편 로그인으로 다시 로그인한 뒤 10분 안에 탈퇴해 주세요.";

    private final UserAccountMapper userMapper;
    private final UserSocialAccountMapper socialMapper;
    private final VerificationCodeMapper verificationMapper;
    private final ConsentService consentService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final SystemLogService systemLog;

    public WithdrawalService(UserAccountMapper userMapper, UserSocialAccountMapper socialMapper, VerificationCodeMapper verificationMapper,
            ConsentService consentService, PasswordEncoder passwordEncoder, Clock clock, SystemLogService systemLog) {
        this.userMapper = userMapper;
        this.socialMapper = socialMapper;
        this.verificationMapper = verificationMapper;
        this.consentService = consentService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.systemLog = systemLog;
    }

    // MEM-07 탈퇴 — 비밀번호가 있는 계정은 비밀번호를 확인한다.
    // 간편 로그인 전용 계정(PASSWORD_HASH NULL)은 비밀번호 대신 최근 로그인을 확인한다: 이 요청 토큰의 발급 시각(issuedAt)이 10분 이내여야 한다(PR #52 리뷰 7).
    // 맨 앞에서 회원 행을 잠가 같은 회원의 다른 쓰기(불러오기·입력 저장)와 겹치지 않게 한다. 성공하면 같은 토큰은 JWT 필터가 401로 막는다.
    @Transactional
    public void withdraw(long userId, MyPageDtos.Withdraw request, Instant issuedAt) {
        userMapper.lockUser(userId);
        UserAccount account = userMapper.selectById(userId);
        if (account == null || account.isWithdrawn()) throw unauthorized();
        if (account.getPasswordHash() != null) {
            if (!passwordMatches(account, request == null ? null : request.password())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", WRONG_PASSWORD_MESSAGE,
                        List.of(new FieldErrorItem("password", WRONG_PASSWORD_MESSAGE)));
            }
        } else if (!isRecentLogin(issuedAt)) {
            // 화면은 password 칸 오류로 보여 준다(403은 로그아웃을 일으키지 않는다).
            throw new ApiException(HttpStatus.FORBIDDEN, RECENT_LOGIN_REQUIRED, RECENT_LOGIN_MESSAGE,
                    List.of(new FieldErrorItem("password", RECENT_LOGIN_MESSAGE)));
        }
        // 인증 기록을 HMAC으로 찾으려면 덮어쓰기 전의 값이 필요하다 — 위에서 읽은 계정 값을 쓴다.
        String emailHmac = account.getEmailHmac();
        String phoneHmac = account.getPhoneHmac();
        LocalDateTime now = LocalDateTime.now(clock);

        consentService.withdrawAllForLeave(userId, now);
        socialMapper.deleteByUserId(userId);
        verificationMapper.deleteForWithdrawal(userId, emailHmac, phoneHmac);
        if (userMapper.updateWithdrawn(userId, now) == 0) throw unauthorized();
        // FP-80 N-28-1 회원 탈퇴 기록(INFO). 아이디는 덮어쓰기 전 값을 가려서 남긴다.
        systemLog.record(SystemLogService.Type.INFO, "member-service", "회원 탈퇴 (" + SystemLogService.maskLoginId(account.getLoginId()) + ")", userId);
    }

    // 토큰 발급 후 RECENT_LOGIN_WINDOW 안이면 최근 로그인으로 본다. 발급 시각을 모르면 아니라고 본다.
    private boolean isRecentLogin(Instant issuedAt) {
        return issuedAt != null && Duration.between(issuedAt, clock.instant()).compareTo(RECENT_LOGIN_WINDOW) <= 0;
    }

    private boolean passwordMatches(UserAccount account, String password) {
        return password != null && !password.isEmpty() && passwordEncoder.matches(password, account.getPasswordHash());
    }

    private static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
    }
}
