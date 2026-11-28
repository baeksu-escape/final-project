package com.baeksuescape.user.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

// FP-258 N-01-3 마지막 로그인 실패 시각 SQL 확인 — DB 없이 매퍼 XML 글자로 본다. 실제 DB 확인은 UserAccountLoginFailIT(-Ddb.it=true).
class UserAccountMapperLoginFailXmlTest {

    private static final Pattern UPDATE = Pattern.compile("<update id=\"(\\w+)\">(.*?)</update>", Pattern.DOTALL);

    // 매퍼 XML의 update 문을 id → SQL(공백 한 칸으로 줄임)로 읽는다.
    private static Map<String, String> updates(String resource) throws IOException {
        try (InputStream in = UserAccountMapperLoginFailXmlTest.class.getResourceAsStream(resource)) {
            assertThat(in).as(resource).isNotNull();
            Matcher matcher = UPDATE.matcher(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            Map<String, String> result = new LinkedHashMap<>();
            while (matcher.find()) result.put(matcher.group(1), matcher.group(2).replaceAll("\\s+", " "));
            return result;
        }
    }

    @Test
    void 실패_횟수를_0으로_돌리는_SQL은_마지막_실패_시각도_비운다() throws IOException {
        Map<String, String> all = new LinkedHashMap<>(updates("/mapper/user/UserAccountMapper.xml"));
        all.putAll(updates("/mapper/admin/AdminAccountMapper.xml"));
        List<String> resets = all.entrySet().stream()
                .filter(entry -> entry.getValue().contains("LOGIN_FAIL_COUNT = 0"))
                .map(Map.Entry::getKey)
                .toList();

        // 로그인 성공·비밀번호 재설정·관리자 잠금 해제·관리자 임시 비밀번호 재발급
        assertThat(resets).contains("updateLoginSuccess", "updatePasswordAndUnlock", "updateUnlocked", "updateTemporaryPassword");
        resets.forEach(id -> assertThat(all.get(id)).as(id).contains("LAST_LOGIN_FAIL_AT = NULL"));
    }

    @Test
    void 로그인_실패는_실패_횟수와_함께_마지막_실패_시각을_지금으로_남긴다() throws IOException {
        assertThat(updates("/mapper/user/UserAccountMapper.xml").get("updateLoginFailure"))
                .contains("LOGIN_FAIL_COUNT = #{failCount}")
                .contains("LAST_LOGIN_FAIL_AT = #{now}");
    }
}
