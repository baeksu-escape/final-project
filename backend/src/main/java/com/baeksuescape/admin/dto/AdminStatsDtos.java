package com.baeksuescape.admin.dto;

import java.math.BigDecimal;
import java.util.List;

// FP-161 N-26-1~4 관리자 직군·연령별 통계(ADM-03) 응답. 점수 평균·비율은 소수 첫째 자리(HALF_UP).
// 대상 회원이 minGroupSize(5)명보다 적은 그룹(또는 전체)은 평균·비율·등급 분포가 null이다(몇 명뿐이면 개인 점수가 드러난다).
public final class AdminStatsDtos {

    private AdminStatsDtos() {
    }

    // N-26-1 구분(groupBy: WORKER_TYPE·AGE_BAND), N-26-2 요약, N-26-3 등급 분포, N-26-4 그룹별 통계 표
    public record StatsResponse(
            String groupBy,
            int minGroupSize,
            Summary summary,
            List<GradeCount> gradeDistribution,
            List<GroupStats> groups) {
    }

    // N-26-2 요약 수치. assessedMemberCount = 최근 SCORED 평가가 있는 회원 수(탈퇴 제외), registeredMemberCount = 가입 회원 수(탈퇴 제외),
    // todayScoredCount = 오늘 저장된 서비스 SCORED 평가 수(관리자 전용 수치)
    public record Summary(
            int assessedMemberCount,
            BigDecimal avgTradScore,
            BigDecimal avgAltScore,
            BigDecimal avgScoreUplift,
            BigDecimal standardOrAboveRatePct,
            long registeredMemberCount,
            long todayScoredCount) {
    }

    // N-26-3 등급 분포 한 칸 (대안 점수 등급)
    public record GradeCount(String gradeBandCode, int count, BigDecimal ratePct) {
    }

    // N-26-4 그룹(직군 또는 연령대) 한 줄
    public record GroupStats(
            String groupCode,
            int memberCount,
            BigDecimal avgTradScore,
            BigDecimal avgAltScore,
            BigDecimal avgScoreUplift,
            BigDecimal standardOrAboveRatePct,
            List<GradeCount> gradeDistribution) {
    }
}
