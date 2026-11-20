package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.health.DsrCalculateRequest;
import com.baeksuescape.finance.dto.health.DsrCalculateResponse;
import com.baeksuescape.finance.dto.health.FinancialHealthRequest;
import com.baeksuescape.finance.dto.health.FinancialHealthResponse;
import com.baeksuescape.finance.service.FinancialHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * FP-166 자산·부채 건전성(N-16)과 DSR 계산기(N-20) REST 컨트롤러.
 * 요청 본문으로 받은 값으로 계산만 한다(DB 조회 없음). 저장 데이터 조회 연결은 후속 작업이다.
 */
@RestController
@RequestMapping("/api/diagnosis")
@RequiredArgsConstructor
public class FinancialHealthController {

    private final FinancialHealthService financialHealthService;

    /**
     * N-20-4 DSR 계산 API. 연소득과 연간 원리금 상환액으로 DSR과 위험 단계를 돌려준다.
     * 경로·필드는 프론트 mock(POST /api/diagnosis/dsr/calculate)과 같다.
     */
    @PostMapping("/dsr/calculate")
    public ResponseEntity<DsrCalculateResponse> calculateDsr(@RequestBody DsrCalculateRequest request) {
        return ResponseEntity.ok(financialHealthService.calculateDsr(request));
    }

    /**
     * N-16-1·2·3 건전성 지표 계산 API. 총자산·연소득·총부채·연간 원리금으로 비율 3개와 위험 단계를 돌려준다.
     * 값 바꿔 보기(N-16-3)에서 바꾼 값을 보낼 때도 같은 API를 쓴다.
     */
    @PostMapping("/financial-health/calculate")
    public ResponseEntity<FinancialHealthResponse> calculateHealth(@RequestBody FinancialHealthRequest request) {
        return ResponseEntity.ok(financialHealthService.calculateHealth(request));
    }
}
