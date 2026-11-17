package com.baeksuescape.global;

import java.util.Base64;

import com.baeksuescape.global.config.AvenueProperties;

// FP-87 테스트용 공개 키 — 실제 키 아님. AES·HMAC은 dummy_db/tools/tests/test_build_db.py의 TEST_AES·TEST_HMAC와 같다.
public final class TestKeys {

    public static final byte[] AES = range(0, 32);
    public static final byte[] HMAC = range(32, 64);
    public static final byte[] JWT = range(64, 128);

    private TestKeys() {
    }

    // 공개 테스트 키를 넣은 설정. Spring 없이 단위 테스트에서 쓴다.
    public static AvenueProperties properties() {
        AvenueProperties properties = new AvenueProperties();
        properties.getAuth().getJwt().setSecret(b64(JWT));
        properties.getPii().setAesKey(b64(AES));
        properties.getPii().setHmacKey(b64(HMAC));
        return properties;
    }

    public static String b64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static byte[] range(int from, int to) {
        byte[] bytes = new byte[to - from];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) (from + i);
        return bytes;
    }
}
