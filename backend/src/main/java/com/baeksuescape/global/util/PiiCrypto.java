package com.baeksuescape.global.util;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.config.AvenueProperties;

// FP-87 N-02-4 개인정보 암호화 — 이름·휴대폰·이메일을 AES-256-GCM으로 암호화한다(DDL v0.3.1 E1·E2, dummy_db README "백엔드 전달용 개인정보 규격").
// 저장값: "v1:" + Base64(12바이트 난수 IV + 암호문 + 16바이트 태그). AAD 없음. 더미 시드 생성기(build_db.py encrypt_text·decrypt_text)와 같은 형식이다.
// 오류 문구에는 원문·암호문·키를 넣지 않는다.
@Component
public class PiiCrypto {

    // 지금 암호화에 쓰는 키 버전. 키를 바꾸면 새 버전을 추가하고 옛 버전은 복호화용으로 남긴다.
    static final String CURRENT_VERSION = "v1";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private final Map<String, SecretKeySpec> keysByVersion;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    public PiiCrypto(AvenueProperties properties) {
        this(properties.aesKeyBytes());
    }

    // 테스트에서 공개 테스트 키로 만들 때 쓴다.
    public PiiCrypto(byte[] aesKey) {
        if (aesKey == null || aesKey.length != 32) {
            throw new IllegalArgumentException("AES-256-GCM에는 32바이트 키가 필요합니다");
        }
        this.keysByVersion = Map.of(CURRENT_VERSION, new SecretKeySpec(aesKey, "AES"));
    }

    // 원문을 암호화한다. null이면 null(휴대폰처럼 비어 있을 수 있는 칸).
    public String encrypt(String plain) {
        if (plain == null) return null;
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, keysByVersion.get(CURRENT_VERSION), new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = ByteBuffer.allocate(IV_BYTES + sealed.length).put(iv).put(sealed).array();
            return CURRENT_VERSION + ":" + Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("개인정보를 암호화하지 못했습니다");
        }
    }

    // 저장값을 복호화한다. null이면 null. 첫 ':' 앞의 버전으로 키를 고르고, 모르는 버전·접두어 없음·변조된 값은 오류로 멈춘다.
    public String decrypt(String stored) {
        if (stored == null) return null;
        int colon = stored.indexOf(':');
        SecretKeySpec key = colon > 0 ? keysByVersion.get(stored.substring(0, colon)) : null;
        if (key == null) {
            throw new IllegalArgumentException("알 수 없는 암호문 키 버전입니다");
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(stored.substring(colon + 1));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("암호문 형식이 올바르지 않습니다");
        }
        if (raw.length <= IV_BYTES) throw new IllegalArgumentException("암호문 길이가 올바르지 않습니다");
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, raw, 0, IV_BYTES));
            return new String(cipher.doFinal(raw, IV_BYTES, raw.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("암호문을 복호화할 수 없습니다");
        }
    }
}
