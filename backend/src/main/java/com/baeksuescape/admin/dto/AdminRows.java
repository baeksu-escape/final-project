package com.baeksuescape.admin.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// FP-80 관리자 매퍼가 읽고 쓰는 행. 개인정보 칸은 암호문 그대로 받고, 서비스가 복호화해 가린 값으로 바꾼다.
public final class AdminRows {

    private AdminRows() {
    }

    // ADM-05 계정 한 줄(APP_USER + 최근 대안 점수 + 작성 글·댓글 신고 건수)
    @Getter
    @Setter
    @NoArgsConstructor
    public static class UserData {
        private Long userId;
        private String loginId;
        private String nameEnc;
        private String roleCode;
        private String workerTypeCode;
        private Integer latestAltScore;
        private String accountStatusCode;
        private Integer reportedPostCount;
        private LocalDateTime createdAt;
        private LocalDateTime lastLoginAt;
        // FP-273 ACCT-03 닉네임(가리지 않는 공개 값). 탈퇴 회원은 DB의 표시값('탈퇴'+회원 번호) 그대로.
        private String nickname;
    }

    // ADM-08 최근 평가(ASSESSMENT)
    @Getter
    @Setter
    @NoArgsConstructor
    public static class AssessmentData {
        private String requestId;
        private Integer tradScore;
        private Integer altScore;
        private String altGradeBandCode;
        private LocalDateTime assessedAt;
    }

    // ADM-08 대안 데이터 종류별 불러온 개월 수
    @Getter
    @Setter
    @NoArgsConstructor
    public static class AltMonths {
        private int telecom;
        private int utility;
        private int easypay;
        private int nationalPension;
        private int healthInsurance;
    }

    // ADM-09 열람 감사 로그 한 줄(열람자·대상 아이디와 대상 이름 암호문)
    @Getter
    @Setter
    @NoArgsConstructor
    public static class AccessLogData {
        private LocalDateTime accessedAt;
        private String viewerLoginId;
        private Long targetUserId;
        private String targetLoginId;
        private String targetNameEnc;
        private String reason;
        // ACCESSED_RESOURCE(RESOURCE는 Oracle 예약어라 별칭으로 쓰지 않는다)
        private String accessedResource;
    }

    // ADM-10 시스템 로그 한 줄
    @Getter
    @Setter
    @NoArgsConstructor
    public static class SystemLogData {
        private LocalDateTime createdAt;
        private String logTypeCode;
        private String logSource;
        private String message;
    }
}
