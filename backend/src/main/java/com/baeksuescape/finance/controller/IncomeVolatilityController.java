package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.CashFlowForecastRequest;
import com.baeksuescape.finance.dto.CashFlowForecastResponse;
import com.baeksuescape.finance.dto.IncomeVolatilityRequest;
import com.baeksuescape.finance.dto.IncomeVolatilityResponse;
import com.baeksuescape.finance.service.IncomeVolatilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

