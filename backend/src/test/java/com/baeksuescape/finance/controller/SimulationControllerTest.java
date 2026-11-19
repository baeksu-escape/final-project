package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.simulation.CreditCareBaseResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationRequest;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse;
import com.baeksuescape.finance.dto.simulation.ScoreBandOfferResponse;
import com.baeksuescape.finance.service.CreditCareSimulationService;
import com.baeksuescape.finance.service.ScoreBandOfferService;
import com.baeksuescape.global.exception.ErrorResponse;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-170 GET /api/simulation/score-band-offer의 쿼리·JSON 필드 이름·오류 상태를 확인하는 API 테스트.
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

    @MockBean
    private CreditCareSimulationService creditCareSimulationService;

    @Autowired
    private JwtTokenProvider tokenProvider;

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

    // 회원 번호 userId로 로그인한 요청 — 실제와 같은 Authorization: Bearer 토큰을 붙인다.
    private MockHttpServletRequestBuilder loggedIn(MockHttpServletRequestBuilder builder, long userId) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(userId, "ROLE_USER"));
    }

    @Test
    @DisplayName("SIM-01·02: 토큰이 없으면 401이고 서비스를 부르지 않는다 (/api/simulation/**는 임시 공개 경로)")
    void creditCareRequiresLogin() throws Exception {
        mockMvc.perform(get("/api/simulation/credit-care/base"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(post("/api/simulation/credit-care/recalculate")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{}}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(creditCareSimulationService);
    }

    @Test
    @DisplayName("SIM-01: 입력 10개 값은 values 아래 ML-04 키 이름으로 나가고 피처값 전체는 없다")
    void getCreditCareBase() throws Exception {
        Map<String, Long> values = new LinkedHashMap<>();
        values.put("TELECOM_ON_TIME_MONTHS", 8L);
        values.put("CARD_LIMIT_AMT", null);
        when(creditCareSimulationService.base(2L)).thenReturn(new CreditCareBaseResponse(
                "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", null, 588, "CAUTION", values));

        mockMvc.perform(loggedIn(get("/api/simulation/credit-care/base"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseRequestId").value("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"))
                .andExpect(jsonPath("$.score").value(588))
                .andExpect(jsonPath("$.gradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.values.TELECOM_ON_TIME_MONTHS").value(8))
                .andExpect(jsonPath("$.values.CARD_LIMIT_AMT").value(nullValue()))
                .andExpect(jsonPath("$.featureSnapshot").doesNotExist());
    }

    @Test
    @DisplayName("SIM-02: changes가 서비스로 전달되고 응답 필드 이름(before·after·delta·topReductionFactors)이 고정된다")
    void recalculateCreditCare() throws Exception {
        when(creditCareSimulationService.recalculate(eq(2L), any())).thenReturn(new CreditCareSimulationResponse(
                "DEV-DUMMY", "CUT-0.1",
                new CreditCareSimulationResponse.ScoreSummary(588, "CAUTION", 0.21),
                new CreditCareSimulationResponse.ScoreSummary(618, "CAUTION", 0.18),
                new CreditCareSimulationResponse.Delta(30, 16, 14),
                List.of(new CreditCareSimulationResponse.ReductionFactor(1, "CL0631905", "카드 한도 사용률", 60.0, -12, 12))));

        mockMvc.perform(loggedIn(post("/api/simulation/credit-care/recalculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"changes\":{\"TELECOM_ON_TIME_MONTHS\":12,\"DELINQ_COUNT_12M\":null}}"), 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.before.score").value(588))
                .andExpect(jsonPath("$.after.gradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.delta.financialEffect").value(16))
                .andExpect(jsonPath("$.delta.alternativeEffect").value(14))
                .andExpect(jsonPath("$.topReductionFactors[0].featureName").value("카드 한도 사용률"))
                .andExpect(jsonPath("$.topReductionFactors[0].recoverScore").value(12))
                .andExpect(jsonPath("$.requestId").doesNotExist())
                .andExpect(jsonPath("$.shap").doesNotExist());

        ArgumentCaptor<CreditCareSimulationRequest> captor = ArgumentCaptor.forClass(CreditCareSimulationRequest.class);
        verify(creditCareSimulationService).recalculate(eq(2L), captor.capture());
        assertEquals(12, captor.getValue().changes().get("TELECOM_ON_TIME_MONTHS"));
        assertTrue(captor.getValue().changes().containsKey("DELINQ_COUNT_12M"));
    }

    @Test
    @DisplayName("SIM-02: 서비스의 400(changes.<키>)·404·503이 공통 오류 형식으로 나간다")
    void recalculateErrors() throws Exception {
        when(creditCareSimulationService.recalculate(eq(2L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.",
                        List.of(new ErrorResponse.FieldErrorItem("changes.DELINQ_COUNT12M", "모르는 항목입니다."))))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다."))
                .thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MODEL_NOT_READY",
                        "점수 계산 서버가 준비 중입니다. 잠시 후 다시 시도해 주세요."));

        mockMvc.perform(loggedIn(post("/api/simulation/credit-care/recalculate")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{\"DELINQ_COUNT12M\":1}}"), 2L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("changes.DELINQ_COUNT12M"));
        mockMvc.perform(loggedIn(post("/api/simulation/credit-care/recalculate")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{}}"), 2L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ASSESSMENT_NOT_FOUND"));
        mockMvc.perform(loggedIn(post("/api/simulation/credit-care/recalculate")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"changes\":{}}"), 2L))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("MODEL_NOT_READY"));
    }
}
