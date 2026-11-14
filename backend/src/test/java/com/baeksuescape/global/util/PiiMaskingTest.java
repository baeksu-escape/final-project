package com.baeksuescape.global.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

// FP-87 N-04-1 PiiMasking — 프론트 mock(myPageMockHandlers.js maskName·maskPhone·maskEmail)과 같은 결과인지 확인한다.
class PiiMaskingTest {

    @Test
    void 이름() {
        assertThat(PiiMasking.name("홍길동")).isEqualTo("홍*동");
        assertThat(PiiMasking.name("홍길")).isEqualTo("홍*");
        assertThat(PiiMasking.name("홍")).isEqualTo("홍");
        assertThat(PiiMasking.name("데모직장인")).isEqualTo("데***인");
    }

    @Test
    void 휴대폰() {
        assertThat(PiiMasking.phone("01012345678")).isEqualTo("010-****-5678");
        assertThat(PiiMasking.phone("0101234567")).isEqualTo("010-***-4567");
    }

    @Test
    void 이메일() {
        assertThat(PiiMasking.email("employee@example.com")).isEqualTo("em******@example.com");
        assertThat(PiiMasking.email("ab@example.com")).isEqualTo("a*@example.com");
        assertThat(PiiMasking.email("a@example.com")).isEqualTo("*@example.com");
    }

    @Test
    void 값이_없으면_null() {
        assertThat(PiiMasking.name(null)).isNull();
        assertThat(PiiMasking.phone(null)).isNull();
        assertThat(PiiMasking.email(null)).isNull();
        assertThat(PiiMasking.name("")).isNull();
        assertThat(PiiMasking.phone("")).isNull();
        assertThat(PiiMasking.email("")).isNull();
    }
}
