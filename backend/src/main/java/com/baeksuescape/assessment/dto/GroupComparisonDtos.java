package com.baeksuescape.assessment.dto;

import java.util.List;

import com.baeksuescape.admin.dto.AdminStatsDtos.GroupStats;

// FP-164 N-26-5~7 사용자 비교 분석(ADM-04) 응답. 집계 기준은 관리자 통계 ADM-03(FP-161)과 같다(11/23 동주 합의):
// ACTIVE 모델로 낸 서비스 회원의 최근 SCORED 평가 1건, 탈퇴 회원 제외, 값마다 계산 인원이 minGroupSize(5)명보다 적으면 null.
// 한 집단의 값 모양은 ADM-03 groups[]와 같은 GroupStats다(memberCount·avgTradScore·avgAltScore·avgScoreUplift·
// standardOrAboveRatePct·gradeDistribution·tradStandardOrAboveRatePct·tradGradeDistribution·tradScoredMemberCount).
// 관리자 전용 수치(가입 회원 수·오늘 산출)는 넣지 않는다(N-26-5).
public final class GroupComparisonDtos {

    private GroupComparisonDtos() {
    }

    // modelVersion = 통계 기준 모델(ACTIVE, 없으면 null).
    // overall = 전체(groupCode "ALL"), byWorkerType = 직군 3개(N-26-6 격자의 행 평균, N-26-7 직군별), byAgeBand = 연령대 4개(격자의 열 평균, N-26-7 연령별),
    // grid = 직군 × 연령대 12칸(직군 순서 → 연령대 순서), me = 내 평가(N-26-6 '나' 칸, N-26-7 내 점수 세로선). ACTIVE 모델로 점수가 나온 평가가 없으면 null.
    public record GroupComparisonResponse(
            String modelVersion,
            int minGroupSize,
            Me me,
            GroupStats overall,
            List<GroupStats> byWorkerType,
            List<GroupStats> byAgeBand,
            List<GridCell> grid) {
    }

    // 직군 × 연령대 한 칸. stats.groupCode는 "직군:연령대"(예: "EMPLOYEE:30S")다
    public record GridCell(String workerTypeCode, String ageBandCode, GroupStats stats) {
    }

    // 내 최근 평가(통계에 들어간 바로 그 평가). 직군·연령대는 평가 시점 값이라 격자의 내 칸과 같다.
    // 본인 값이라 5명 기준으로 숨기지 않는다. 기존 모델로 산출할 수 없었으면 tradScore·tradGradeBandCode는 null
    public record Me(
            String workerTypeCode,
            String ageBandCode,
            Integer tradScore,
            Integer altScore,
            String tradGradeBandCode,
            String altGradeBandCode) {
    }
}
