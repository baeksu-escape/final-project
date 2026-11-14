package com.baeksuescape.global.config;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

// FP-87 avenue.* 설정 — 인증·CORS·대안 데이터·개인정보 키 설정을 한곳에서 읽는다.
// 비밀값(JWT 키, AES·HMAC 키)은 application.properties에서 ${AVENUE_JWT_SECRET} 같은 환경변수로 채운다. 시작할 때 형식을 검사하고, 틀리면 값은 빼고 이름만 적은 오류로 멈춘다.
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "avenue")
public class AvenueProperties implements InitializingBean {

    private Auth auth = new Auth();
    private Cors cors = new Cors();
    private Altdata altdata = new Altdata();
    private Pii pii = new Pii();

    // 이메일 인증코드 보내는 방식. LOG: 서버 로그에만 남김(개발용) / FIXED: 정해진 코드 / SMTP: 실제 메일
    public enum EmailMode { LOG, FIXED, SMTP }

    // 소셜 로그인 방식. DEV: 개발용 가짜 제공자 / REAL: 실제 OAuth 제공자
    public enum SocialMode { DEV, REAL }

    // 더미 기관 응답에 회원 자료가 없을 때. EMPTY: 빈 결과 / BORROW: 다른 더미 회원 자료를 빌려 씀
    public enum MissingMemberMode { EMPTY, BORROW }

    @Getter
    @Setter
    public static class Auth {
        private Jwt jwt = new Jwt();
        private Email email = new Email();
        private Social social = new Social();
        // 다른 팀 경로를 인증 없이 임시로 열어 두는 목록. 그 팀이 로그인을 붙이면 인증 담당이 목록에서 뺀다.
        private List<String> temporaryOpenPaths = new ArrayList<>(List.of("/api/finance/**", "/api/diagnosis/**", "/api/simulation/**"));
    }

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long expiresMinutes = 60;
    }

    @Getter
    @Setter
    public static class Email {
        private EmailMode mode = EmailMode.LOG;
        private String fixedCode;
    }

    @Getter
    @Setter
    public static class Social {
        private SocialMode mode = SocialMode.DEV;
    }

    @Getter
    @Setter
    public static class Cors {
        private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:5173"));
    }

    @Getter
    @Setter
    public static class Altdata {
        private String sourceDir;
        private MissingMemberMode missingMemberMode = MissingMemberMode.EMPTY;
    }

    @Getter
    @Setter
    public static class Pii {
        private String aesKey;
        private String hmacKey;
    }

    // 설정을 읽은 직후 형식을 검사한다. 키 길이 규칙은 더미 시드 생성기(build_db.py load_keys)와 같다.
    @Override
    public void afterPropertiesSet() {
        jwtSecretBytes();
        byte[] aes = aesKeyBytes();
        byte[] hmac = hmacKeyBytes();
        if (java.security.MessageDigest.isEqual(aes, hmac)) {
            throw new IllegalStateException("avenue.pii.aes-key와 avenue.pii.hmac-key는 서로 달라야 합니다");
        }
        if (auth.getJwt().getExpiresMinutes() <= 0) {
            throw new IllegalStateException("avenue.auth.jwt.expires-minutes는 1 이상이어야 합니다");
        }
        if (auth.getEmail().getMode() == EmailMode.FIXED && isBlank(auth.getEmail().getFixedCode())) {
            throw new IllegalStateException("avenue.auth.email.mode=FIXED이면 avenue.auth.email.fixed-code가 필요합니다");
        }
    }

    // JWT 서명 키(Base64, 32바이트 이상).
    public byte[] jwtSecretBytes() {
        return decodeKey("avenue.auth.jwt.secret", "AVENUE_JWT_SECRET", auth.getJwt().getSecret(), 32, false);
    }

    // 개인정보 AES-256-GCM 키(Base64, 정확히 32바이트).
    public byte[] aesKeyBytes() {
        return decodeKey("avenue.pii.aes-key", "AVENUE_DEV_AES_KEY", pii.getAesKey(), 32, true);
    }

    // 개인정보 검색용 HMAC-SHA256 키(Base64, 32바이트 이상).
    public byte[] hmacKeyBytes() {
        return decodeKey("avenue.pii.hmac-key", "AVENUE_DEV_HMAC_KEY", pii.getHmacKey(), 32, false);
    }

    // Base64 키를 풀고 길이를 검사한다. 오류 문구에는 설정·환경변수 이름만 넣고 값은 넣지 않는다.
    private static byte[] decodeKey(String property, String envName, String value, int bytes, boolean exact) {
        String where = property + "(환경변수 " + envName + ")";
        if (isBlank(value)) {
            throw new IllegalStateException(where + " 값이 필요합니다");
        }
        byte[] key;
        try {
            key = Base64.getDecoder().decode(value.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(where + ": 올바른 Base64가 필요합니다");
        }
        if (exact ? key.length != bytes : key.length < bytes) {
            throw new IllegalStateException(where + ": " + bytes + (exact ? "바이트 키가 필요합니다" : "바이트 이상 키가 필요합니다"));
        }
        return key;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
