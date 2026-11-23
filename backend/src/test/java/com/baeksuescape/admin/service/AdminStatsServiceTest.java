package com.baeksuescape.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.baeksuescape.admin.dto.AdminStatsDtos.GradeCount;
import com.baeksuescape.admin.dto.AdminStatsDtos.GroupStats;
import com.baeksuescape.admin.dto.AdminStatsDtos.StatsResponse;
import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.global.exception.ApiException;

/**
 * FP-161 N-26 관리자 통계 서비스 테스트 — 평균(기존·대안·상승폭), Standard 이상 비율, 등급 분포, 5명 미만 숨김, 그룹 고정 순서,
 * groupBy 기본값·400, 오늘 산출 기준 시각을 DB 없이 확인한다.
 */
class AdminStatsServiceTest {

    private static MemberScore member(String workerType, String ageBand, Integer trad, Integer alt, String grade) {
        MemberScore m = new MemberScore();
        m.setWorkerTypeCode(workerType);
        m.setAgeBandCode(ageBand);
        m.setTradScore(trad);
        m.setAltScore(alt);
        m.setAltGradeBandCode(grade);
        m.setTradGradeBandCode(tradGrade(trad));
        return m;
    }

    // 기존 등급은 기존 점수로 정한다(평가 때 저장되는 값과 같은 CUT-0.1 경계 665·780). 기존 점수가 없으면 기존 등급도 없다.
    private static String tradGrade(Integer trad) {
        if (trad == null) {
            return null;
        }
        return trad >= 780 ? "GOOD" : trad >= 665 ? "STANDARD" : "CAUTION";
    }

    /** 급여소득자 5명(30대 3·40대 2)과 프리랜서 2명(20대) */
    private static List<MemberScore> sample() {
        List<MemberScore> list = new ArrayList<>();
        list.add(member("EMPLOYEE", "30S", 600, 650, "CAUTION"));
        list.add(member("EMPLOYEE", "30S", 640, 700, "STANDARD"));
        list.add(member("EMPLOYEE", "30S", 700, 760, "STANDARD"));
        list.add(member("EMPLOYEE", "40S", 750, 800, "GOOD"));
        list.add(member("EMPLOYEE", "40S", null, 690, "STANDARD"));   // 기존 모델로 산출 못 함
        list.add(member("FREELANCER", "20S", 580, 640, "CAUTION"));
        list.add(member("FREELANCER", "20S", 600, 700, "STANDARD"));
        return list;
    }

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    @Test
    @DisplayName("요약: 평가 고객 7명, 기존 평균은 기존 점수가 있는 6명, 상승폭은 두 점수가 다 있는 6명, Standard 이상 5/7")
    void summary() {
        StatsResponse r = AdminStatsService.build("WORKER_TYPE", sample(), 120L, 3L);

        assertEquals("WORKER_TYPE", r.groupBy());
        assertEquals(5, r.minGroupSize());
        assertEquals(7, r.summary().assessedMemberCount());
        assertEquals(0, d("645.0").compareTo(r.summary().avgTradScore()), "(600+640+700+750+580+600)/6 = 645");
        assertEquals(0, d("705.7").compareTo(r.summary().avgAltScore()), "4940/7 = 705.71…");
        assertEquals(0, d("63.3").compareTo(r.summary().avgScoreUplift()), "(50+60+60+50+60+100)/6 = 63.33…");
        assertEquals(0, d("71.4").compareTo(r.summary().standardOrAboveRatePct()), "5/7 = 71.43%");
        assertEquals(120L, r.summary().registeredMemberCount());
        assertEquals(3L, r.summary().todayScoredCount());

        List<GradeCount> grades = r.gradeDistribution();
        assertEquals(List.of("CAUTION", "STANDARD", "GOOD"), grades.stream().map(GradeCount::gradeBandCode).toList());
        assertEquals(List.of(2, 4, 1), grades.stream().map(GradeCount::count).toList());
        assertEquals(0, d("28.6").compareTo(grades.get(0).ratePct()));

        // 기존 모델(11/23 추가): 기존 등급이 있는 6명만 분모 — CAUTION 4(600·640·580·600)·STANDARD 2(700·750)
        assertEquals(6, r.summary().tradScoredMemberCount());
        assertEquals(0, d("33.3").compareTo(r.summary().tradStandardOrAboveRatePct()), "2/6");
        List<GradeCount> trad = r.tradGradeDistribution();
        assertEquals(List.of(4, 2, 0), trad.stream().map(GradeCount::count).toList());
        assertEquals(0, d("66.7").compareTo(trad.get(0).ratePct()), "4/6");
        assertEquals(0, d("0.0").compareTo(trad.get(2).ratePct()));
    }

    @Test
    @DisplayName("직군별: 고정 순서(급여·자영업·프리랜서)로 0명 그룹도 행이 있고, 5명 미만 그룹은 평균·비율·분포가 null(인원 수만 보임)")
    void groupsByWorkerType() {
        StatsResponse r = AdminStatsService.build("WORKER_TYPE", sample(), 0L, 0L);

        assertEquals(List.of("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER"), r.groups().stream().map(GroupStats::groupCode).toList());
        GroupStats employee = r.groups().get(0);
        assertEquals(5, employee.memberCount());
        // 대안 값은 5명 전원으로 계산해 보인다
        assertEquals(0, d("720.0").compareTo(employee.avgAltScore()), "3600/5");
        assertEquals(0, d("80.0").compareTo(employee.standardOrAboveRatePct()));
        assertEquals(List.of(1, 3, 1), employee.gradeDistribution().stream().map(GradeCount::count).toList());
        // 기존 모델 산출자는 4명이라(5명 미만) 기존 평균·상승폭·기존 등급 값은 숨긴다(리뷰 반영 11/23)
        assertEquals(4, employee.tradScoredMemberCount());
        assertNull(employee.avgTradScore());
        assertNull(employee.avgScoreUplift());
        assertNull(employee.tradStandardOrAboveRatePct());
        assertNull(employee.tradGradeDistribution());

        GroupStats selfEmployed = r.groups().get(1);
        assertEquals(0, selfEmployed.memberCount());
        assertNull(selfEmployed.avgAltScore());

        GroupStats freelancer = r.groups().get(2);
        assertEquals(2, freelancer.memberCount(), "인원 수는 보인다");
        assertNull(freelancer.avgTradScore());
        assertNull(freelancer.avgAltScore());
        assertNull(freelancer.avgScoreUplift());
        assertNull(freelancer.standardOrAboveRatePct());
        assertNull(freelancer.gradeDistribution());
        assertNull(freelancer.tradStandardOrAboveRatePct());
        assertNull(freelancer.tradGradeDistribution());
    }

    @Test
    @DisplayName("5명 기준은 값마다 계산 인원에 적용한다: 그룹 6명 중 기존 모델 산출자가 4명이면 기존 값만 숨기고, 5명이 되면 보인다")
    void minimumPerValue() {
        List<MemberScore> group = new ArrayList<>();
        group.add(member("SELF_EMPLOYED", "40S", 600, 650, "CAUTION"));
        group.add(member("SELF_EMPLOYED", "40S", 700, 720, "STANDARD"));
        group.add(member("SELF_EMPLOYED", "40S", 620, 690, "STANDARD"));
        group.add(member("SELF_EMPLOYED", "40S", 680, 760, "STANDARD"));
        group.add(member("SELF_EMPLOYED", "40S", null, 700, "STANDARD"));   // 기존 모델로 산출 못 함
        group.add(member("SELF_EMPLOYED", "40S", null, 640, "CAUTION"));    // 기존 모델로 산출 못 함

        GroupStats g = AdminStatsService.build("WORKER_TYPE", group, 0L, 0L).groups().get(1);
        assertEquals(6, g.memberCount());
        assertEquals(4, g.tradScoredMemberCount());
        assertEquals(0, d("693.3").compareTo(g.avgAltScore()), "대안은 6명이라 보인다");
        assertEquals(0, d("66.7").compareTo(g.standardOrAboveRatePct()));
        assertNull(g.avgTradScore(), "기존 산출 4명 — 1명의 값도 역산될 수 있어 숨긴다");
        assertNull(g.avgScoreUplift());
        assertNull(g.tradStandardOrAboveRatePct());
        assertNull(g.tradGradeDistribution());

        group.add(member("SELF_EMPLOYED", "40S", 640, 700, "STANDARD"));    // 기존 산출자 5명이 된다
        GroupStats five = AdminStatsService.build("WORKER_TYPE", group, 0L, 0L).groups().get(1);
        assertEquals(5, five.tradScoredMemberCount());
        assertEquals(0, d("648.0").compareTo(five.avgTradScore()), "(600+700+620+680+640)/5");
        assertEquals(0, d("56.0").compareTo(five.avgScoreUplift()), "(50+20+70+80+60)/5 = 280/5");
        assertEquals(0, d("40.0").compareTo(five.tradStandardOrAboveRatePct()), "700·680 두 명이 STANDARD");
        assertEquals(List.of(3, 2, 0), five.tradGradeDistribution().stream().map(GradeCount::count).toList());
    }

    @Test
    @DisplayName("연령대별: 20대·30대·40대·50대 이상 고정 순서. 이 예시는 모든 연령대가 5명 미만이라 평균이 모두 null")
    void groupsByAgeBand() {
        StatsResponse r = AdminStatsService.build("AGE_BAND", sample(), 0L, 0L);

        assertEquals(List.of("20S", "30S", "40S", "50_PLUS"), r.groups().stream().map(GroupStats::groupCode).toList());
        assertEquals(List.of(2, 3, 2, 0), r.groups().stream().map(GroupStats::memberCount).toList());
        r.groups().forEach(g -> assertNull(g.avgAltScore(), g.groupCode()));
    }

    @Test
    @DisplayName("전체 평가 고객이 5명 미만이면 요약 평균·비율과 전체 등급 분포도 null(가입 회원·오늘 산출 건수는 보인다), 0명도 같다")
    void tooFewOverall() {
        StatsResponse few = AdminStatsService.build("WORKER_TYPE", sample().subList(0, 4), 10L, 1L);
        assertEquals(4, few.summary().assessedMemberCount());
        assertNull(few.summary().avgAltScore());
        assertNull(few.summary().standardOrAboveRatePct());
        assertNull(few.gradeDistribution());
        assertNull(few.summary().tradStandardOrAboveRatePct());
        assertNull(few.tradGradeDistribution());
        assertEquals(10L, few.summary().registeredMemberCount());
        assertEquals(1L, few.summary().todayScoredCount());

        StatsResponse none = AdminStatsService.build("AGE_BAND", List.of(), 0L, 0L);
        assertEquals(0, none.summary().assessedMemberCount());
        assertEquals(4, none.groups().size());
    }

    @Test
    @DisplayName("groupBy 생략은 직군별, 그 밖의 값은 DB를 읽기 전에 400 INVALID_INPUT(field groupBy). 오늘 산출은 서버 날짜 0시 이후")
    void groupByAndToday() {
        AdminStatsMapper mapper = mock(AdminStatsMapper.class);
        Clock clock = Clock.fixed(Instant.parse("2026-11-20T05:30:00Z"), ZoneId.of("Asia/Seoul"));   // 한국 14:30
        AdminStatsService service = new AdminStatsService(mapper, clock);

        ApiException e = assertThrows(ApiException.class, () -> service.stats("JOB"));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("INVALID_INPUT", e.getCode());
        assertEquals("groupBy", e.getFieldErrors().get(0).field());
        verifyNoInteractions(mapper);

        when(mapper.selectLatestScoredMembers()).thenReturn(sample());
        when(mapper.selectRegisteredMemberCount()).thenReturn(50L);
        when(mapper.selectScoredCountSince(LocalDateTime.of(2026, 11, 20, 0, 0))).thenReturn(2L);

        StatsResponse r = service.stats(null);
        assertEquals("WORKER_TYPE", r.groupBy());
        assertEquals(2L, r.summary().todayScoredCount());
        verify(mapper).selectScoredCountSince(LocalDateTime.of(2026, 11, 20, 0, 0));
    }
}
