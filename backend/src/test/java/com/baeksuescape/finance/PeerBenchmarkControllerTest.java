package com.baeksuescape.finance;

import com.baeksuescape.finance.controller.PeerBenchmarkController;
import com.baeksuescape.finance.dto.PeerBenchmarkResponse;
import com.baeksuescape.finance.service.PeerBenchmarkService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// N-15-2 동년배 기준값 컨트롤러 웹 계층 단위 테스트
@WebMvcTest(controllers = PeerBenchmarkController.class)
@AutoConfigureMockMvc(addFilters = false) // 시큐리티 필터 제외
class PeerBenchmarkControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PeerBenchmarkService peerBenchmarkService;

    @Test
    @DisplayName("GET /api/finance/peer-benchmark 요청 시 연령대 기준값을 JSON으로 응답한다")
    void getPeerBenchmark_success() throws Exception {
        // given
        PeerBenchmarkResponse response = PeerBenchmarkResponse.builder()
                .statYear(2025)
                .ageGroup("30대")
                .avgAnnualIncome(38000000L)
                .avgTotalAsset(98000000L)
                .avgTotalDebt(56000000L)
                .sampleSize(4120)
                .build();

        given(peerBenchmarkService.getPeerBenchmark(eq("30대"), any())).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/finance/peer-benchmark")
                        .param("ageGroup", "30대")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statYear").value(2025))
                .andExpect(jsonPath("$.ageGroup").value("30대"))
                .andExpect(jsonPath("$.avgAnnualIncome").value(38000000L))
                .andExpect(jsonPath("$.avgTotalAsset").value(98000000L))
                .andExpect(jsonPath("$.avgTotalDebt").value(56000000L));
    }

    @Test
    @DisplayName("GET /api/finance/peer-benchmark/all 요청 시 전체 연령대 기준값 목록을 반환한다")
    void getAllPeerBenchmarks_success() throws Exception {
        // given
        List<PeerBenchmarkResponse> list = List.of(
                PeerBenchmarkResponse.builder().ageGroup("20대").avgAnnualIncome(29000000L).build(),
                PeerBenchmarkResponse.builder().ageGroup("30대").avgAnnualIncome(38000000L).build()
        );
        given(peerBenchmarkService.getAllBenchmarks(any())).willReturn(list);

        // when & then
        mockMvc.perform(get("/api/finance/peer-benchmark/all")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].ageGroup").value("20대"))
                .andExpect(jsonPath("$[1].ageGroup").value("30대"));
    }
}

