package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.GradeBandRow;
import com.baeksuescape.finance.dto.ScoreBandOfferResponse;
import com.baeksuescape.finance.dto.ScoreBandOfferRow;
import com.baeksuescape.finance.mapper.ScoreBandOfferMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * FP-170 N-18-7 점수대 금리·한도 조회 서비스 단위 테스트. mapper는 시드(21_seed_score_band_offer.sql)와 같은 값을 돌려주는 가짜로 대신한다.
 */
class ScoreBandOfferServiceTest {

    private ScoreBandOfferMapper mapper;
    private ScoreBandOfferService service;

    @BeforeEach
    void setUp() {
        mapper = mock(ScoreBandOfferMapper.class);
        service = new ScoreBandOfferService(mapper);
        // 시드와 같은 3개 점수대·등급 구간 (CUT-0.1)
        when(mapper.selectOfferByScore(anyInt())).thenAnswer(inv -> offerFor(inv.getArgument(0)));
        when(mapper.selectActiveGradeBand(anyInt())).thenAnswer(inv -> gradeFor(inv.getArgument(0)));
    }

    private ScoreBandOfferRow offer(int min, int max, String rateMin, String rateMax, String rateAvg, long limit) {
        ScoreBandOfferRow row = new ScoreBandOfferRow();
        row.setMinScore(min);
        row.setMaxScore(max);
        row.setRateMinPct(new BigDecimal(rateMin));
        row.setRateMaxPct(new BigDecimal(rateMax));
        row.setRateAvgPct(rateAvg == null ? null : new BigDecimal(rateAvg));
        row.setLimitAmt(limit);
        row.setBaseDate(LocalDate.of(2026, 9, 18));
        return row;
    }

    private ScoreBandOfferRow offerFor(int score) {
        if (score <= 664) return offer(0, 664, "6.4", "19.64", "13.020", 47000000L);
        if (score <= 779) return offer(665, 779, "5.28", "19.64", "12.460", 47000000L);
        return offer(780, 1000, "3.75", "19.64", "11.695", 128000000L);
    }

    private GradeBandRow gradeFor(int score) {
        GradeBandRow row = new GradeBandRow();
        row.setCutoffVersion("CUT-0.1");
        row.setGradeBandCode(score <= 664 ? "CAUTION" : score <= 779 ? "STANDARD" : "GOOD");
        return row;
    }

    @Test
    @DisplayName("등급 경계 664/665/779/780과 양 끝 0·1000에서 맞는 점수대·등급을 돌려준다")
    void boundaries() {
        assertEquals("CAUTION", service.findOffer(0).getGradeBand());
        assertEquals("CAUTION", service.findOffer(664).getGradeBand());
        assertEquals("STANDARD", service.findOffer(665).getGradeBand());
        assertEquals("STANDARD", service.findOffer(779).getGradeBand());
        assertEquals("GOOD", service.findOffer(780).getGradeBand());
        assertEquals("GOOD", service.findOffer(1000).getGradeBand());
    }

    @Test
    @DisplayName("응답에 금리 범위·평균·한도·기준일·더미 표시가 담긴다")
    void responseFields() {
        ScoreBandOfferResponse response = service.findOffer(720);

        assertEquals(720, response.getScore());
        assertEquals("CUT-0.1", response.getCutoffVersion());
        assertEquals(665, response.getBandMinScore());
        assertEquals(779, response.getBandMaxScore());
        assertEquals(5.28, response.getExpectedMinRate());
        assertEquals(19.64, response.getExpectedMaxRate());
        assertEquals(12.46, response.getExpectedAvgRate());
        assertEquals(47000000L, response.getExpectedLimitAmount());
        assertEquals("2026-09-18", response.getBaseDate());
        assertTrue(response.isDummyNotice(), "더미 데이터 안내는 항상 표시한다.");
    }

    @Test
    @DisplayName("평균 금리가 없으면 null로 돌려준다")
    void avgRateNull() {
        when(mapper.selectOfferByScore(500)).thenReturn(offer(0, 664, "6.4", "19.64", null, 47000000L));
        assertNull(service.findOffer(500).getExpectedAvgRate());
    }

    @Test
    @DisplayName("점수가 0~1000 밖이면 400이고 DB를 조회하지 않는다")
    void outOfRange() {
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> service.findOffer(-1)).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> service.findOffer(1001)).getStatusCode());
        verify(mapper, never()).selectOfferByScore(anyInt());
    }

    @Test
    @DisplayName("점수대나 등급 자료가 없으면 404")
    void notFound() {
        when(mapper.selectOfferByScore(700)).thenReturn(null);
        assertEquals(HttpStatus.NOT_FOUND,
                assertThrows(ResponseStatusException.class, () -> service.findOffer(700)).getStatusCode());

        when(mapper.selectActiveGradeBand(800)).thenReturn(null);
        assertEquals(HttpStatus.NOT_FOUND,
                assertThrows(ResponseStatusException.class, () -> service.findOffer(800)).getStatusCode());
    }
}
