package com.baeksuescape.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.baeksuescape.global.TestKeys;

// FP-87 AvenueProperties — 키가 없거나 형식이 틀리면 시작할 때 멈추고, 오류 문구에는 키 값이 들어가지 않는다.
class AvenuePropertiesTest {

    private static final String SECRET_LOOKING = "DO-NOT-PRINT-THIS";

    @Test
    void 기본값과_공개_테스트_키는_통과한다() {
        AvenueProperties properties = TestKeys.properties();
        assertThatCode(properties::afterPropertiesSet).doesNotThrowAnyException();
        assertThat(properties.getAuth().getJwt().getExpiresMinutes()).isEqualTo(60);
        assertThat(properties.getAuth().getEmail().getMode()).isEqualTo(AvenueProperties.EmailMode.LOG);
        assertThat(properties.getAuth().getSocial().getMode()).isEqualTo(AvenueProperties.SocialMode.DEV);
        assertThat(properties.getCors().getAllowedOrigins()).containsExactly("http://localhost:5173");
        assertThat(properties.getAltdata().getMissingMemberMode()).isEqualTo(AvenueProperties.MissingMemberMode.EMPTY);
        assertThat(properties.getAuth().getTemporaryOpenPaths()).containsExactly("/api/finance/**", "/api/diagnosis/**", "/api/simulation/**");
    }

    @Test
    void 키가_없으면_이름을_알려_주며_멈춘다() {
        AvenueProperties properties = TestKeys.properties();
        properties.getAuth().getJwt().setSecret(null);
        assertThatThrownBy(properties::afterPropertiesSet).hasMessageContaining("AVENUE_JWT_SECRET");
    }

    @Test
    void Base64가_아니면_값을_빼고_알려_준다() {
        AvenueProperties properties = TestKeys.properties();
        properties.getPii().setAesKey(SECRET_LOOKING);
        assertThatThrownBy(properties::afterPropertiesSet)
                .hasMessageContaining("AVENUE_DEV_AES_KEY")
                .hasMessageNotContaining(SECRET_LOOKING);
    }

    @Test
    void 키_길이가_틀리면_멈춘다() {
        AvenueProperties shortJwt = TestKeys.properties();
        shortJwt.getAuth().getJwt().setSecret(TestKeys.b64(new byte[31]));
        assertThatThrownBy(shortJwt::afterPropertiesSet).hasMessageContaining("AVENUE_JWT_SECRET");

        AvenueProperties longAes = TestKeys.properties();
        longAes.getPii().setAesKey(TestKeys.b64(new byte[33]));
        assertThatThrownBy(longAes::afterPropertiesSet).hasMessageContaining("AVENUE_DEV_AES_KEY");

        AvenueProperties shortHmac = TestKeys.properties();
        shortHmac.getPii().setHmacKey(TestKeys.b64(new byte[31]));
        assertThatThrownBy(shortHmac::afterPropertiesSet).hasMessageContaining("AVENUE_DEV_HMAC_KEY");
    }

    @Test
    void AES와_HMAC_키가_같으면_멈춘다() {
        AvenueProperties properties = TestKeys.properties();
        properties.getPii().setHmacKey(properties.getPii().getAesKey());
        assertThatThrownBy(properties::afterPropertiesSet).hasMessageContaining("서로 달라야");
    }

    @Test
    void FIXED_모드에는_고정_코드가_필요하다() {
        AvenueProperties properties = TestKeys.properties();
        properties.getAuth().getEmail().setMode(AvenueProperties.EmailMode.FIXED);
        assertThatThrownBy(properties::afterPropertiesSet).hasMessageContaining("fixed-code");
        properties.getAuth().getEmail().setFixedCode("123456");
        assertThatCode(properties::afterPropertiesSet).doesNotThrowAnyException();
    }
}
