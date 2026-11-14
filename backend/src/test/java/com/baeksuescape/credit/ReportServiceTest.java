package com.baeksuescape.credit;

import com.baeksuescape.credit.dto.ReportAssessment;
import com.baeksuescape.credit.dto.ReportResponse;
import com.baeksuescape.credit.mapper.ReportMapper;
import com.baeksuescape.credit.service.ReportService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

// N-12-1·N-12-3·N-14-1 DB를 호출하지 않고 회원 범위 전달과 저장 결과 조립을 검사한다.
class ReportServiceTest {
    private ReportMapper mapper;
    private ReportService service;

    // 합성 고정 예제를 사용하는 조회 서비스를 준비한다.
    @BeforeEach
    void setUp() {
        mapper = mock(ReportMapper.class);
        service = new ReportService(mapper);
    }

    // N-12-3 대안 점수가 낮은 결과도 그대로 반환하며 조회 회원을 모든 매퍼에 전달한다.
    @Test
    void preservesLowerAlternativeScoreAndUsesOwnerForEveryQuery() {
        ReportAssessment row = scored();
        ReportResponse.Factor factor = new ReportResponse.Factor();
        factor.setFeatureCode("income_cv");
        factor.setShapScore(-25);
        when(mapper.findLatest(102L)).thenReturn(row);
        when(mapper.findGradeBands(102L, 9L)).thenReturn(List.of());
        when(mapper.findFactors(102L, 9L)).thenReturn(List.of(factor));
        ReportResponse result = service.findLatest(102L).orElseThrow();
        assertEquals(-89, result.getComparison().scoreDiff());
        assertTrue(result.getComparison().gradeChanged());
        assertEquals("CUT-OLD", result.getGradeBands().cutoffVersion());
        assertEquals(-25, result.getShap().factors().get(0).getShapScore());
        verify(mapper).findGradeBands(102L, 9L);
        verify(mapper).findFactors(102L, 9L);
    }

    // N-12-3 한 모델을 산출하지 못하면 비교 값은 0이나 false 대신 NULL이다.
    @Test
    void keepsUnscoredValuesNull() {
        ReportAssessment row = scored();
        row.setTradScorableYn("N");
        row.setTradScore(null);
        row.setTradGradeBandCode(null);
        when(mapper.findLatest(102L)).thenReturn(row);
        ReportResponse result = service.findLatest(102L).orElseThrow();
        assertNull(result.getTraditional().score());
        assertNull(result.getComparison().scoreDiff());
        assertNull(result.getComparison().gradeChanged());
    }

    // N-12-1 평가가 없으면 하위 조회를 수행하지 않는다.
    @Test
    void returnsEmptyForMissingAssessment() {
        assertTrue(service.findLatest(102L).isEmpty());
        verify(mapper).findLatest(102L);
        verifyNoMoreInteractions(mapper);
    }

    // N-12-1 특정 요청도 회원 번호와 함께 조회하며 타인 소유와 미존재를 구분하지 않는다.
    @Test
    void scopesRequestLookupToOwner() {
        String requestId = "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c";
        assertTrue(service.findByRequestId(102L, requestId).isEmpty());
        verify(mapper).findByRequestId(102L, requestId);
        verifyNoMoreInteractions(mapper);
    }

    // N-12-1 인증 정보가 없거나 요청 번호가 잘못되면 SQL을 실행하지 않는다.
    @Test
    void rejectsInvalidInternalInputsBeforeQuery() {
        assertThrows(IllegalArgumentException.class, () -> service.findLatest(null));
        assertThrows(IllegalArgumentException.class, () -> service.findLatest(0L));
        assertThrows(IllegalArgumentException.class, () -> service.findByRequestId(102L, "invalid"));
        assertThrows(IllegalArgumentException.class, () -> service.findLatest(-1L));
        assertThrows(IllegalArgumentException.class, () -> service.findByRequestId(null, "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c"));
        assertThrows(IllegalArgumentException.class, () -> service.findByRequestId(102L, null));
        assertThrows(IllegalArgumentException.class, () -> service.findByRequestId(102L, ""));
        verifyNoInteractions(mapper);
    }

    // N-12-1·N-14-4 요청 조회도 소유 회원·평가 번호로 조립하고 전체 SHAP의 저장 순위를 보존한다.
    @Test
    void requestLookupPreservesMetadataAndAllStoredFactorRanks() {
        ReportAssessment row = scored();
        row.setRequestId("3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c");
        row.setAssessedAt(LocalDateTime.of(2026, 11, 14, 10, 30, 12));
        row.setInputBaseMonth("2026-08");
        row.setWorkerTypeCode("FREELANCER");
        row.setModelVersion("MODEL-OLD");
        row.setShapBaseScore(639);
        row.setTradDefaultProb(new BigDecimal("0.0123"));
        row.setAltDefaultProb(new BigDecimal("0.0345"));
        List<ReportResponse.Factor> factors = IntStream.rangeClosed(1, 8).mapToObj(rank -> {
            ReportResponse.Factor factor = new ReportResponse.Factor();
            factor.setRank(rank);
            factor.setFeatureCode("feature_" + rank);
            factor.setShapScore(rank == 1 ? -1 : rank * 10);
            return factor;
        }).toList();
        ReportResponse.GradeBand band = new ReportResponse.GradeBand();
        band.setGradeBandCode("STANDARD");
        band.setMinScore(650);
        band.setMaxScore(799);
        when(mapper.findByRequestId(102L, row.getRequestId())).thenReturn(row);
        when(mapper.findGradeBands(102L, 9L)).thenReturn(List.of(band));
        when(mapper.findFactors(102L, 9L)).thenReturn(factors);

        ReportResponse result = service.findByRequestId(102L, row.getRequestId()).orElseThrow();

        assertEquals(row.getRequestId(), result.getRequestId());
        assertEquals(row.getAssessedAt(), result.getAssessedAt());
        assertEquals("2026-08", result.getInputBaseMonth());
        assertEquals("FREELANCER", result.getWorkerTypeCode());
        assertEquals("MODEL-OLD", result.getModelVersion());
        assertEquals("SCORED", result.getGradeStatusCode());
        assertNull(result.getAiSummary());
        assertEquals(row.getTradDefaultProb(), result.getTraditional().defaultProb());
        assertEquals(row.getAltDefaultProb(), result.getAlternative().defaultProb());
        assertEquals(639, result.getShap().baseScore());
        assertEquals(IntStream.rangeClosed(1, 8).boxed().toList(),
                result.getShap().factors().stream().map(ReportResponse.Factor::getRank).toList());
        assertEquals(-1, result.getShap().factors().get(0).getShapScore());
        assertEquals(650, result.getGradeBands().bands().get(0).getMinScore());
        verify(mapper).findByRequestId(102L, row.getRequestId());
        verify(mapper).findGradeBands(102L, 9L);
        verify(mapper).findFactors(102L, 9L);
        verifyNoMoreInteractions(mapper);
    }

    // N-12-3·N-12-6 개선 없는 0점 차이와 같은 등급을 미산출의 NULL과 구분한다.
    @Test
    void returnsZeroAndFalseForEqualScoredResults() {
        ReportAssessment row = scored();
        row.setAltScore(row.getTradScore());
        row.setAltGradeBandCode(row.getTradGradeBandCode());
        when(mapper.findLatest(102L)).thenReturn(row);
        ReportResponse result = service.findLatest(102L).orElseThrow();
        assertEquals(0, result.getComparison().scoreDiff());
        assertEquals(false, result.getComparison().gradeChanged());
    }

    // N-12-3 산출 여부와 점수·등급 누락을 따로 검사하고 비교 불가를 0점 차이로 바꾸지 않는다.
    @Test
    void doesNotCompareUnscorableOrMissingScoresAndGrades() {
        for (int scenario = 0; scenario < 6; scenario++) {
            ReportAssessment row = scored();
            switch (scenario) {
                case 0 -> row.setAltScorableYn("N");
                case 1 -> row.setTradScorableYn(null);
                case 2 -> row.setTradScore(null);
                case 3 -> row.setAltScore(null);
                case 4 -> row.setTradGradeBandCode(null);
                case 5 -> row.setAltGradeBandCode(null);
                default -> throw new AssertionError();
            }
            when(mapper.findLatest(102L)).thenReturn(row);
            ReportResponse result = service.findLatest(102L).orElseThrow();
            assertEquals(scenario < 4 ? null : Integer.valueOf(-89), result.getComparison().scoreDiff(), "scenario=" + scenario);
            assertNull(result.getComparison().gradeChanged(), "scenario=" + scenario);
        }
    }

    // N-12-1·N-12-6 미산출 평가도 반환하며 이유와 NULL인 점수·SHAP 기준점을 유지한다.
    @Test
    void returnsUnscoredAssessmentWithReasonAndEmptyFactors() {
        ReportAssessment row = new ReportAssessment();
        row.setAssessmentId(10L);
        row.setGradeStatusCode("NOT_SCORABLE");
        row.setNotScorableReasonCode("MODEL_ERROR");
        row.setTradScorableYn("N");
        row.setAltScorableYn("N");
        when(mapper.findLatest(102L)).thenReturn(row);
        when(mapper.findGradeBands(102L, 10L)).thenReturn(List.of());
        when(mapper.findFactors(102L, 10L)).thenReturn(List.of());
        ReportResponse result = service.findLatest(102L).orElseThrow();
        assertEquals("NOT_SCORABLE", result.getGradeStatusCode());
        assertEquals("MODEL_ERROR", result.getNotScorableReasonCode());
        assertNull(result.getTraditional().score());
        assertNull(result.getAlternative().score());
        assertNull(result.getComparison().scoreDiff());
        assertNull(result.getComparison().gradeChanged());
        assertNull(result.getShap().baseScore());
        assertTrue(result.getShap().factors().isEmpty());
        assertNull(result.getGradeBands().cutoffVersion());
        assertTrue(result.getGradeBands().bands().isEmpty());
    }

    // N-12-6 두 점수를 산출한 고정 합성 평가를 준비한다.
    private ReportAssessment scored() {
        ReportAssessment row = new ReportAssessment();
        row.setAssessmentId(9L);
        row.setCutoffVersion("CUT-OLD");
        row.setGradeStatusCode("SCORED");
        row.setTradScorableYn("Y");
        row.setTradScore(701);
        row.setTradGradeBandCode("STANDARD");
        row.setAltScorableYn("Y");
        row.setAltScore(612);
        row.setAltGradeBandCode("CAUTION");
        return row;
    }
}
