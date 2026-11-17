package com.baeksuescape.finance.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-166 DSR·건전성 API 테스트. 서비스는 DB를 쓰지 않으므로 실제 서비스를 그대로 붙여 응답 값까지 확인한다.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
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
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("annualIncome"));
        mockMvc.perform(post("/api/diagnosis/dsr/calculate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"annualIncome\":30000000,\"annualDebtService\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("annualDebtService"));
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
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("totalAsset"));
    }
}
