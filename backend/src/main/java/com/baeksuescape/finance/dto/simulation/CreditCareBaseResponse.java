package com.baeksuescape.finance.dto.simulation;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse.ReductionFactor;

/**
 * FP-170 N-18-1·N-18-10 SIM-01 시뮬레이터 입력 10개의 내 실제 값.
 * 출발 평가(점수가 나온 최근 평가)의 점수·등급과, 키 10개(ML-04와 같은 이름)의 값을 담는다. 값이 없으면 null이다.
 * 저장된 피처값(FEATURE_SNAPSHOT) 전체는 개인 금융 정보라 담지 않는다.
 * topReductionFactors(N-18-8)는 출발 평가 때 저장한 요인에서 고른 감점 요인 최대 3개다. 모양은 SIM-02와 같고 recoverScore는 null이다.
 */
public record CreditCareBaseResponse(
        String baseRequestId,
        OffsetDateTime assessedAt,
        Integer score,
        String gradeBandCode,
        Map<String, Long> values,
        List<ReductionFactor> topReductionFactors) {
}
