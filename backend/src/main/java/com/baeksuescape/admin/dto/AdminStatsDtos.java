package com.baeksuescape.admin.dto;

import java.math.BigDecimal;
import java.util.List;

// FP-161 N-26-1~4 관리자 직군·연령별 통계(ADM-03) 응답. 점수 평균·비율은 소수 첫째 자리(HALF_UP).
// 값마다 실제로 계산에 들어간 인원이 minGroupSize(5)명보다 적으면 그 값은 null이다(몇 명뿐이면 개인 점수가 드러난다, 11/23 리뷰 반영).
// 대안 값은 그룹 전원(memberCount), 기존 평균·기존 등급 값·상승폭은 기존 모델로 산출된 회원(tradScoredMemberCount)으로 계산한다.
// 등급 값은 11/06 UI처럼 기존 → 대안을 나란히 보여 주도록 두 벌이다: standardOrAboveRatePct·gradeDistribution = 대안 모델,
// trad* = 기존 모델(기존 모델로 산출된 회원만 분모, 11/23 추가).
// modelVersion = 통계 기준 모델(ACTIVE). 이 모델로 낸 평가만 센다(옛 모델·Mock 평가 제외, 11/23 리뷰 반영). ACTIVE가 없으면 null.
public final class AdminStatsDtos {

    private AdminStatsDtos() {
    }

    // N-26-1 구분(groupBy: WORKER_TYPE·AGE_BAND), N-26-2 요약, N-26-3 등급 분포(대안·기존), N-26-4 그룹별 통계 표
    public record StatsResponse(
            String groupBy,
            int minGroupSize,
            Summary summary,
            List<GradeCount> gradeDistribution,
            List<GroupStats> groups,
            List<GradeCount> tradGradeDistribution,
            String modelVersion) {
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
            long todayScoredCount,
            BigDecimal tradStandardOrAboveRatePct,
            int tradScoredMemberCount) {
    }

    // N-26-3 등급 분포 한 칸
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
            List<GradeCount> gradeDistribution,
            BigDecimal tradStandardOrAboveRatePct,
            List<GradeCount> tradGradeDistribution,
            int tradScoredMemberCount) {
    }
}
