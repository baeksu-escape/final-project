package com.baeksuescape.notification.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.apache.ibatis.session.SqlSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.notification.dto.NotificationRow;

/** FP-300·D-23 알림 조건 목록 SQL을 Oracle에서 확인하며 시험 자료는 트랜잭션 롤백으로 되돌린다(-Ddb.it=true 전용). */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class NotificationMapperIT {
    @Autowired
    private NotificationMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SqlSession sqlSession;

    private long userId;

    // D-23 FP-300 Oracle 시험에 사용할 기존 회원 ID를 골라 테스트 데이터를 그 회원에 묶는다.
    @BeforeEach
    void setUp() {
        userId = jdbc.queryForObject("SELECT MIN(USER_ID) FROM APP_USER", Long.class);
    }

    // D-23 FP-300 읽음·종류·커서 조건 조합과 알림 번호 내림차순, size+1 조회를 실제 SQL로 확인한다.
    @Test
    @DisplayName("알림 필터와 커서를 함께 적용해 번호 내림차순으로 조회한다")
    void selectFiltered_combinedFiltersOrderAndLimit() {
        insert("COMMENT_NEW", false, "oldest");
        insert("WELCOME", false, "other-type");
        insert("COMMENT_NEW", true, "already-read");
        long comment1 = insert("COMMENT_NEW", false, "comment-1");
        long comment2 = insert("COMMENT_NEW", false, "comment-2");
        long comment3 = insert("COMMENT_NEW", false, "comment-3");
        long newestComment = insert("COMMENT_NEW", false, "comment-newest");
        sqlSession.clearCache();

        List<NotificationRow> rows = mapper.selectFiltered(userId, true, "COMMENT_NEW", newestComment, 2);

        assertEquals(List.of(comment3, comment2), rows.stream().map(NotificationRow::getNotificationId).toList());
        assertEquals(comment1, jdbc.queryForObject(
                "SELECT NOTIFICATION_ID FROM USER_NOTIFICATION WHERE USER_ID = ? AND TITLE = ?",
                Long.class, userId, "fp284-it-comment-1"));
    }

    // D-23 FP-300 롤백 대상 알림 한 건을 넣고 생성된 알림 번호를 돌려준다.
    private long insert(String typeCode, boolean read, String suffix) {
        String title = "fp284-it-" + suffix;
        jdbc.update("INSERT INTO USER_NOTIFICATION (USER_ID, NOTIFICATION_TYPE_CODE, TITLE, CONTENT, READ_AT, CREATED_AT) "
                + "VALUES (?, ?, ?, 'test', CASE WHEN ? = 1 THEN SYSTIMESTAMP ELSE NULL END, SYSTIMESTAMP)",
                userId, typeCode, title, read ? 1 : 0);
        return jdbc.queryForObject("SELECT NOTIFICATION_ID FROM USER_NOTIFICATION WHERE USER_ID = ? AND TITLE = ?",
                Long.class, userId, title);
    }
}
