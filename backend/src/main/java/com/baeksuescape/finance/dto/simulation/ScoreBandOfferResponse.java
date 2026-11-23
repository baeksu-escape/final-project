package com.baeksuescape.finance.dto.simulation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * N-18-7 같은 점수대 참고 금리·한도 응답 DTO (FP-170).
 * SIM-04 응답이다(SIM-03 추천 API는 만들지 않는다, 정의서 Q-9). 금리·한도는 더미 데이터이며 "같은 점수대의 참고 정보"로만 보여 준다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScoreBandOfferResponse {
    /** 조회한 점수 (0~1000) */
    private int score;
    /** 등급 (GOOD / STANDARD / CAUTION) */
    private String gradeBand;
    /** 등급 구간 버전 (예: CUT-0.1) */
    private String cutoffVersion;
    /** 점수대 최소·최대 점수 */
    private int bandMinScore;
    private int bandMaxScore;
    /** 참고 연 금리 최소·최대 (%) */
    private double expectedMinRate;
    private double expectedMaxRate;
    /** 참고 연 금리 평균 (%). 자료에 없으면 null */
    private Double expectedAvgRate;
    /** 참고 한도 (원) */
    private long expectedLimitAmount;
    /** 자료 기준일 ("YYYY-MM-DD") */
    private String baseDate;
    /** 더미 데이터 안내 표시 여부 (항상 true) */
    private boolean dummyNotice;
}
