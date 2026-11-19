package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.cashflow.CashFlowForecastRequest;
import com.baeksuescape.finance.dto.cashflow.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityRequest;
import com.baeksuescape.finance.dto.cashflow.IncomeVolatilityResponse;
import com.baeksuescape.finance.service.IncomeVolatilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * N-22 소득 변동성 진단 및 N-21 현금흐름 전망 REST 컨트롤러.
 * 여기에는 요청 본문 값만으로 계산하는 API를 둔다. 저장 데이터로 계산하는 DIAG-07-1·08-1·09는 MemberFinanceController(/api/members/me)에 있다.
 */
@RestController
@RequestMapping("/api/diagnosis")
@RequiredArgsConstructor
public class IncomeVolatilityController {

    private final IncomeVolatilityService incomeVolatilityService;

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
}

