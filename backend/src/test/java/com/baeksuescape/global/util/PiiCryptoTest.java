package com.baeksuescape.global.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Base64;

import org.junit.jupiter.api.Test;

import com.baeksuescape.global.TestKeys;

// FP-87 N-02-4 PiiCrypto — 왕복, 형식, 변조·모르는 버전 거부, 더미 시드 생성기(Python build_db.encrypt_text)와의 호환.
class PiiCryptoTest {

    private final PiiCrypto crypto = new PiiCrypto(TestKeys.AES);

    @Test
    void 암호화한_값을_다시_풀면_원문이다() {
        for (String text : new String[] {"홍길동", "employee@example.com", "01012345678", ""}) {
            assertThat(crypto.decrypt(crypto.encrypt(text))).isEqualTo(text);
        }
    }

    @Test
    void 저장값은_v1_접두어와_IV_암호문_태그_형식이고_매번_달라진다() {
        String a = crypto.encrypt("홍길동");
        String b = crypto.encrypt("홍길동");
        assertThat(a).startsWith("v1:").isNotEqualTo(b);
        byte[] raw = Base64.getDecoder().decode(a.substring(3));
        // 12바이트 IV + 원문 9바이트(UTF-8 한글 3자) + 16바이트 태그
        assertThat(raw).hasSize(12 + 9 + 16);
    }

    @Test
    void null은_null로_둔다() {
        assertThat(crypto.encrypt(null)).isNull();
        assertThat(crypto.decrypt(null)).isNull();
    }

    @Test
    void 변조된_값과_모르는_버전과_접두어_없는_값은_거부한다() {
        String value = crypto.encrypt("합성");
        byte[] raw = Base64.getDecoder().decode(value.substring(3));
        raw[raw.length - 1] ^= 1;
        String tampered = "v1:" + Base64.getEncoder().encodeToString(raw);
        assertThatThrownBy(() -> crypto.decrypt(tampered)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> crypto.decrypt("v2:" + value.substring(3))).hasMessage("알 수 없는 암호문 키 버전입니다");
        assertThatThrownBy(() -> crypto.decrypt(value.substring(3))).hasMessage("알 수 없는 암호문 키 버전입니다");
        assertThatThrownBy(() -> crypto.decrypt("WITHDRAWN")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> crypto.decrypt("v1:###")).hasMessage("암호문 형식이 올바르지 않습니다");
    }

    @Test
    void 다른_키로는_풀지_못한다() {
        String value = crypto.encrypt("합성");
        PiiCrypto other = new PiiCrypto(TestKeys.HMAC);
        assertThatThrownBy(() -> other.decrypt(value)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 키_길이가_32바이트가_아니면_만들지_않는다() {
        assertThatThrownBy(() -> new PiiCrypto(new byte[16])).isInstanceOf(IllegalArgumentException.class);
    }

    // Python build_db.encrypt_text(text, TEST_AES)로 만든 값(공개 테스트 키). 더미 시드의 NAME_ENC·EMAIL_ENC·PHONE_ENC와 같은 형식이다.
    @Test
    void 더미_시드_생성기가_만든_암호문을_복호화한다() {
        assertThat(crypto.decrypt("v1:IaZxq0kbD17iWCJU27vtdox4eQnusQ85tC1jIo5C5OEV6wFF9Q==")).isEqualTo("홍길동");
        assertThat(crypto.decrypt("v1:amDgesC5LYdJErSaU0VoB36jD2ZntS9wwakUkaRrpOS5ptjEVM66RLF02tHjl1/l")).isEqualTo("employee@example.com");
        assertThat(crypto.decrypt("v1:6CKYMXZFAgoeCQvfvMPJJrMURowLQZGlvBYexXiy1tD1YdeDv8El")).isEqualTo("01012345678");
    }
}
