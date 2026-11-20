package com.baeksuescape.finance.dto.scenario;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * FP-167 N-17-2 시나리오 조건 — 금리 변화(%p), 소득 변화(%), 지출 변화(%). 기준값은 서버가 저장 데이터에서 읽으므로 받지 않는다.
 * 생략하면 0(변화 없음)이다. 직접 입력 범위: 금리 −5~+10%p, 소득 −100~+100%, 지출 −50~+100%.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScenarioRecalculateRequest {
    /** 금리 변화 (%p). 변동금리 대출 잔액에만 반영한다 */
    private Double ratePctPoint;
    /** 월 소득 변화 (%) */
    private Double incomePct;
    /** 월 지출 변화 (%) */
    private Double expensePct;
}
