package com.baeksuescape.assessment.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;

/**
 * FP-170 selectLatestScored를 실제 Oracle 더미 DB에서 확인하는 통합 테스트(-Ddb.it=true일 때만 실행).
 * 최신 평가가 NOT_SCORABLE이어도 그 앞의 SCORED 평가와 피처값을 고르는지 본다. 넣은 행은 테스트가 끝나면 되돌린다(@Transactional).
 */
@SpringBootTest
@Transactional
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class AssessmentLatestScoredIT {

    @Autowired
    private AssessmentMapper mapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("최신이 MODEL_ERROR(NOT_SCORABLE)면 selectLatest는 그 행, selectLatestScored는 앞선 SCORED 행과 피처값")
    void latestScoredSkipsNotScorable() {
        long userId = jdbc.queryForObject("SELECT MIN(USER_ID) FROM APP_USER", Long.class);
        Map<String, Object> model = jdbc.queryForMap(
                "SELECT MODEL_VERSION, FEATURE_SET_VERSION FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE' FETCH FIRST 1 ROWS ONLY");
        String modelVersion = (String) model.get("MODEL_VERSION");
        String featureSet = (String) model.get("FEATURE_SET_VERSION");

        AssessmentRow scored = row(userId, modelVersion, LocalDateTime.of(2099, 1, 1, 10, 0));
        scored.setFeatureSetVersion(featureSet);
        scored.setCutoffVersion("CUT-0.1");
        scored.setGradeStatusCode("SCORED");
        scored.setAltScorableYn("Y");
        scored.setAltScore(588);
        scored.setAltGradeBandCode("CAUTION");
        scored.setAltDefaultProb(new BigDecimal("0.21"));
        scored.setFeatureSnapshot("{\"telecom_on_time_streak\": 8, \"dp_payment_count_12m\": 276}");
        mapper.insertAssessment(scored);

        AssessmentRow failed = row(userId, modelVersion, LocalDateTime.of(2099, 1, 2, 10, 0));
        failed.setGradeStatusCode("NOT_SCORABLE");
        failed.setNotScorableReasonCode("MODEL_ERROR");
        failed.setAltScorableYn("N");
        mapper.insertAssessment(failed);

        assertEquals(failed.getRequestId(), mapper.selectLatest(userId).getRequestId());

        AssessmentRow latestScored = mapper.selectLatestScored(userId);
        assertNotNull(latestScored);
        assertEquals(scored.getRequestId(), latestScored.getRequestId());
        assertEquals(modelVersion, latestScored.getModelVersion());
        assertEquals(featureSet, latestScored.getFeatureSetVersion());
        assertEquals(588, latestScored.getAltScore());
        assertTrue(latestScored.getFeatureSnapshot().contains("telecom_on_time_streak"), latestScored.getFeatureSnapshot());
    }

    private static AssessmentRow row(long userId, String modelVersion, LocalDateTime assessedAt) {
        AssessmentRow row = new AssessmentRow();
        row.setRequestId(UUID.randomUUID().toString());
        row.setUserId(userId);
        row.setWorkerTypeCode("FREELANCER");
        row.setAgeBandCode("30S");
        row.setInputBaseMonth("2026-08");
        row.setModelVersion(modelVersion);
        row.setTradScorableYn("N");
        row.setAssessedAt(assessedAt);
        return row;
    }
}
