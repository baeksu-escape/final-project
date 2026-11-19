package com.baeksuescape.finance.dto.simulation;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-18-7 현재 사용 중(ACTIVE)인 등급 구간에서 점수에 맞는 등급 한 행.
 */
@Getter
@Setter
@NoArgsConstructor
public class GradeBandRow {
    /** 등급 코드 (GOOD / STANDARD / CAUTION) */
    private String gradeBandCode;
    /** 등급 구간 버전 (예: CUT-0.1) */
    private String cutoffVersion;
}
