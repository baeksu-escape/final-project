package com.baeksuescape.finance.dto;

import java.util.Map;

/**
 * FP-170 N-18-2·N-18-3 SIM-02 요청 — 화면에서 바꾼 값만 ML-04 키 이름으로 보낸다.
 * 값의 형식(0 이상 정수·범위)은 키마다 서비스에서 검사해 fieldErrors에 `changes.<키>`로 알려 주려고 Object로 받는다.
 */
public record CreditCareSimulationRequest(Map<String, Object> changes) {
}
