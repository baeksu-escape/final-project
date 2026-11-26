package com.baeksuescape.finance.dto.scenario;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-167 N-17-4·N-17-5 시나리오 결과 — 지금(current)과 조건 반영 후(changed)의 상환 여력을 나란히 담는다. 점수는 구하지 않는다.
 * 필드 이름은 시나리오 화면(calculateScenario 반환 모양)과 같다. 계산할 수 없는 값은 null이다.
 */
public record ScenarioRecalculateResponse(
        Side current,
        Side changed,
        Long monthlyInterestChangeAmount,
        Long surplusDiffAmount,
        Long survivableMonths,
        String verdict,
        List<String> assumptions,
        List<ScenarioBaseResponse.ScenarioLoanItem> loanItems) {

    /** 기존 일곱 인자 호출부를 보존하며 대출 상세는 빈 목록으로 둔다. */
    public ScenarioRecalculateResponse(Side current, Side changed, Long monthlyInterestChangeAmount,
                                       Long surplusDiffAmount, Long survivableMonths, String verdict,
                                       List<String> assumptions) {
        this(current, changed, monthlyInterestChangeAmount, surplusDiffAmount, survivableMonths, verdict,
                assumptions, List.of());
    }

    /** 한쪽(지금 또는 조건 반영 후)의 월 소득·지출·상환액·잉여(원)와 상환 부담률(%, 소득이 0 이하이면 null) */
    public record Side(Long monthlyIncomeAmount, Long monthlyExpenseAmount, Long monthlyPaymentAmount,
            Long monthlySurplusAmount, BigDecimal dsrPct) {
    }
}
