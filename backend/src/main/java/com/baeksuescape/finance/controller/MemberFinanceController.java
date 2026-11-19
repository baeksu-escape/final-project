package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.cashflow.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.cashflow.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.cashflow.ExpectedScoreResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareBaseResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationRequest;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse;
import com.baeksuescape.finance.service.CreditCareSimulationService;
import com.baeksuescape.finance.service.ExpectedScoreService;
import com.baeksuescape.finance.service.IncomeVolatilityService;
import com.baeksuescape.global.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * FP-170 로그인 회원의 저장 데이터로 계산하는 재무 진단·시뮬레이터 API (팀 공통 규칙: 내 데이터는 /api/members/me/**).
 * 로그인 확인은 보안 설정이 먼저 한다(ROLE_USER만, 토큰 없음 401·관리자 403). 회원은 토큰에서만 꺼내고 주소로 받지 않는다.
 */
@RestController
@RequestMapping("/api/members/me")
@RequiredArgsConstructor
public class MemberFinanceController {

    private final CreditCareSimulationService creditCareSimulationService;
    private final IncomeVolatilityService incomeVolatilityService;
    private final ExpectedScoreService expectedScoreService;

    /** N-18-1·N-18-8·N-18-10 SIM-01 입력 10개의 내 실제 값과 출발 평가의 감점 요인 상위 3개. 평가가 없으면 404 ASSESSMENT_NOT_FOUND. */
    @GetMapping("/credit-care-base")
    public ResponseEntity<CreditCareBaseResponse> getCreditCareBase(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(creditCareSimulationService.base(user.userId()));
    }

    /** N-18-5·N-18-8 SIM-02 바꾼 값으로 점수 재계산 (FastAPI ML-04, 저장 안 함). */
    @PostMapping("/credit-care-recalculate")
    public ResponseEntity<CreditCareSimulationResponse> recalculateCreditCare(@AuthenticationPrincipal AuthUser user,
            @RequestBody(required = false) CreditCareSimulationRequest request) {
        return ResponseEntity.ok(creditCareSimulationService.recalculate(user.userId(), request));
    }

    /** N-22-1·N-22-3~5 DIAG-07-1 저장된 최근 12개월 소득과 월 고정지출로 소득 변동성을 진단한다. */
    @GetMapping("/income-volatility")
    public ResponseEntity<IncomeVolatilityResponse> diagnoseSavedIncomeVolatility(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(incomeVolatilityService.diagnoseSavedIncomeVolatility(user.userId()));
    }

    /** N-21-1·N-21-2·N-21-5~7 DIAG-08-1 저장된 소득·지출·원리금에 쿼리로 받은 전망 조건을 적용한 현금흐름 전망. */
    @GetMapping("/cash-flow-forecast")
    public ResponseEntity<CashFlowForecastResponse> forecastSavedCashFlow(@AuthenticationPrincipal AuthUser user,
            @ModelAttribute CashFlowConditionRequest condition) {
        return ResponseEntity.ok(incomeVolatilityService.forecastSavedCashFlow(user.userId(), condition));
    }

    /** N-21-8 DIAG-09 전망 조건을 저장된 입력에 반영해 ML-03으로 다시 구한 예상 대안 점수 (저장 안 함). */
    @PostMapping("/cash-flow-expected-score")
    public ResponseEntity<ExpectedScoreResponse> expectedScore(@AuthenticationPrincipal AuthUser user,
            @RequestBody(required = false) CashFlowConditionRequest condition) {
        return ResponseEntity.ok(expectedScoreService.expectedScore(user.userId(), condition));
    }
}
