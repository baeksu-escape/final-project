package com.baeksuescape.help.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.service.ReportService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.help.client.OpenAiClient;
import com.baeksuescape.help.dto.AiSummaryResponse;
import com.baeksuescape.help.mapper.AiSummaryMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * FP-181 N-31-2 AI 요약 서비스 테스트 — 저장된 요약 재사용, 산출 안 된 평가 409, AI에 넘기는 글(계산값만), 저장·동시 저장 처리를 DB 없이 확인한다.
 */
class AiSummaryServiceTest {

    private static final String REQUEST_ID = "11111111-2222-4333-8444-555555555555";

    private ReportService reportService;
    private AiSummaryMapper mapper;
    private OpenAiClient openAi;
    private AiSummaryService service;

    @BeforeEach
    void setUp() {
        reportService = mock(ReportService.class);
        mapper = mock(AiSummaryMapper.class);
        openAi = mock(OpenAiClient.class);
        service = new AiSummaryService(reportService, mapper, openAi);
    }

    // 피처 원래 값은 "1234567"처럼 눈에 띄는 값으로 넣어 AI에 넘어가지 않는지 본다
    private static ReportDtos.Report report(String status, String aiSummary) {
        List<ReportDtos.Factor> factors = List.of(
                new ReportDtos.Factor(2, "TELECOM", "통신비 납부", "회", "1234567", -8, "Y", "Y"),
                new ReportDtos.Factor(1, "INCOME", "월 소득", "원", "1234567", 15, "N", "Y"),
                new ReportDtos.Factor(3, "UTILITY", "공과금 납부", "회", "1234567", 4, "Y", "Y"),
                new ReportDtos.Factor(4, "LOAN", "대출 잔액", "원", "1234567", -2, "N", "N"));
        return new ReportDtos.Report(REQUEST_ID, null, "2026-10", "EMPLOYEE", status, null,
                new ReportDtos.ModelScore("Y", 640, "CAUTION", BigDecimal.ONE),
                new ReportDtos.ModelScore("Y", 690, "STANDARD", BigDecimal.ONE),
                new ReportDtos.Comparison(50, true), null, new ReportDtos.Shap(600, factors), aiSummary, "LGBM-0.2", null);
    }

    @Test
    @DisplayName("저장된 요약이 있으면 AI를 부르지 않고 그대로 돌려준다(generated false)")
    void reuseSaved() {
        when(reportService.byRequestId(2L, REQUEST_ID)).thenReturn(report("SCORED", "이미 저장된 요약입니다."));

        AiSummaryResponse response = service.summarize(2L, REQUEST_ID);

        assertEquals("이미 저장된 요약입니다.", response.aiSummary());
        assertFalse(response.generated());
        verifyNoInteractions(openAi, mapper);
    }

    @Test
    @DisplayName("산출되지 않은 평가는 409 NOT_SCORED이고 AI를 부르지 않는다")
    void notScored() {
        when(reportService.byRequestId(2L, REQUEST_ID)).thenReturn(report("NOT_SCORABLE", null));

        ApiException error = assertThrows(ApiException.class, () -> service.summarize(2L, REQUEST_ID));

        assertEquals(HttpStatus.CONFLICT, error.getStatus());
        assertEquals("NOT_SCORED", error.getCode());
        verifyNoInteractions(openAi, mapper);
    }

    @Test
    @DisplayName("남의 평가·없는 평가는 ReportService의 404를 그대로 알린다")
    void notFound() {
        ApiException notFound = new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가를 찾을 수 없습니다.");
        when(reportService.byRequestId(2L, REQUEST_ID)).thenThrow(notFound);

        ApiException error = assertThrows(ApiException.class, () -> service.summarize(2L, REQUEST_ID));

        assertEquals("ASSESSMENT_NOT_FOUND", error.getCode());
        verifyNoInteractions(openAi, mapper);
    }

    @Test
    @DisplayName("AI에는 점수·한글 등급·점수 차이·상위 3개 요인 이름과 작용 점수만 넘기고, 피처 원래 값·4위 요인·등급 코드는 넘기지 않는다")
    void promptHasOnlyCalculatedValues() {
        String prompt = AiSummaryService.prompt(report("SCORED", null));

        assertTrue(prompt.contains("기존 신용 점수: 640점 (등급 주의)"), prompt);
        assertTrue(prompt.contains("대안 신용 점수(생활 데이터 포함): 690점 (등급 보통)"), prompt);
        assertTrue(prompt.contains("+50점, 등급 바뀜: 예"), prompt);
        assertTrue(prompt.indexOf("월 소득: +15점") < prompt.indexOf("통신비 납부: −8점"), "순위대로");
        assertTrue(prompt.contains("공과금 납부: +4점"), prompt);
        assertFalse(prompt.contains("1234567"), "피처 원래 값은 넘기지 않는다");
        assertFalse(prompt.contains("대출 잔액"), "상위 3개만");
        assertFalse(prompt.contains("CAUTION") || prompt.contains("EMPLOYEE") || prompt.contains(REQUEST_ID), prompt);
    }

    @Test
    @DisplayName("요약을 만들면 1000자로 잘라 저장하고 generated true로 돌려준다")
    void generateAndSave() {
        when(reportService.byRequestId(2L, REQUEST_ID)).thenReturn(report("SCORED", null));
        when(openAi.complete(eq(AiSummaryService.SYSTEM_PROMPT), anyString(), eq(AiSummaryService.SUMMARY_MAX_TOKENS)))
                .thenReturn("가".repeat(1200));
        when(mapper.updateAiSummaryIfEmpty(eq(2L), eq(REQUEST_ID), anyString())).thenReturn(1);

        AiSummaryResponse response = service.summarize(2L, REQUEST_ID);

        assertEquals(1000, response.aiSummary().length());
        assertTrue(response.generated());
        verify(mapper).updateAiSummaryIfEmpty(2L, REQUEST_ID, "가".repeat(1000));
        verify(mapper, never()).selectAiSummary(2L, REQUEST_ID);
    }

    @Test
    @DisplayName("다른 요청이 먼저 저장했으면(0행) 저장된 요약을 다시 읽어 돌려준다")
    void concurrentSave() {
        when(reportService.byRequestId(2L, REQUEST_ID)).thenReturn(report("SCORED", null));
        when(openAi.complete(anyString(), anyString(), eq(AiSummaryService.SUMMARY_MAX_TOKENS))).thenReturn("새 요약");
        when(mapper.updateAiSummaryIfEmpty(2L, REQUEST_ID, "새 요약")).thenReturn(0);
        when(mapper.selectAiSummary(2L, REQUEST_ID)).thenReturn("먼저 저장된 요약");

        AiSummaryResponse response = service.summarize(2L, REQUEST_ID);

        assertEquals("먼저 저장된 요약", response.aiSummary());
        assertFalse(response.generated());
    }

    @Test
    @DisplayName("AI가 실패하면 502를 그대로 알리고 저장하지 않는다")
    void aiFailed() {
        when(reportService.byRequestId(2L, REQUEST_ID)).thenReturn(report("SCORED", null));
        when(openAi.complete(anyString(), anyString(), eq(AiSummaryService.SUMMARY_MAX_TOKENS)))
                .thenThrow(new ApiException(HttpStatus.BAD_GATEWAY, OpenAiClient.AI_FAILED, "실패"));

        ApiException error = assertThrows(ApiException.class, () -> service.summarize(2L, REQUEST_ID));

        assertEquals(OpenAiClient.AI_FAILED, error.getCode());
        verifyNoInteractions(mapper);
    }
}
