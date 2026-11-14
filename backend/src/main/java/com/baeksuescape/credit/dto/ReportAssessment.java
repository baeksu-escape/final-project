package com.baeksuescape.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

// N-12-1 저장된 평가 한 건의 조회 값이다. 회원 개인정보와 입력 원문은 조회하지 않는다.
@Getter
@Setter
public class ReportAssessment {
    private Long assessmentId;
    private String requestId;
    private String inputBaseMonth;
    private String workerTypeCode;
    private String gradeStatusCode;
    private String notScorableReasonCode;
    private String modelVersion;
    private String cutoffVersion;
    private String tradScorableYn;
    private String tradGradeBandCode;
    private String altScorableYn;
    private String altGradeBandCode;
    private String aiSummary;
    private Integer tradScore;
    private Integer altScore;
    private Integer shapBaseScore;
    private BigDecimal tradDefaultProb;
    private BigDecimal altDefaultProb;
    // N-12-1 Oracle TIMESTAMP의 시간대 없는 값을 유지한다. 시간대 변환 계약은 인증·API 연결 시 확정해야 한다.
    private LocalDateTime assessedAt;
}
