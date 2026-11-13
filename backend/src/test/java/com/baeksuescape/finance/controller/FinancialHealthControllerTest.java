package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.service.FinancialHealthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-166 DSR·건전성 API 웹 계층 테스트. 서비스는 DB를 쓰지 않으므로 실제 서비스를 그대로 붙여 응답 값까지 확인한다.
 */
@WebMvcTest(FinancialHealthController.class)
@Import(FinancialHealthService.class)
class FinancialHealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("POST /api/diagnosis/dsr/calculate: 프론트 mock과 같은 필드로 DSR·단계를 돌려준다")
    void calculateDsr() throws Exception {
        mockMvc.perform(post("/api/diagnosis/dsr/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"annualIncome\":30000000,\"annualDebtService\":12000000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dsrRatio").value(40.0))
                .andExpect(jsonPath("$.riskLevel").value("DANGER"))
                .andExpect(jsonPath("$.riskBadgeText").value("위험"))
                .andExpect(jsonPath("$.annualIncome").value(30000000))
                .andExpect(jsonPath("$.description").isNotEmpty());
    }

    @Test
    @DisplayName("POST /api/diagnosis/dsr/calculate: 연소득 0 또는 음수 금액이면 400")
    void calculateDsr_badRequest() throws Exception {
        mockMvc.perform(post("/api/diagnosis/dsr/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"annualIncome\":0,\"annualDebtService\":1000000}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/diagnosis/dsr/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"annualIncome\":30000000,\"annualDebtService\":-1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/diagnosis/financial-health/calculate: 비율 3개와 단계, 계산 불가는 null")
    void calculateHealth() throws Exception {
        mockMvc.perform(post("/api/diagnosis/financial-health/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"totalAsset\":100000000,\"annualIncome\":40000000,"
                                + "\"totalDebt\":50000000,\"annualDebtService\":14000000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.netAsset").value(50000000))
                .andExpect(jsonPath("$.repaymentBurdenRatio").value(35.0))
                .andExpect(jsonPath("$.repaymentBurdenLevel").value("CAUTION"))
                .andExpect(jsonPath("$.debtToAssetRatio").value(50.0))
                .andExpect(jsonPath("$.debtToAssetLevel").value("CAUTION"))
                .andExpect(jsonPath("$.debtToNetAssetRatio").value(100.0))
                .andExpect(jsonPath("$.debtToNetAssetLevel").value("DANGER"));

        // 순자산이 음수이면 순자산 대비 부채는 null
        mockMvc.perform(post("/api/diagnosis/financial-health/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"totalAsset\":30000000,\"annualIncome\":40000000,"
                                + "\"totalDebt\":50000000,\"annualDebtService\":4000000}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.netAsset").value(-20000000))
                .andExpect(jsonPath("$.debtToNetAssetRatio").doesNotExist())
                .andExpect(jsonPath("$.debtToNetAssetLevel").doesNotExist());
    }

    @Test
    @DisplayName("POST /api/diagnosis/financial-health/calculate: 음수 금액이면 400")
    void calculateHealth_badRequest() throws Exception {
        mockMvc.perform(post("/api/diagnosis/financial-health/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"totalAsset\":-1,\"annualIncome\":0,\"totalDebt\":0,\"annualDebtService\":0}"))
                .andExpect(status().isBadRequest());
    }
}
