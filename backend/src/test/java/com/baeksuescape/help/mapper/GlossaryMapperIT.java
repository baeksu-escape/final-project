package com.baeksuescape.help.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.baeksuescape.help.dto.GlossaryTermRow;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * FP-180 GlossaryMapper를 실제 Oracle DB에 붙여 컬럼 매핑과 용어 이름 정렬을 확인하는 통합 테스트.
 * -Ddb.it=true일 때만 실행한다. 시험용 용어 2개를 넣고 확인한 뒤 되돌리므로(롤백) 시드 적용 여부와 상관없다.
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class GlossaryMapperIT {

    @Autowired
    private GlossaryMapper mapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("GLOSSARY_TERM의 용어·쉬운 말·뜻 풀이를 읽고 용어 이름 순서로 돌려준다")
    void selectAllTerms() {
        jdbcTemplate.update("INSERT INTO GLOSSARY_TERM (TERM, EASY_TEXT, EXPLANATION) VALUES (?, ?, ?)",
                "IT시험-나", "쉬운 말 나", null);
        jdbcTemplate.update("INSERT INTO GLOSSARY_TERM (TERM, EASY_TEXT, EXPLANATION) VALUES (?, ?, ?)",
                "IT시험-가", "쉬운 말 가", "뜻 풀이 가");

        List<GlossaryTermRow> rows = mapper.selectAllTerms().stream()
                .filter(row -> row.getTerm().startsWith("IT시험-"))
                .toList();

        assertEquals(2, rows.size());
        assertEquals("IT시험-가", rows.get(0).getTerm(), "용어 이름 순서여야 한다");
        assertNotNull(rows.get(0).getTermId());
        assertEquals("쉬운 말 가", rows.get(0).getEasyText());
        assertEquals("뜻 풀이 가", rows.get(0).getExplanation());
        assertEquals("IT시험-나", rows.get(1).getTerm());
        assertNull(rows.get(1).getExplanation());
        assertTrue(mapper.selectAllTerms().size() >= 2);
    }
}
