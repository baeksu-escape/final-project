package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.simulation.ScoreBandOfferResponse;
import com.baeksuescape.finance.service.ScoreBandOfferService;
import com.baeksuescape.user.mapper.UserAccountMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.baeksuescape.global.exception.ApiException;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-170 GET /api/simulation/score-band-offer의 쿼리·JSON 필드 이름·오류 상태를 확인하는 API 테스트.
 * SIM-01·02는 /api/members/me로 옮겨 MemberFinanceControllerTest에서 본다.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SimulationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ScoreBandOfferService scoreBandOfferService;

    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUpAccount() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

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
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));

        when(scoreBandOfferService.findOffer(1001))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "점수는 0~1000 사이여야 합니다."));
        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "1001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    @DisplayName("자료가 없으면 404")
    void notFound() throws Exception {
        when(scoreBandOfferService.findOffer(700))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "해당 점수대의 금리·한도 자료가 없습니다."));
        mockMvc.perform(get("/api/simulation/score-band-offer").param("score", "700"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
