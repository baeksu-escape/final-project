package com.baeksuescape.finance.dto.scenario;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-17-2 FACT_POLICY_RATE 조회 결과 한 행 — 기준일과 금리(연 %).
 */
@Getter
@Setter
@NoArgsConstructor
public class PolicyRateRow {
    private LocalDate baseDate;
    private BigDecimal ratePct;
}
