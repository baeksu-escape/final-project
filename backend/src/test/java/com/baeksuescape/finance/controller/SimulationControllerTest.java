package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.ScoreBandOfferResponse;
import com.baeksuescape.finance.service.ScoreBandOfferService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-170 GET /api/simulation/score-band-offer의 쿼리·JSON 필드 이름·오류 상태를 확인하는 웹 계층 테스트.
 */
@WebMvcTest(SimulationController.class)
class SimulationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ScoreBandOfferService scoreBandOfferService;

    @Test
    @DisplayName("점수를 넘기면 금리·한도와 dummyNotice(is 없음)가 나간다")
    void getScoreBandOffer() throws Exception {
        when(scoreBandOfferService.findOffer(720)).thenReturn(ScoreBandOfferResponse.builder()
                .score(720).gradeBand("STANDARD").cutoffVersion("CUT-0.1")
                .bandMinScore(665).bandMaxScore(779)
                .expectedMinRate(5.28).expectedMaxRate(19.64).expectedAvgRate(12.46)
                .expectedLimitAmount(47000000L).baseDate("2026-09-18").dummyNotice(true)
                .build());

        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "720"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gradeBand").value("STANDARD"))
                .andExpect(jsonPath("$.expectedMinRate").value(5.28))
                .andExpect(jsonPath("$.expectedAvgRate").value(12.46))
                .andExpect(jsonPath("$.expectedLimitAmount").value(47000000))
                .andExpect(jsonPath("$.baseDate").value("2026-09-18"))
                .andExpect(jsonPath("$.dummyNotice").value(true))
                .andExpect(jsonPath("$.isDummyNotice").doesNotExist());
    }

    @Test
    @DisplayName("점수가 없거나 숫자가 아니면 400, 서비스가 400을 던지면 400")
    void badRequest() throws Exception {
        mockMvc.perform(get("/api/simulation/score-band-offer"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "abc"))
                .andExpect(status().isBadRequest());

        when(scoreBandOfferService.findOffer(1001))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "점수는 0~1000 사이여야 합니다."));
        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "1001"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("자료가 없으면 404")
    void notFound() throws Exception {
        when(scoreBandOfferService.findOffer(700))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 점수대의 금리·한도 자료가 없습니다."));
        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "700"))
                .andExpect(status().isNotFound());
    }
}
