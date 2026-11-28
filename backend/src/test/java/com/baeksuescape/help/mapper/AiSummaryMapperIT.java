package com.baeksuescape.help.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * FP-181 AiSummaryMapper를 실제 Oracle DB에 붙여 ASSESSMENT.AI_SUMMARY 저장·조회를 확인하는 통합 테스트.
 * -Ddb.it=true일 때만 실행한다. 회원 평가 한 건의 요약을 비운 뒤 확인하고 되돌린다(롤백).
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class AiSummaryMapperIT {

    @Autowired
    private AiSummaryMapper mapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("요약이 비어 있을 때만 저장하고(두 번째는 0행), 다른 회원 번호로는 저장·조회되지 않는다")
    void saveOnlyWhenEmpty() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT REQUEST_ID, USER_ID FROM ASSESSMENT WHERE USER_ID IS NOT NULL AND ROWNUM = 1");
        Assumptions.assumeFalse(rows.isEmpty(), "회원 평가가 없는 DB");
        String requestId = (String) rows.get(0).get("REQUEST_ID");
        long userId = ((Number) rows.get(0).get("USER_ID")).longValue();
        jdbcTemplate.update("UPDATE ASSESSMENT SET AI_SUMMARY = NULL WHERE REQUEST_ID = ?", requestId);

        assertNull(mapper.selectAiSummary(userId, requestId));
        assertEquals(0, mapper.updateAiSummaryIfEmpty(userId + 1_000_000, requestId, "남의 요약"), "남의 평가에는 저장하지 않는다");
        assertEquals(1, mapper.updateAiSummaryIfEmpty(userId, requestId, "IT시험 요약"));
        assertEquals(0, mapper.updateAiSummaryIfEmpty(userId, requestId, "덮어쓰기 시도"), "이미 있으면 덮어쓰지 않는다");
        assertEquals("IT시험 요약", mapper.selectAiSummary(userId, requestId));
        assertNull(mapper.selectAiSummary(userId + 1_000_000, requestId));
    }
}
