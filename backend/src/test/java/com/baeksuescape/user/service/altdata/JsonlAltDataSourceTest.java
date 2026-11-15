package com.baeksuescape.user.service.altdata;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.baeksuescape.global.TestKeys;
import com.baeksuescape.global.config.AvenueProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

// FP-85 N-05-6 1차 원천 — 폴더가 없어도 앱은 뜨고(사용 불가), 있으면 회원별로 찾는다.
class JsonlAltDataSourceTest {

    // 테스트 리소스 altdata 폴더의 절대 경로.
    static String testSourceDir() {
        try {
            return Path.of(JsonlAltDataSourceTest.class.getResource("/altdata").toURI()).toString();
        } catch (URISyntaxException e) {
            throw new IllegalStateException(e);
        }
    }

    static JsonlAltDataSource sourceFor(String dir) {
        AvenueProperties properties = TestKeys.properties();
        properties.getAltdata().setSourceDir(dir);
        return new JsonlAltDataSource(properties, new ObjectMapper());
    }

    @Test
    void missingOrBlankFolderMakesEveryKindUnavailable() {
        for (String dir : new String[] { null, "", Path.of("no-such-altdata-dir").toAbsolutePath().toString() }) {
            JsonlAltDataSource source = sourceFor(dir);
            for (AltDataKind kind : AltDataKind.values()) {
                assertThat(source.isAvailable(kind)).isFalse();
            }
            assertThat(source.find(AltDataKind.TELECOM, 1L)).isEmpty();
            assertThat(source.defaultAsOfDate()).isNull();
        }
    }

    @Test
    void loadsResponsesByUserId() {
        JsonlAltDataSource source = sourceFor(testSourceDir());

        for (AltDataKind kind : AltDataKind.values()) {
            assertThat(source.isAvailable(kind)).isTrue();
        }
        assertThat(source.find(AltDataKind.TELECOM, 1L)).isPresent();
        assertThat(source.find(AltDataKind.TELECOM, 2L)).isPresent();
        assertThat(source.find(AltDataKind.UTILITY, 2L)).isEmpty();
        // 국민연금·건강보험은 같은 파일을 쓴다.
        assertThat(source.find(AltDataKind.NATIONAL_PENSION, 2L)).isPresent();
        // 원천 전체 기준일은 읽은 as_of_date 중 가장 늦은 날.
        assertThat(source.defaultAsOfDate()).isEqualTo(LocalDate.of(2026, 9, 20));
    }
}
