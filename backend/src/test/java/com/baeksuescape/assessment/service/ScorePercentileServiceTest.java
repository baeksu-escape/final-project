package com.baeksuescape.assessment.service;

import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.assessment.dto.ScorePercentileResponse;
import com.baeksuescape.assessment.dto.ScorePercentileResponse.GroupPosition;
import com.baeksuescape.global.exception.ApiException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** FP-251 N-13-1~3 RPT-05 내 위치 계산(상위 n%·평균·차이·표본 부족·점수 없음) 시험. */
@ExtendWith(MockitoExtension.class)
class ScorePercentileServiceTest {

    private static final long ME = 1L;
    private static final String MODEL = "LGBM-BASE-0.2";

    @Mock
    private AdminStatsMapper mapper;

    @InjectMocks
    private ScorePercentileService service;

    private static MemberScore member(long userId, String workerType, String ageBand, Integer altScore) {
        MemberScore row = new MemberScore();
        row.setUserId(userId);
        row.setWorkerTypeCode(workerType);
        row.setAgeBandCode(ageBand);
        row.setAltScore(altScore);
        return row;
    }

    // 같은 직군·연령대 회원 여러 명. 첫 점수가 나(ME)이고 나머지는 2번부터 번호를 붙인다.
    private static List<MemberScore> sameGroup(int... scores) {
        List<MemberScore> rows = new ArrayList<>();
        for (int i = 0; i < scores.length; i++) {
            rows.add(member(ME + i, "EMPLOYEE", "30S", scores[i]));
        }
        return rows;
    }

    private static GroupPosition firstGroup(int... scores) {
        return ScorePercentileService.build(ME, sameGroup(scores), MODEL).groups().get(0);
    }

    @Test
    @DisplayName("상위 n%는 (나보다 높은 사람 + 1) ÷ 인원이다: 5명 중 1등은 20%, 꼴찌는 100%")
    void topPct_firstAndLast() {
        assertThat(firstGroup(800, 700, 690, 650, 600).topPct()).isEqualByComparingTo("20.0");
        assertThat(firstGroup(500, 700, 690, 650, 600).topPct()).isEqualByComparingTo("100.0");
    }

    @Test
    @DisplayName("동점자는 같은 순위다: 나와 같은 점수는 나보다 높은 사람으로 세지 않는다")
    void topPct_tie() {
        assertThat(firstGroup(700, 700, 700, 650, 600).topPct()).isEqualByComparingTo("20.0");
        assertThat(firstGroup(650, 700, 700, 650, 600).topPct()).isEqualByComparingTo("60.0");
    }

    @Test
    @DisplayName("상위 n%·평균은 소수 첫째 자리로 반올림하고, 차이는 내 점수에서 반올림한 평균을 뺀 값이다")
    void rounding() {
        GroupPosition group = firstGroup(700, 710, 650, 651, 652, 653);

        assertThat(group.memberCount()).isEqualTo(6);
        assertThat(group.topPct()).isEqualByComparingTo("33.3");     // 2 ÷ 6
        assertThat(group.avgScore()).isEqualByComparingTo("669.3");  // 4016 ÷ 6 = 669.33…
        assertThat(group.diffFromAvg()).isEqualByComparingTo("30.7");
    }

    @Test
    @DisplayName("평균보다 낮으면 차이가 음수다")
    void diffFromAvg_negative() {
        GroupPosition group = firstGroup(600, 700, 700, 700, 700);

        assertThat(group.avgScore()).isEqualByComparingTo("680.0");
        assertThat(group.diffFromAvg()).isEqualByComparingTo("-80.0");
    }

    @Test
    @DisplayName("집단이 4명이면 세 값이 모두 null이고 인원만 보낸다, 5명이면 값을 낸다")
    void minGroupSize_boundary() {
        GroupPosition four = firstGroup(700, 690, 680, 670);
        assertThat(four.memberCount()).isEqualTo(4);
        assertThat(four.topPct()).isNull();
        assertThat(four.avgScore()).isNull();
        assertThat(four.diffFromAvg()).isNull();

        assertThat(firstGroup(700, 690, 680, 670, 660).topPct()).isNotNull();
    }

    @Test
    @DisplayName("직군·연령대·직군+연령대로 따로 나누고, 인원이 모자란 집단만 값을 숨긴다")
    void threeGroups_areSeparated() {
        List<MemberScore> members = List.of(
                member(ME, "EMPLOYEE", "30S", 700),
                member(2L, "EMPLOYEE", "30S", 720),
                member(3L, "EMPLOYEE", "20S", 600),
                member(4L, "EMPLOYEE", "20S", 610),
                member(5L, "EMPLOYEE", "40S", 620),
                member(6L, "FREELANCER", "30S", 710),
                member(7L, "FREELANCER", "30S", 720),
                member(8L, "SELF_EMPLOYED", "30S", 730),
                member(9L, "SELF_EMPLOYED", "50_PLUS", 999));

        ScorePercentileResponse response = ScorePercentileService.build(ME, members, MODEL);

        assertThat(response.myScore()).isEqualTo(700);
        assertThat(response.workerTypeCode()).isEqualTo("EMPLOYEE");
        assertThat(response.ageBandCode()).isEqualTo("30S");
        assertThat(response.modelVersion()).isEqualTo(MODEL);
        assertThat(response.minGroupSize()).isEqualTo(5);
        assertThat(response.groups()).extracting(GroupPosition::groupType)
                .containsExactly("WORKER_TYPE", "AGE_BAND", "WORKER_TYPE_AGE");

        GroupPosition workerType = response.groups().get(0);
        assertThat(workerType.memberCount()).isEqualTo(5);
        assertThat(workerType.topPct()).isEqualByComparingTo("40.0");
        assertThat(workerType.avgScore()).isEqualByComparingTo("650.0");

        GroupPosition ageBand = response.groups().get(1);
        assertThat(ageBand.memberCount()).isEqualTo(5);
        assertThat(ageBand.topPct()).isEqualByComparingTo("100.0");
        assertThat(ageBand.avgScore()).isEqualByComparingTo("716.0");
        assertThat(ageBand.diffFromAvg()).isEqualByComparingTo("-16.0");

        GroupPosition both = response.groups().get(2);
        assertThat(both.memberCount()).isEqualTo(2);
        assertThat(both.topPct()).isNull();
    }

    @Test
    @DisplayName("대안 점수가 없는 행은 집단 인원에서 뺀다")
    void nullScore_isExcluded() {
        List<MemberScore> members = new ArrayList<>(sameGroup(700, 690, 680, 670));
        members.add(member(9L, "EMPLOYEE", "30S", null));

        assertThat(ScorePercentileService.build(ME, members, MODEL).groups().get(0).memberCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("회원 번호가 커도(Long 캐시 범위 밖) 나를 찾는다")
    void largeUserId_isFound() {
        MemberScore me = member(1_000_000L, "EMPLOYEE", "30S", 700);

        assertThat(ScorePercentileService.build(1_000_000L, List.of(me), MODEL).myScore()).isEqualTo(700);
    }

    @Test
    @DisplayName("ACTIVE 모델로 낸 회원 점수를 읽어 계산한다")
    void percentile_usesActiveModel() {
        given(mapper.selectActiveModelVersion()).willReturn(MODEL);
        given(mapper.selectLatestScoredMembers(MODEL)).willReturn(sameGroup(700, 690, 680, 670, 660));

        assertThat(service.percentile(ME).groups().get(0).topPct()).isEqualByComparingTo("20.0");
    }

    @Test
    @DisplayName("ACTIVE 모델로 낸 내 점수가 없으면 404 ASSESSMENT_NOT_FOUND다")
    void percentile_noMyScore_notFound() {
        given(mapper.selectActiveModelVersion()).willReturn(MODEL);
        given(mapper.selectLatestScoredMembers(MODEL)).willReturn(sameGroup(700, 690));

        ApiException error = catchThrowableOfType(() -> service.percentile(99L), ApiException.class);

        assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(error.getCode()).isEqualTo("ASSESSMENT_NOT_FOUND");
    }

    @Test
    @DisplayName("ACTIVE 모델이 없으면 회원 점수를 읽지 않고 404 ASSESSMENT_NOT_FOUND다")
    void percentile_noActiveModel_notFound() {
        given(mapper.selectActiveModelVersion()).willReturn(null);

        ApiException error = catchThrowableOfType(() -> service.percentile(ME), ApiException.class);

        assertThat(error.getCode()).isEqualTo("ASSESSMENT_NOT_FOUND");
        verify(mapper, never()).selectLatestScoredMembers(anyString());
    }
}
