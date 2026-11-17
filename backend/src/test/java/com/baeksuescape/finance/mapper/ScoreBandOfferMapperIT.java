package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.GradeBandRow;
import com.baeksuescape.finance.dto.ScoreBandOfferRow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * FP-170 ScoreBandOfferMapper를 실제 Oracle 더미 DB에 붙여 확인하는 통합 테스트.
 * -Ddb.it=true일 때만 실행한다. 등급 구간은 DDL에 들어 있고, 금리·한도는 21_seed_score_band_offer.sql을 적재해야 한다.
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class ScoreBandOfferMapperIT {

    @Autowired
    private ScoreBandOfferMapper mapper;

    @Test
    @DisplayName("등급 구간(DDL 기준 데이터): ACTIVE 버전 CUT-0.1에서 경계별 등급")
    void selectActiveGradeBand() {
        GradeBandRow caution = mapper.selectActiveGradeBand(664);
        assertNotNull(caution, "SCORE_GRADE_BAND가 비어 있다. DDL을 실행했는지 확인");
        assertEquals("CAUTION", caution.getGradeBandCode());
        assertEquals("CUT-0.1", caution.getCutoffVersion());
        assertEquals("STANDARD", mapper.selectActiveGradeBand(665).getGradeBandCode());
        assertEquals("GOOD", mapper.selectActiveGradeBand(780).getGradeBandCode());
    }

    @Test
    @DisplayName("점수대 금리·한도(시드): 3개 점수대 값이 시드와 같다")
    void selectOfferByScore() {
        ScoreBandOfferRow standard = mapper.selectOfferByScore(720);
        assertNotNull(standard, "SCORE_BAND_OFFER가 비어 있다. dummy_db/run_all.sql 적재 필요");
        assertEquals(665, standard.getMinScore());
        assertEquals(779, standard.getMaxScore());
        assertEquals(0, new java.math.BigDecimal("5.28").compareTo(standard.getRateMinPct()));
        assertEquals(47000000L, standard.getLimitAmt());
        assertEquals(LocalDate.of(2026, 9, 18), standard.getBaseDate());

        assertEquals(128000000L, mapper.selectOfferByScore(1000).getLimitAmt());
        assertEquals(0, mapper.selectOfferByScore(0).getMinScore());
    }
}
