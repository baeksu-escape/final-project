package com.baeksuescape.user;

import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.global.util.PiiHmac;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

/**
 * FP-258 db.it 통합 시험이 함께 쓰는 시험 계정(qa1127it 접두어) 만들기·지우기.
 * 여러 스레드가 각자 트랜잭션으로 읽어야 해서 계정을 커밋하므로, 시험 앞뒤로 deleteAll을 부른다.
 */
public final class QaItAccounts {

    public static final String LOGIN_ID_PREFIX = "qa1127it";
    public static final String PASSWORD = "qatest1127it";

    private QaItAccounts() {
    }

    public static void deleteAll(JdbcTemplate jdbc) {
        jdbc.update("DELETE FROM APP_USER WHERE LOGIN_ID LIKE '" + LOGIN_ID_PREFIX + "%'");
    }

    // 실패 0회 일반 회원 하나를 만든다(비밀번호 PASSWORD).
    public static UserAccount create(UserAccountMapper userMapper, PasswordEncoder passwordEncoder, PiiCrypto crypto, PiiHmac hmac) {
        String suffix = String.valueOf(ThreadLocalRandom.current().nextInt(1000, 10000));
        String email = LOGIN_ID_PREFIX + suffix + "@test.local";
        UserAccount account = new UserAccount();
        account.setLoginId(LOGIN_ID_PREFIX + suffix);
        account.setPasswordHash(passwordEncoder.encode(PASSWORD));
        account.setNickname("qit" + suffix);
        account.setNameEnc(crypto.encrypt("큐에이"));
        account.setEmailEnc(crypto.encrypt(email));
        account.setEmailHmac(hmac.email(email));
        account.setBirthYear(1995);
        account.setCreatedAt(LocalDateTime.now());
        userMapper.insertUser(account);
        return account;
    }
}
