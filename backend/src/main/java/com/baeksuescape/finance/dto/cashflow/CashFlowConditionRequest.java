package com.baeksuescape.finance.dto.cashflow;

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

    /**
     * N-21-2 월 소득 변동 폭 (%, 0~200 정수, 생략 가능). 전망 소득 = 평균 + (과거 같은 달 소득 − 평균) × 변동 폭.
     * 0이면 매달 평균, 100이면 과거 월별 패턴 그대로다. 생략하면 매달 평균(지금 방식)이다.
     */
    private Integer incomeVariationPct;

    /** N-21-2 월 고정 지출 (원, 0 이상, 생략 가능). 보내면 저장된 고정지출(FIXED 합계) 대신 이 값을 쓴다. */
    private Long fixedExpenseAmount;

    /** N-21-2 카드값·대출 납부 상태 (ON_TIME 제때·DELAYED 밀림, 생략 가능). 값만 검사하고 예상 점수(DIAG-09)에서 쓴다. */
    private String paymentStatus;
}
