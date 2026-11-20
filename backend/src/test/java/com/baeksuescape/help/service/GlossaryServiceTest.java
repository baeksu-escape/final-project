package com.baeksuescape.help.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.baeksuescape.help.dto.GlossaryResponse;
import com.baeksuescape.help.dto.GlossaryTermRow;
import com.baeksuescape.help.mapper.GlossaryMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * FP-180 N-30-1 용어 사전 서비스 테스트 — 저장된 행을 화면용 모양으로 바꾸는지, 빈 사전을 오류 없이 돌려주는지 DB 없이 확인한다.
 */
class GlossaryServiceTest {

    private GlossaryMapper mapper;
    private GlossaryService service;

    @BeforeEach
    void setUp() {
        mapper = mock(GlossaryMapper.class);
        service = new GlossaryService(mapper);
    }

    private static GlossaryTermRow row(long id, String term, String easyText, String explanation) {
        GlossaryTermRow row = new GlossaryTermRow();
        row.setTermId(id);
        row.setTerm(term);
        row.setEasyText(easyText);
        row.setExplanation(explanation);
        return row;
    }

    @Test
    @DisplayName("저장된 용어를 매퍼가 준 순서 그대로 용어·쉬운 말·뜻 풀이로 돌려준다 (뜻 풀이가 없으면 null)")
    void findAll() {
        when(mapper.selectAllTerms()).thenReturn(List.of(
                row(2L, "DSR", "1년 소득 중 빚 갚는 데 드는 비율", "총부채원리금상환비율"),
                row(1L, "원리금", "갚아야 할 원금과 이자", null)));

        List<GlossaryResponse.Term> terms = service.findAll().terms();

        assertEquals(2, terms.size());
        assertEquals("DSR", terms.get(0).term());
        assertEquals("1년 소득 중 빚 갚는 데 드는 비율", terms.get(0).easyText());
        assertEquals("총부채원리금상환비율", terms.get(0).explanation());
        assertEquals("원리금", terms.get(1).term());
        assertNull(terms.get(1).explanation());
    }

    @Test
    @DisplayName("사전이 비어 있으면 오류가 아니라 빈 목록이다")
    void emptyGlossary() {
        when(mapper.selectAllTerms()).thenReturn(List.of());

        assertTrue(service.findAll().terms().isEmpty());
    }
}
