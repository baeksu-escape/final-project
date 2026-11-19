package com.baeksuescape.finance.dto.simulation;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * N-18-7 SCORE_BAND_OFFER 조회 결과 한 행 — 점수대별 참고 금리·한도(더미).
 */
@Getter
@Setter
@NoArgsConstructor
public class ScoreBandOfferRow {
    /** 점수대 최소·최대 점수 */
    private int minScore;
    private int maxScore;
    /** 연 금리 최소·최대·평균 (%). 평균은 없을 수 있다 */
    private BigDecimal rateMinPct;
    private BigDecimal rateMaxPct;
    private BigDecimal rateAvgPct;
    /** 참고 한도 (원) */
    private long limitAmt;
    /** 자료 기준일 */
    private LocalDate baseDate;
}
