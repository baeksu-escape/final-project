package com.baeksuescape.global.util;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.config.AvenueProperties;

// FP-87 N-02-4 개인정보 검색값 — 암호화와 다른 키의 HMAC-SHA256, 소문자 16진수 64자, 접두어 없음(APP_USER.EMAIL_HMAC·PHONE_HMAC).
// 정규화는 더미 시드 생성기(build_db.py search_hmac)와 같다: 이메일은 앞뒤 공백 제거 + 소문자, 휴대폰은 ASCII 숫자만 남긴다.
@Component
public class PiiHmac {

    private static final String ALGORITHM = "HmacSHA256";

    private final SecretKeySpec key;

    @Autowired
    public PiiHmac(AvenueProperties properties) {
        this(properties.hmacKeyBytes());
    }

    // 테스트에서 공개 테스트 키로 만들 때 쓴다.
    public PiiHmac(byte[] hmacKey) {
        if (hmacKey == null || hmacKey.length < 32) {
            throw new IllegalArgumentException("HMAC 키는 32바이트 이상이어야 합니다");
        }
        this.key = new SecretKeySpec(hmacKey, ALGORITHM);
    }

    // 이메일 검색값(가입 중복 확인·아이디 찾기). null이면 null.
    public String email(String email) {
        return email == null ? null : hmac(email.strip().toLowerCase(Locale.ROOT));
    }

    // 휴대폰 검색값(아이디 찾기). '010-1234-5678'과 '01012345678'은 같은 값이 된다. null이면 null.
    public String phone(String phone) {
        return phone == null ? null : hmac(phone.replaceAll("[^0-9]", ""));
    }

    private String hmac(String normalized) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            return HexFormat.of().formatHex(mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("검색값을 만들지 못했습니다");
        }
    }
}
