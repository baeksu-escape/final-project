package com.baeksuescape.user.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.UserAccount;

// FP-87 회원 서비스 테스트용 합성 계정·도구(공개 테스트 키). 실제 개인정보가 아니다.
final class UserFixtures {

    // 2026-11-14 12:00 (서울). 올해 기준 가입 가능 출생연도 상한은 2006.
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-14T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    static final PiiCrypto CRYPTO = new PiiCrypto(TestKeys.AES);
    static final PiiHmac HMAC = new PiiHmac(TestKeys.HMAC);
    // 테스트를 빠르게 하려고 cost를 낮춘 BCrypt(형식은 같다).
    static final PasswordEncoder ENCODER = new BCryptPasswordEncoder(4);
    static final String PASSWORD = "demo1234";

    private UserFixtures() {
    }

    static UserAccount account(long userId, String loginId, String role, String status) {
        UserAccount account = new UserAccount();
        account.setUserId(userId);
        account.setLoginId(loginId);
        account.setPasswordHash(ENCODER.encode(PASSWORD));
        account.setNickname("닉" + loginId);
        account.setNameEnc(CRYPTO.encrypt("홍길동"));
        account.setPhoneEnc(CRYPTO.encrypt("01012345678"));
        account.setPhoneHmac(HMAC.phone("01012345678"));
        account.setEmailEnc(CRYPTO.encrypt(loginId + "@example.com"));
        account.setEmailHmac(HMAC.email(loginId + "@example.com"));
        account.setBirthYear(1990);
        account.setWorkerTypeCode("EMPLOYEE");
        account.setRoleCode(role);
        account.setAccountStatusCode(status);
        account.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));
        return account;
    }

    static UserAccount user(long userId, String loginId) {
        return account(userId, loginId, UserAccount.ROLE_USER, UserAccount.ACTIVE);
    }
}
