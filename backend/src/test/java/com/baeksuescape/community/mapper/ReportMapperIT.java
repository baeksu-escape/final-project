package com.baeksuescape.community.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.apache.ibatis.session.SqlSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** D-23 FP-301 selectOpenReporterUserIds를 실제 Oracle에서 확인한다. -Ddb.it=true일 때만 실행하고 입력 행은 롤백한다. */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class ReportMapperIT {
    @Autowired
    private ReportMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SqlSession sqlSession;

    private List<Long> userIds;
    private long postId;

    // D-23 FP-301 서로 다른 신고자 세 명과 중복 신고가 없는 기존 게시글을 테스트 대상으로 고른다.
    @BeforeEach
    void setUp() {
        userIds = jdbc.queryForList(
                "SELECT USER_ID FROM (SELECT USER_ID FROM APP_USER ORDER BY USER_ID) WHERE ROWNUM <= 3", Long.class);
        Assumptions.assumeTrue(userIds.size() >= 3, "신고자 테스트용 회원 세 명이 필요합니다.");
        Long availablePostId = jdbc.queryForObject("SELECT MIN(POST_ID) FROM BOARD_POST P WHERE NOT EXISTS "
                + "(SELECT 1 FROM CONTENT_REPORT R WHERE R.POST_ID = P.POST_ID AND R.REPORTER_USER_ID IN (?, ?, ?))",
                Long.class, userIds.get(0), userIds.get(1), userIds.get(2));
        Assumptions.assumeTrue(availablePostId != null, "테스트 회원이 신고하지 않은 게시글이 필요합니다.");
        postId = availablePostId;
    }

    // D-23 FP-301 같은 대상의 여러 미처리 신고자는 포함하고 처리 완료된 신고자는 제외하는지 확인한다.
    @Test
    @DisplayName("같은 글의 미처리 신고자만 중복 없이 조회한다")
    void selectOpenReporterUserIds_미처리회원만조회() {
        insertOpen(userIds.get(0), "RECEIVED");
        insertOpen(userIds.get(1), "IN_REVIEW");
        insertHandled(userIds.get(2));
        sqlSession.clearCache();

        assertThat(mapper.selectOpenReporterUserIds("POST", postId))
                .containsExactlyInAnyOrder(userIds.get(0), userIds.get(1));
    }

    // D-23 FP-301 DB 고유 인덱스가 같은 회원의 중복 신고를 막고 조회 결과도 한 회원만 담는지 확인한다.
    @Test
    @DisplayName("같은 회원의 중복 신고는 저장되지 않고 조회에는 한 번만 나온다")
    void selectOpenReporterUserIds_같은회원중복신고는한건() {
        insertOpen(userIds.get(0), "RECEIVED");

        assertThatThrownBy(() -> insertOpen(userIds.get(0), "IN_REVIEW"))
                .isInstanceOf(DataIntegrityViolationException.class);
        sqlSession.clearCache();

        assertThat(mapper.selectOpenReporterUserIds("POST", postId)).containsExactly(userIds.get(0));
    }

    // D-23 FP-301 테스트 대상 글의 신고 한 건을 지정한 미처리 상태로 저장한다.
    private void insertOpen(long reporterUserId, String statusCode) {
        jdbc.update("INSERT INTO CONTENT_REPORT (TARGET_TYPE_CODE, POST_ID, REPORTER_USER_ID, REASON_CODE, STATUS_CODE, REPORTED_AT) "
                + "VALUES ('POST', ?, ?, 'SPAM', ?, SYSTIMESTAMP)", postId, reporterUserId, statusCode);
    }

    // D-23 FP-301 조회에서 제외할 처리 완료 신고를 저장한다.
    private void insertHandled(long reporterUserId) {
        jdbc.update("INSERT INTO CONTENT_REPORT (TARGET_TYPE_CODE, POST_ID, REPORTER_USER_ID, REASON_CODE, STATUS_CODE, "
                + "RESULT_CODE, REPORTED_AT, HANDLED_AT) VALUES ('POST', ?, ?, 'SPAM', 'DONE', 'DELETE', SYSTIMESTAMP, SYSTIMESTAMP)",
                postId, reporterUserId);
    }
}
