package com.baeksuescape.assessment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.baeksuescape.admin.dto.AdminStatsDtos.GroupStats;
import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.assessment.dto.GroupComparisonDtos.GridCell;
import com.baeksuescape.assessment.dto.GroupComparisonDtos.GroupComparisonResponse;

// FP-164 ADM-04 사용자 비교 분석 — 집단 나누기(전체·직군 3·연령대 4·격자 12)와 내 평가 찾기. 값 계산 자체는 AdminStatsServiceTest가 확인한다.
class GroupComparisonServiceTest {

    private static long nextUserId = 100;

    private static MemberScore member(String workerType, String ageBand, Integer trad, int alt, String altGrade) {
        MemberScore m = new MemberScore();
        m.setUserId(nextUserId++);
        m.setWorkerTypeCode(workerType);
        m.setAgeBandCode(ageBand);
        m.setTradScore(trad);
        m.setAltScore(alt);
        m.setAltGradeBandCode(altGrade);
        m.setTradGradeBandCode(trad == null ? null : "CAUTION");
        return m;
    }

    private static List<MemberScore> sample() {
        List<MemberScore> members = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            members.add(member("EMPLOYEE", "30S", 640, 700, "STANDARD"));   // 격자 한 칸에 5명
        }
        members.add(member("EMPLOYEE", "20S", 600, 660, "STANDARD"));      // 직군 행 6명, 칸은 1명
        members.add(member("FREELANCER", "30S", null, 620, "CAUTION"));    // 기존 점수 없음
        return members;
    }

    private static GridCell cell(GroupComparisonResponse res, String workerType, String ageBand) {
        return res.grid().stream()
                .filter(c -> c.workerTypeCode().equals(workerType) && c.ageBandCode().equals(ageBand))
                .findFirst().orElseThrow();
    }

    @Test
    @DisplayName("전체·직군 3·연령대 4·격자 12칸을 고정 순서로 만들고, 0명 집단도 행이 있다")
    void groupsInFixedOrder() {
        GroupComparisonResponse res = GroupComparisonService.build(1L, sample(), "LGBM-BASE-0.2");

        assertThat(res.modelVersion()).isEqualTo("LGBM-BASE-0.2");
        assertThat(res.minGroupSize()).isEqualTo(5);
        assertThat(res.overall().groupCode()).isEqualTo("ALL");
        assertThat(res.overall().memberCount()).isEqualTo(7);
        assertThat(res.byWorkerType()).extracting(GroupStats::groupCode).containsExactly("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");
        assertThat(res.byWorkerType()).extracting(GroupStats::memberCount).containsExactly(6, 0, 1);
        assertThat(res.byAgeBand()).extracting(GroupStats::groupCode).containsExactly("20S", "30S", "40S", "50_PLUS");
        assertThat(res.byAgeBand()).extracting(GroupStats::memberCount).containsExactly(1, 6, 0, 0);
        assertThat(res.grid()).hasSize(12);
        assertThat(res.grid().get(0).workerTypeCode()).isEqualTo("EMPLOYEE");
        assertThat(res.grid().get(0).ageBandCode()).isEqualTo("20S");
        assertThat(res.grid().get(11).workerTypeCode()).isEqualTo("FREELANCER");
        assertThat(res.grid().get(11).ageBandCode()).isEqualTo("50_PLUS");
        assertThat(cell(res, "EMPLOYEE", "30S").stats().groupCode()).isEqualTo("EMPLOYEE:30S");
    }

    @Test
    @DisplayName("값은 ADM-03과 같은 기준: 계산 인원 5명 이상이면 평균, 5명 미만 칸·집단은 null")
    void sameRulesAsAdminStats() {
        GroupComparisonResponse res = GroupComparisonService.build(1L, sample(), "LGBM-BASE-0.2");

        GroupStats employee30s = cell(res, "EMPLOYEE", "30S").stats();
        assertThat(employee30s.memberCount()).isEqualTo(5);
        assertThat(employee30s.avgAltScore()).isEqualByComparingTo(new BigDecimal("700.0"));
        assertThat(employee30s.avgScoreUplift()).isEqualByComparingTo(new BigDecimal("60.0"));
        assertThat(employee30s.standardOrAboveRatePct()).isEqualByComparingTo(new BigDecimal("100.0"));

        GroupStats employee20s = cell(res, "EMPLOYEE", "20S").stats();
        assertThat(employee20s.memberCount()).isEqualTo(1);
        assertThat(employee20s.avgAltScore()).isNull();
        assertThat(employee20s.gradeDistribution()).isNull();

        // 전체 7명: 대안 평균은 7명, 기존 평균은 기존 점수가 있는 6명으로 낸다
        assertThat(res.overall().avgAltScore()).isEqualByComparingTo(new BigDecimal("682.9"));
        assertThat(res.overall().avgTradScore()).isEqualByComparingTo(new BigDecimal("633.3"));
        assertThat(res.overall().tradScoredMemberCount()).isEqualTo(6);
    }

    @Test
    @DisplayName("me는 통계에 들어간 내 평가이고, 없으면 null")
    void me() {
        List<MemberScore> members = sample();
        MemberScore mine = members.get(6);   // 프리랜서·30대, 기존 점수 없음

        GroupComparisonResponse res = GroupComparisonService.build(mine.getUserId(), members, "LGBM-BASE-0.2");
        assertThat(res.me().workerTypeCode()).isEqualTo("FREELANCER");
        assertThat(res.me().ageBandCode()).isEqualTo("30S");
        assertThat(res.me().altScore()).isEqualTo(620);
        assertThat(res.me().altGradeBandCode()).isEqualTo("CAUTION");
        assertThat(res.me().tradScore()).isNull();
        assertThat(res.me().tradGradeBandCode()).isNull();

        assertThat(GroupComparisonService.build(9999L, members, "LGBM-BASE-0.2").me()).isNull();
    }

    @Test
    @DisplayName("ACTIVE 모델이 없으면 평가를 읽지 않고 모든 집단 0명, modelVersion·me null")
    void noActiveModel() {
        AdminStatsMapper mapper = mock(AdminStatsMapper.class);
        when(mapper.selectActiveModelVersion()).thenReturn(null);

        GroupComparisonResponse res = new GroupComparisonService(mapper).compare(1L);

        assertThat(res.modelVersion()).isNull();
        assertThat(res.me()).isNull();
        assertThat(res.overall().memberCount()).isZero();
        assertThat(res.overall().avgAltScore()).isNull();
        assertThat(res.grid()).hasSize(12).allSatisfy(c -> assertThat(c.stats().memberCount()).isZero());
        verify(mapper).selectActiveModelVersion();
        verifyNoMoreInteractions(mapper);
    }
}
