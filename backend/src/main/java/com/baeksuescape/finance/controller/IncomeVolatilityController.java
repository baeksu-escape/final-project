package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.cashflow.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.cashflow.CashFlowForecastRequest;
import com.baeksuescape.finance.dto.cashflow.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityRequest;
import com.baeksuescape.finance.dto.cashflow.ExpectedScoreResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityResponse;
import com.baeksuescape.finance.service.ExpectedScoreService;
import com.baeksuescape.finance.service.IncomeVolatilityService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * N-22 소득 변동성 진단 및 N-21 현금흐름 전망 REST 컨트롤러.
 * 프론트엔드 재무 진단 탭의 소득 변동성 화면과 현금흐름 시뮬레이터에 진단 결과를 제공한다.
 */
@RestController
@RequestMapping("/api/diagnosis")
@RequiredArgsConstructor
public class IncomeVolatilityController {

    private final IncomeVolatilityService incomeVolatilityService;
    private final ExpectedScoreService expectedScoreService;

    /**
     * N-22 소득 변동성 종합 진단 API (N-22-3, N-22-4, N-22-5).
     * 12개월 소득 및 고정지출을 전달받아 변동계수, 성수기·비수기 격차, 다음 비수기 도래 월을 반환한다.
     */
    @PostMapping("/income-volatility")
    public ResponseEntity<IncomeVolatilityResponse> diagnoseIncomeVolatility(@RequestBody IncomeVolatilityRequest request) {
        IncomeVolatilityResponse response = incomeVolatilityService.diagnoseIncomeVolatility(request);
        return ResponseEntity.ok(response);
    }

    /**
     * N-21 현금흐름 전망 API (N-21-5, N-21-6, N-21-7).
     * 소득/지출 변동 조건을 반영하여 예측 기간 동안의 월별 순현금과 가장 빠듯한 달을 반환한다.
     */
    @PostMapping("/cash-flow/forecast")
    public ResponseEntity<CashFlowForecastResponse> forecastCashFlow(@RequestBody CashFlowForecastRequest request) {
        CashFlowForecastResponse response = incomeVolatilityService.forecastCashFlow(request);
        return ResponseEntity.ok(response);
    }

    /**
     * N-22 소득 변동성 진단 API — 저장 데이터 기반 (N-22-1, N-22-3~5).
     * 로그인한 회원(토큰)의 최근 12개월 소득과 월 고정지출로 계산한다. 주소로 회원 번호를 받지 않는다(남의 정보 조회 방지).
     */
    @GetMapping("/income-volatility")
    public ResponseEntity<IncomeVolatilityResponse> diagnoseSavedIncomeVolatility(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(incomeVolatilityService.diagnoseSavedIncomeVolatility(requireLoginUserId(user)));
    }

    /**
     * N-21 현금흐름 전망 API — 저장 데이터 기반 (N-21-1, N-21-5~7).
     * 로그인한 회원(토큰)의 소득·월 지출 합계·월 원리금에 쿼리로 받은 전망 조건(N-21-2)을 적용한다.
     */
    @GetMapping("/cash-flow/forecast")
    public ResponseEntity<CashFlowForecastResponse> forecastSavedCashFlow(@AuthenticationPrincipal AuthUser user,
                                                                          @ModelAttribute CashFlowConditionRequest condition) {
        return ResponseEntity.ok(incomeVolatilityService.forecastSavedCashFlow(requireLoginUserId(user), condition));
    }

    /**
     * N-21-8 DIAG-09 예상 대안 점수 — 전망 조건(N-21-2)의 소득·지출 변화를 저장된 입력에 반영해 ML-03으로 다시 구한다(저장 안 함).
     * 본문은 현금흐름 전망 쿼리와 같은 이름을 쓴다. 점수가 나온 평가가 없으면 404 ASSESSMENT_NOT_FOUND.
     */
    @PostMapping("/cash-flow/expected-score")
    public ResponseEntity<ExpectedScoreResponse> expectedScore(@AuthenticationPrincipal AuthUser user,
                                                               @RequestBody(required = false) CashFlowConditionRequest condition) {
        return ResponseEntity.ok(expectedScoreService.expectedScore(requireLoginUserId(user), condition));
    }

    /**
     * 토큰에서 꺼낸 로그인 회원 번호. 토큰이 없거나 쓸 수 없으면 401이다.
     * /api/diagnosis/**는 아직 임시 개방 경로라 보안 설정이 막지 않으므로 여기서 직접 확인한다.
     * TODO(A조 협의) 임시 개방 목록에서 /api/diagnosis/**를 빼면 보안 설정이 먼저 막는다.
     */
    private long requireLoginUserId(AuthUser user) {
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        }
        return user.userId();
    }
}

