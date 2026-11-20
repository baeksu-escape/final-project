package com.baeksuescape.admin.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// FP-161 N-26 관리자 직군·연령별 통계(ADM-03) 매퍼가 읽는 행.
public final class AdminStatsRows {

    private AdminStatsRows() {
    }

    // 회원 한 명의 최근 SCORED 서비스 평가(탈퇴 회원 제외). 직군·연령대는 평가 시점 값이다.
    @Getter
    @Setter
    @NoArgsConstructor
    public static class MemberScore {
        private Long userId;
        private String workerTypeCode;
        private String ageBandCode;
        /** 기존 신용 점수. 기존 모델로 산출할 수 없었으면 null */
        private Integer tradScore;
        private Integer altScore;
        /** 대안 점수 등급(CAUTION·STANDARD·GOOD, 평가 때 저장된 값) */
        private String altGradeBandCode;
    }
}
