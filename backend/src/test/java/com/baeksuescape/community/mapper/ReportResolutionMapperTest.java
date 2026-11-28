package com.baeksuescape.community.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;

import com.baeksuescape.community.mapper.ReportMapper.PendingReport;

/** N-34-3 합성 신고로 MyBatis 조회 결과와 조건부 갱신을 확인한다. */
class ReportResolutionMapperTest {
    @Test
    void closesOnlyTheSelectedPendingReports() throws Exception {
        var database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        try {
            JdbcTemplate jdbc = new JdbcTemplate(database);
            jdbc.execute("""
                    CREATE TABLE CONTENT_REPORT (
                        REPORT_ID BIGINT PRIMARY KEY, REPORTER_USER_ID BIGINT, TARGET_TYPE_CODE VARCHAR(10),
                        POST_ID BIGINT, COMMENT_ID BIGINT, STATUS_CODE VARCHAR(20), RESULT_CODE VARCHAR(20),
                        HANDLER_USER_ID BIGINT, HANDLER_MEMO VARCHAR(100), HANDLED_AT TIMESTAMP
                    )
                    """);
            jdbc.update("""
                    INSERT INTO CONTENT_REPORT (REPORT_ID, REPORTER_USER_ID, TARGET_TYPE_CODE, POST_ID, COMMENT_ID, STATUS_CODE)
                    VALUES (12, 9, 'POST', 1, NULL, 'RECEIVED'), (13, 10, 'POST', 1, NULL, 'IN_REVIEW'),
                           (14, 11, 'COMMENT', NULL, 1, 'RECEIVED'), (15, 12, 'POST', 1, NULL, 'DONE'),
                           (17, NULL, 'POST', 1, NULL, 'RECEIVED')
                    """);

            SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
            factory.setDataSource(database);
            factory.setMapperLocations(new ClassPathResource("mapper/community/ReportMapper.xml"));
            try (var session = factory.getObject().openSession(true)) {
                ReportMapper mapper = session.getMapper(ReportMapper.class);
                var pending = mapper.selectPendingReports("POST", 1L);
                assertThat(pending).extracting(PendingReport::reportId).containsExactly(12L, 13L, 17L);
                assertThat(pending).extracting(PendingReport::reporterUserId).containsExactly(9L, 10L, null);
                jdbc.update("""
                        INSERT INTO CONTENT_REPORT (REPORT_ID, REPORTER_USER_ID, TARGET_TYPE_CODE, POST_ID, STATUS_CODE)
                        VALUES (16, 13, 'POST', 1, 'RECEIVED')
                        """);

                LocalDateTime now = LocalDateTime.of(2026, 11, 28, 10, 0);
                for (PendingReport report : pending) {
                    assertThat(mapper.closeOpenReport(report.reportId(), "REJECTED", "REJECT", 1L, null, now)).isEqualTo(1);
                    assertThat(mapper.closeOpenReport(report.reportId(), "DONE", "DELETE", 2L, null, now)).isZero();
                }
                assertThat(mapper.selectPendingReports("POST", 1L)).containsExactly(new PendingReport(16L, 13L));
                assertThat(mapper.selectPendingReports("COMMENT", 1L)).containsExactly(new PendingReport(14L, 11L));
                assertThat(jdbc.queryForObject("SELECT STATUS_CODE FROM CONTENT_REPORT WHERE REPORT_ID = 17", String.class))
                        .isEqualTo("REJECTED");
            }
        } finally {
            database.shutdown();
        }
    }
}
