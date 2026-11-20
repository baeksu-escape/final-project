package com.baeksuescape.finance.dto.scenario;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * FP-167 N-17-1 시나리오 기준값 — 로그인 회원의 월 소득·지출·상환액, 변동금리 대출 잔액, 총자산, 현재 정책금리.
 * 필드 이름은 시나리오 화면 adapter와 같다. 총자산을 입력하지 않았으면 totalAssetAmount가 null이다. 정책금리가 없으면 policyRate가 null이다.
 */
public record ScenarioBaseResponse(
        Long monthlyIncomeAmount,
        Long monthlyExpenseAmount,
        Long monthlyPaymentAmount,
        Long variableLoanBalanceAmount,
        Long totalAssetAmount,
        PolicyRate policyRate,
        List<String> assumptions) {

    /** 시나리오 출발 금리: 기준일과 연 % (예: 2026-10-31, 3.000) */
    public record PolicyRate(LocalDate baseDate, BigDecimal ratePct) {
    }
}
