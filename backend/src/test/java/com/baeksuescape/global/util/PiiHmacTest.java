package com.baeksuescape.global.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.baeksuescape.global.TestKeys;

// FP-87 N-02-4 PiiHmac — 정규화와 더미 시드 생성기(Python build_db.search_hmac)와 같은 값인지 확인한다.
class PiiHmacTest {

    private final PiiHmac hmac = new PiiHmac(TestKeys.HMAC);

    @Test
    void 이메일은_앞뒤_공백과_대소문자가_달라도_같은_값이다() {
        assertThat(hmac.email(" A@Example.COM ")).isEqualTo(hmac.email("a@example.com")).matches("^[0-9a-f]{64}$");
    }

    @Test
    void 휴대폰은_숫자만_남겨서_계산한다() {
        assertThat(hmac.phone("010-0000-0001")).isEqualTo(hmac.phone("01000000001")).matches("^[0-9a-f]{64}$");
    }

    @Test
    void 키가_다르면_값도_다르고_null은_null이다() {
        assertThat(new PiiHmac(TestKeys.AES).phone("01000000001")).isNotEqualTo(hmac.phone("01000000001"));
        assertThat(hmac.email(null)).isNull();
        assertThat(hmac.phone(null)).isNull();
    }

    @Test
    void 키가_32바이트보다_짧으면_만들지_않는다() {
        assertThatThrownBy(() -> new PiiHmac(new byte[31])).isInstanceOf(IllegalArgumentException.class);
    }

    // Python build_db.search_hmac(' A@Example.COM ', 'email', TEST_HMAC)·search_hmac('010-0000-0001', 'phone', TEST_HMAC) 결과(공개 테스트 키).
    @Test
    void 더미_시드_생성기와_같은_HMAC을_낸다() {
        assertThat(hmac.email(" A@Example.COM ")).isEqualTo("c7ad340e6d3f568165173127f3374fdc68da8a6addce7e80566961e07f143efa");
        assertThat(hmac.phone("010-0000-0001")).isEqualTo("508c02af410267f4841b176a9a928b853cb99db7e597194e94b6fa29496a37b4");
    }
}
