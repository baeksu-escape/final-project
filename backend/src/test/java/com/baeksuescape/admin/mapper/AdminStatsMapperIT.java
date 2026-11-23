package com.baeksuescape.admin.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.mapper.AssessmentMapper;

/**
 * FP-161 AdminStatsMapper를 실제 Oracle DB에서 확인하는 통합 테스트(-Ddb.it=true일 때만 실행).
 * 2099년 날짜로 평가 행을 넣어 회원별 최근 SCORED 1건, 탈퇴 회원 제외, 오늘 산출 건수를 본다. 넣은 행은 끝나면 되돌린다(@Transactional).
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class AdminStatsMapperIT {

    private static final LocalDateTime FUTURE = LocalDateTime.of(2099, 1, 1, 0, 0);

    @Autowired
    private AdminStatsMapper mapper;
    @Autowired
    private AssessmentMapper assessmentMapper;
    @Autowired
    private JdbcTemplate jdbc;

    private String modelVersion;
    private String featureSet;

    @BeforeEach
    void setUp() {
        Map<String, Object> model = jdbc.queryForMap(
                "SELECT MODEL_VERSION, FEATURE_SET_VERSION FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE' FETCH FIRST 1 ROWS ONLY");
        modelVersion = (String) model.get("MODEL_VERSION");
        featureSet = (String) model.get("FEATURE_SET_VERSION");
    }

    private AssessmentRow scored(long userId, LocalDateTime at, Integer trad, int alt, String grade) {
        AssessmentRow row = base(userId, at);
        row.setFeatureSetVersion(featureSet);
        row.setCutoffVersion("CUT-0.1");
        row.setGradeStatusCode("SCORED");
        if (trad != null) {
            row.setTradScorableYn("Y");
            row.setTradScore(trad);
            row.setTradGradeBandCode("CAUTION");
            row.setTradDefaultProb(new BigDecimal("0.30"));
        }
        row.setAltScorableYn("Y");
        row.setAltScore(alt);
        row.setAltGradeBandCode(grade);
        row.setAltDefaultProb(new BigDecimal("0.20"));
        row.setFeatureSnapshot("{\"telecom_on_time_streak\": 8}");   // SCORED는 피처값이 있어야 한다(CK_ASM_FEATURE_REQUIRED)
        assessmentMapper.insertAssessment(row);
        return row;
    }

    private AssessmentRow base(long userId, LocalDateTime at) {
        AssessmentRow row = new AssessmentRow();
        row.setRequestId(UUID.randomUUID().toString());
        row.setUserId(userId);
        row.setWorkerTypeCode("FREELANCER");
        row.setAgeBandCode("30S");
        row.setInputBaseMonth("2026-08");
        row.setModelVersion(modelVersion);
        row.setTradScorableYn("N");
        row.setAssessedAt(at);
        return row;
    }

    private long activeMember() {
        return jdbc.queryForObject("SELECT MIN(USER_ID) FROM APP_USER WHERE ROLE_CODE = 'ROLE_USER' AND ACCOUNT_STATUS_CODE <> 'WITHDRAWN'", Long.class);
    }

    @Test
    @DisplayName("회원마다 가장 최근 SCORED 평가 1건만 나온다(더 늦은 NOT_SCORABLE·앞선 SCORED는 무시)")
    void latestScoredPerMember() {
        long userId = activeMember();
        scored(userId, FUTURE.plusDays(1), null, 500, "CAUTION");
        scored(userId, FUTURE.plusDays(2), 650, 720, "STANDARD");
        AssessmentRow failed = base(userId, FUTURE.plusDays(3));
        failed.setGradeStatusCode("NOT_SCORABLE");
        failed.setNotScorableReasonCode("MODEL_ERROR");
        failed.setAltScorableYn("N");
        assessmentMapper.insertAssessment(failed);

        List<MemberScore> mine = mapper.selectLatestScoredMembers().stream().filter(m -> m.getUserId() == userId).toList();

        assertEquals(1, mine.size());
        MemberScore m = mine.get(0);
        assertEquals(720, m.getAltScore());
        assertEquals(650, m.getTradScore());
        assertEquals("STANDARD", m.getAltGradeBandCode());
        assertEquals("CAUTION", m.getTradGradeBandCode(), "기존 등급(11/23 추가)");
        assertEquals("FREELANCER", m.getWorkerTypeCode());
        assertEquals("30S", m.getAgeBandCode());
    }

    @Test
    @DisplayName("오늘 산출(from 이후 SCORED 수)은 NOT_SCORABLE을 세지 않고, 가입 회원 수는 일반 회원 중 탈퇴 제외")
    void counts() {
        long before = mapper.selectScoredCountSince(FUTURE);
        long userId = activeMember();
        scored(userId, FUTURE.plusHours(1), null, 600, "CAUTION");
        scored(userId, FUTURE.plusHours(2), null, 610, "CAUTION");
        AssessmentRow failed = base(userId, FUTURE.plusHours(3));
        failed.setGradeStatusCode("NOT_SCORABLE");
        failed.setNotScorableReasonCode("MODEL_ERROR");
        failed.setAltScorableYn("N");
        assessmentMapper.insertAssessment(failed);

        assertEquals(before + 2, mapper.selectScoredCountSince(FUTURE));
        assertEquals(jdbc.queryForObject(
                        "SELECT COUNT(*) FROM APP_USER WHERE ROLE_CODE = 'ROLE_USER' AND ACCOUNT_STATUS_CODE <> 'WITHDRAWN'", Long.class),
                mapper.selectRegisteredMemberCount());
    }

    @Test
    @DisplayName("탈퇴 회원의 평가는 통계에서 빠진다(D-28). DB에 탈퇴 회원이 없으면 건너뛴다")
    void withdrawnExcluded() {
        Long withdrawn = jdbc.queryForObject("SELECT MIN(USER_ID) FROM APP_USER WHERE ACCOUNT_STATUS_CODE = 'WITHDRAWN'", Long.class);
        Assumptions.assumeTrue(withdrawn != null, "로컬 DB에 탈퇴 회원이 없음");
        scored(withdrawn, FUTURE.plusDays(5), 600, 700, "STANDARD");

        assertTrue(mapper.selectLatestScoredMembers().stream().noneMatch(m -> m.getUserId().equals(withdrawn)));
        assertEquals(0, mapper.selectScoredCountSince(FUTURE.plusDays(5)));
    }
}
