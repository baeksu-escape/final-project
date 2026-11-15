package com.baeksuescape.user.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.mapper.UserAccountMapper;
import com.baeksuescape.user.service.AltDataImportService;
import com.baeksuescape.user.service.ConsentService;
import com.baeksuescape.user.service.FinancialInputService;

// FP-85·FP-86 데이터 입력 API 계약(INP-01~06) — 경로·상태·JSON 키가 프론트 mock(dataInputMockHandlers.js)과 같은지 본다.
// 서비스는 mock으로 대신하고, 보안 필터·오류 처리는 실제로 탄다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DataInputApiContractTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private FinancialInputService financialInputService;
    @MockBean
    private ConsentService consentService;
    @MockBean
    private AltDataImportService altDataImportService;

    private static final OffsetDateTime AT = OffsetDateTime.parse("2026-11-14T12:00:00+09:00");

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder asRole(MockHttpServletRequestBuilder builder, String role) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, role));
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return asRole(builder, "ROLE_USER");
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void loadReturnsInputStatusAltDataAndSavedMonths() throws Exception {
        Map<String, Boolean> sections = new LinkedHashMap<>();
        sections.put("income", false);
        given(financialInputService.load(7L)).willReturn(new DataInputDtos.FinancialInputResponse(null,
                new DataInputDtos.InputStatus(sections, Map.of("telecom", true)),
                Map.of("telecom", new DataInputDtos.ImportedAltData(null, List.of(), 3L)), List.of()));

        mvc.perform(asUser(get("/api/members/me/financial-input")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.input").value((Object) null))
                .andExpect(jsonPath("$.status.sections.income").value(false))
                .andExpect(jsonPath("$.status.altData.telecom").value(true))
                .andExpect(jsonPath("$.altData.telecom.rows").isArray())
                .andExpect(jsonPath("$.altData.telecom.consentId").value(3))
                .andExpect(jsonPath("$.savedBaseMonths").isArray());
    }

    @Test
    void saveReturnsSavedAtAndInvalidInputHasFieldErrors() throws Exception {
        given(financialInputService.save(eq(7L), any())).willReturn(
                new DataInputDtos.SaveResponse(AT, new DataInputDtos.InputStatus(Map.of(), Map.of()), List.of("2026-10")));
        mvc.perform(asUser(json(put("/api/members/me/financial-input"), "{\"jobType\":\"EMPLOYEE\",\"baseMonth\":\"2026-10\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.savedAt").value("2026-11-14T12:00:00+09:00"))
                .andExpect(jsonPath("$.status.sections").exists())
                .andExpect(jsonPath("$.savedBaseMonths[0]").value("2026-10"));

        given(financialInputService.save(eq(7L), any())).willThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.",
                List.of(new FieldErrorItem("loans.items[0].annualRatePercent", "20% 이하로 입력해 주세요."))));
        mvc.perform(asUser(json(put("/api/members/me/financial-input"), "{}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("loans.items[0].annualRatePercent"));
    }

    @Test
    void consentListAgreeAndWithdrawShapes() throws Exception {
        given(consentService.list(7L)).willReturn(new DataInputDtos.ConsentList(List.of(
                new DataInputDtos.ConsentItem(5L, "ALT_DATA_PROVISION", "telecom", "TELECOM_BILL", AT, AT.plusYears(1), null))));
        mvc.perform(asUser(get("/api/members/me/consents")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].consentId").value(5))
                .andExpect(jsonPath("$.items[0].providerCode").value("telecom"))
                .andExpect(jsonPath("$.items[0].withdrawnAt").value((Object) null));

        given(consentService.agree(eq(7L), any())).willReturn(new DataInputDtos.ConsentAgreed(6L, AT));
        mvc.perform(asUser(json(post("/api/members/me/consents"),
                "{\"consentTypeCode\":\"ALT_DATA_PROVISION\",\"providerCode\":\"utility\",\"itemCode\":\"UTILITY_BILL\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consentId").value(6))
                .andExpect(jsonPath("$.agreedAt").exists());

        given(consentService.withdraw(7L, 6L)).willReturn(new DataInputDtos.ConsentWithdrawn(6L, AT));
        mvc.perform(asUser(delete("/api/members/me/consents/6")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consentId").value(6))
                .andExpect(jsonPath("$.withdrawnAt").exists());
    }

    @Test
    void importReturnsRowsAndNoticeOnlyWhenPresent() throws Exception {
        given(altDataImportService.importData(eq(7L), eq("telecom"), any())).willReturn(
                new DataInputDtos.AltDataImportResponse("telecom", AT, List.of(Map.of("month", "2025-09")), 5L, null));
        mvc.perform(asUser(json(post("/api/members/me/alt-data/telecom/import"), "{\"baseMonth\":\"2026-10\",\"consentId\":5}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("telecom"))
                .andExpect(jsonPath("$.rows[0].month").value("2025-09"))
                .andExpect(jsonPath("$.consentId").value(5))
                .andExpect(jsonPath("$.notice").doesNotExist());

        given(altDataImportService.importData(eq(7L), eq("utility"), any())).willReturn(
                new DataInputDtos.AltDataImportResponse("utility", AT, List.of(), 5L, "이 계정은 기관 기록이 없습니다."));
        mvc.perform(asUser(json(post("/api/members/me/alt-data/utility/import"), "{\"baseMonth\":\"2026-10\",\"consentId\":5}")))
                .andExpect(jsonPath("$.notice").value("이 계정은 기관 기록이 없습니다."));

        given(altDataImportService.importData(eq(7L), eq("easypay"), any()))
                .willThrow(new ApiException(HttpStatus.CONFLICT, "CONSENT_REQUIRED", "정보 제공 동의를 먼저 해 주세요."));
        mvc.perform(asUser(json(post("/api/members/me/alt-data/easypay/import"), "{\"baseMonth\":\"2026-10\"}")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));
    }

    @Test
    void dataInputIsForSignedInUsersOnly() throws Exception {
        mvc.perform(get("/api/members/me/financial-input")).andExpect(status().isUnauthorized());
        mvc.perform(asRole(get("/api/members/me/consents"), "ROLE_ADMIN")).andExpect(status().isForbidden());
    }
}
