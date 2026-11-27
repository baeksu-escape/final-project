package com.baeksuescape.help.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.baeksuescape.help.dto.ChatbotPresetRow;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * FP-181 ChatbotMapper를 실제 Oracle DB에 붙여 질문 버튼의 컬럼 매핑과 표시 순서 정렬을 확인하는 통합 테스트.
 * -Ddb.it=true일 때만 실행한다. 시험용 버튼 2개를 넣고 확인한 뒤 되돌리므로(롤백) 시드 적용 여부와 상관없다.
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class ChatbotMapperIT {

    @Autowired
    private ChatbotMapper mapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("CHATBOT_PRESET_QUESTION의 질문·답·순서를 읽고 표시 순서대로 돌려준다")
    void selectPresets() {
        // 넣는 순서와 반대로 표시 순서를 줘서, 정렬이 PRESET_ID가 아니라 DISPLAY_ORDER 기준인지 본다
        jdbcTemplate.update("INSERT INTO CHATBOT_PRESET_QUESTION (QUESTION_TEXT, ANSWER_TEXT, DISPLAY_ORDER) VALUES (?, ?, ?)",
                "IT시험 질문 뒤", "IT시험 답 뒤", 99);
        jdbcTemplate.update("INSERT INTO CHATBOT_PRESET_QUESTION (QUESTION_TEXT, ANSWER_TEXT, DISPLAY_ORDER) VALUES (?, ?, ?)",
                "IT시험 질문 앞", "IT시험 답 앞", 98);

        List<ChatbotPresetRow> rows = mapper.selectPresets().stream()
                .filter(row -> row.getQuestionText().startsWith("IT시험"))
                .toList();

        assertEquals(2, rows.size());
        assertEquals("IT시험 질문 앞", rows.get(0).getQuestionText(), "표시 순서대로여야 한다");
        assertNotNull(rows.get(0).getPresetId());
        assertEquals("IT시험 답 앞", rows.get(0).getAnswerText());
        assertEquals(98, rows.get(0).getDisplayOrder());
        assertEquals("IT시험 질문 뒤", rows.get(1).getQuestionText());
    }

    @Test
    @DisplayName("N-32-2 호출 기록을 넣으면 그 시각 이후의 성공(Y)만 센다 — 실패(N)와 기준 시각 전 기록은 세지 않는다")
    void questionLogCount() {
        long userId = jdbcTemplate.queryForObject("SELECT MIN(USER_ID) FROM APP_USER", Long.class);
        // 미래 시각을 기준으로 잡아 기존 기록과 섞이지 않게 한다
        LocalDateTime since = LocalDateTime.of(2099, 1, 1, 0, 0);
        assertEquals(0, mapper.countSuccessSince(userId, since));

        mapper.insertQuestionLog(userId, since.minusMinutes(1), "Y");
        mapper.insertQuestionLog(userId, since.plusHours(1), "Y");
        mapper.insertQuestionLog(userId, since.plusHours(2), "N");
        mapper.insertQuestionLog(userId, since.plusHours(3), "Y");

        assertEquals(2, mapper.countSuccessSince(userId, since));
    }
}
