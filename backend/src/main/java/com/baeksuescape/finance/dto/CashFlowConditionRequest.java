package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-21-2 전망 조건 (저장 데이터 기반 현금흐름 전망용).
 * 소득·지출·원리금 변화율(%)과 예측 기간(3·6·12개월)을 쿼리 값으로 받는다.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashFlowConditionRequest {
    /** 소득 변화율 (%, 예: -10.0은 10% 감소) */
    private double incomeChangePercent;
    /** 지출 변화율 (%) */
    private double expenseChangePercent;
    /** 원리금 변화율 (%) */
    private double loanPaymentChangePercent;
    /** 예측 기간 (개월, 0 이하이면 6) */
    private int forecastMonths;
}
