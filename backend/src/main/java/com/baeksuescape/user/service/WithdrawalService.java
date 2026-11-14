package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
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

    private final UserAccountMapper userMapper;
    private final UserSocialAccountMapper socialMapper;
    private final VerificationCodeMapper verificationMapper;
    private final ConsentService consentService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public WithdrawalService(UserAccountMapper userMapper, UserSocialAccountMapper socialMapper, VerificationCodeMapper verificationMapper,
            ConsentService consentService, PasswordEncoder passwordEncoder, Clock clock) {
        this.userMapper = userMapper;
        this.socialMapper = socialMapper;
        this.verificationMapper = verificationMapper;
        this.consentService = consentService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    // MEM-07 탈퇴 — 비밀번호가 있는 계정은 비밀번호를 확인한다. 간편 로그인 전용 계정(PASSWORD_HASH NULL)은 확인을 건너뛴다.
    // 성공하면 같은 토큰은 JWT 필터가 WITHDRAWN을 보고 401로 막는다.
    @Transactional
    public void withdraw(long userId, MyPageDtos.Withdraw request) {
        UserAccount account = userMapper.selectById(userId);
        if (account == null || account.isWithdrawn()) throw unauthorized();
        if (account.getPasswordHash() != null && !passwordMatches(account, request == null ? null : request.password())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", WRONG_PASSWORD_MESSAGE,
                    List.of(new FieldErrorItem("password", WRONG_PASSWORD_MESSAGE)));
        }
        // 인증 기록을 HMAC으로 찾으려면 덮어쓰기 전의 값이 필요하다 — 위에서 읽은 계정 값을 쓴다.
        String emailHmac = account.getEmailHmac();
        String phoneHmac = account.getPhoneHmac();
        LocalDateTime now = LocalDateTime.now(clock);

        consentService.withdrawAllForLeave(userId, now);
        socialMapper.deleteByUserId(userId);
        verificationMapper.deleteForWithdrawal(userId, emailHmac, phoneHmac);
        if (userMapper.updateWithdrawn(userId, now) == 0) throw unauthorized();
    }

    private boolean passwordMatches(UserAccount account, String password) {
        return password != null && !password.isEmpty() && passwordEncoder.matches(password, account.getPasswordHash());
    }

    private static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
    }
}
