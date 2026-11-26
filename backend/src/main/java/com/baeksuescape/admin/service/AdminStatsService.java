package com.baeksuescape.admin.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.baeksuescape.admin.dto.AdminStatsDtos.GradeCount;
import com.baeksuescape.admin.dto.AdminStatsDtos.GroupStats;
import com.baeksuescape.admin.dto.AdminStatsDtos.StatsResponse;
import com.baeksuescape.admin.dto.AdminStatsDtos.Summary;
import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

/**
 * FP-161 N-26-1~4 관리자 직군·연령별 통계(ADM-03).
 * D-26 담당자 결정(11/20, 광희): 11/06 확정 UI대로 요약(평가 고객 수·평균 점수 기존→대안·Standard 이상 비율 기존→대안·가입 회원 수·오늘 산출),
 * 기존·대안 등급 분포, 직군별·연령대별 통계 표를 만든다(v3의 상자 그림·히트맵·통신비 연체 경험은 UI에 없어 만들지 않는다).
 * 데이터는 서비스 회원이 ACTIVE 모델로 낸 최근 SCORED 평가 1건이고(ACTIVE가 아닌 모델의 평가 제외. ACTIVE가 DEV-DUMMY면 Mock 평가가 대상이다, 11/23 리뷰 반영), D-28 결정대로 탈퇴 회원은 뺀다(매퍼).
 */
@Service
public class AdminStatsService {

    static final String WORKER_TYPE = "WORKER_TYPE";
    static final String AGE_BAND = "AGE_BAND";
    /** 그룹 회원이 이보다 적으면 평균·비율·등급 분포를 내지 않는다(동주 님 DIAG-01과 같은 기준) */
    public static final int MIN_GROUP_SIZE = 5;

    /** 그룹 코드 고정 순서 (DIM_WORKER_TYPE 3분류 D-03, ASSESSMENT 연령대 4구간) */
    public static final List<String> WORKER_TYPE_CODES = List.of("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");
    public static final List<String> AGE_BAND_CODES = List.of("20S", "30S", "40S", "50_PLUS");
    static final Map<String, List<String>> GROUP_CODES = Map.of(
            WORKER_TYPE, WORKER_TYPE_CODES,
            AGE_BAND, AGE_BAND_CODES);
    static final List<String> GRADE_CODES = List.of("CAUTION", "STANDARD", "GOOD");
    private static final List<String> STANDARD_OR_ABOVE = List.of("STANDARD", "GOOD");
    /** 등급 꺼내기: 대안 모델(기존 응답 필드) · 기존 모델(trad* 필드, 11/23 추가 — 11/06 UI의 기존 → 대안 비교) */
    static final Function<MemberScore, String> ALT_GRADE = MemberScore::getAltGradeBandCode;
    static final Function<MemberScore, String> TRAD_GRADE = MemberScore::getTradGradeBandCode;
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final AdminStatsMapper mapper;
    private final Clock clock;

    public AdminStatsService(AdminStatsMapper mapper, Clock clock) {
        this.mapper = mapper;
        this.clock = clock;
    }

    /** ADM-03. groupBy를 생략하면 직군별, WORKER_TYPE·AGE_BAND 외의 값이면 400 INVALID_INPUT(field groupBy). */
    public StatsResponse stats(String groupBy) {
        String by = groupBy == null || groupBy.isBlank() ? WORKER_TYPE : groupBy;
        if (!GROUP_CODES.containsKey(by)) {
            String message = "구분은 WORKER_TYPE(직군별) 또는 AGE_BAND(연령대별)여야 합니다.";
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message, List.of(new FieldErrorItem("groupBy", message)));
        }
        // ACTIVE 모델로 낸 평가만 센다(여러 모델 점수가 섞이면 기존 → 대안 비교의 뜻이 흐려진다, 11/23 리뷰 반영)
        String modelVersion = mapper.selectActiveModelVersion();
        List<MemberScore> members = modelVersion == null ? List.of() : mapper.selectLatestScoredMembers(modelVersion);
        long registered = mapper.selectRegisteredMemberCount();
        long today = modelVersion == null ? 0L : mapper.selectScoredCountSince(LocalDate.now(clock).atStartOfDay(), modelVersion);
        return build(by, members, registered, today, modelVersion);
    }

    /** 계산 본체(DB 없이 테스트). */
    static StatsResponse build(String groupBy, List<MemberScore> members, long registeredMemberCount, long todayScoredCount,
            String modelVersion) {
        Function<MemberScore, String> key = WORKER_TYPE.equals(groupBy) ? MemberScore::getWorkerTypeCode : MemberScore::getAgeBandCode;
        // 5명 기준은 그룹 인원이 아니라 값마다 실제로 계산에 들어간 인원에 적용한다(아래 average·grades 함수, 리뷰 반영 11/23).
        // 그룹이 5명 이상이어도 기존 모델 산출자가 5명 미만이면 기존 평균·상승폭·기존 등급 값으로 소수 회원의 값이 드러나기 때문이다.
        Summary summary = new Summary(members.size(),
                avgTrad(members),
                avgAlt(members),
                avgUplift(members),
                standardOrAboveRate(members, ALT_GRADE),
                registeredMemberCount, todayScoredCount,
                standardOrAboveRate(members, TRAD_GRADE),
                tradScoredCount(members));

        List<GroupStats> groups = new ArrayList<>();
        for (String code : GROUP_CODES.get(groupBy)) {
            groups.add(groupStats(code, members.stream().filter(m -> code.equals(key.apply(m))).toList()));
        }
        return new StatsResponse(groupBy, MIN_GROUP_SIZE, summary, gradeDistribution(members, ALT_GRADE), groups,
                gradeDistribution(members, TRAD_GRADE), modelVersion);
    }

    /**
     * 그룹 한 줄(N-26-4). FP-164 사용자 비교 분석(ADM-04, GroupComparisonService)도 같은 계산을 쓴다(집계 기준을 관리자 통계와 같게, 11/23 동주 합의).
     * 값마다 계산 인원이 5명 미만이면 null이다.
     */
    public static GroupStats groupStats(String code, List<MemberScore> group) {
        return new GroupStats(code, group.size(),
                avgTrad(group),
                avgAlt(group),
                avgUplift(group),
                standardOrAboveRate(group, ALT_GRADE),
                gradeDistribution(group, ALT_GRADE),
                standardOrAboveRate(group, TRAD_GRADE),
                gradeDistribution(group, TRAD_GRADE),
                tradScoredCount(group));
    }

    /** 기존 모델로 산출된 회원 수(기존 점수가 있는 회원). 기존 평균·기존 등급 값·상승폭이 이 인원으로 계산된다 */
    static int tradScoredCount(List<MemberScore> members) {
        return (int) members.stream().filter(m -> m.getTradScore() != null).count();
    }

    /** 기존 점수 평균: 기존 모델로 산출된 회원만 */
    static BigDecimal avgTrad(List<MemberScore> members) {
        return average(members.stream().map(MemberScore::getTradScore).filter(v -> v != null).toList());
    }

    static BigDecimal avgAlt(List<MemberScore> members) {
        return average(members.stream().map(MemberScore::getAltScore).filter(v -> v != null).toList());
    }

    /** 상승폭: 두 점수가 다 있는 회원의 (대안 − 기존) 평균 */
    static BigDecimal avgUplift(List<MemberScore> members) {
        return average(members.stream()
                .filter(m -> m.getTradScore() != null && m.getAltScore() != null)
                .map(m -> m.getAltScore() - m.getTradScore()).toList());
    }

    /**
     * Standard 이상 비율(%): 등급이 STANDARD·GOOD인 회원 ÷ 그 등급이 있는 회원.
     * 대안 등급은 SCORED면 늘 있고, 기존 등급은 기존 모델로 산출된 회원만 있다(없는 회원은 분모에서 빠진다, 평균 기존 점수와 같은 처리).
     * 등급이 있는 회원이 5명 미만이면 null(소수 회원의 등급이 드러나지 않게).
     */
    static BigDecimal standardOrAboveRate(List<MemberScore> members, Function<MemberScore, String> grade) {
        List<String> grades = gradesOf(members, grade);
        if (grades.size() < MIN_GROUP_SIZE) {
            return null;
        }
        long count = grades.stream().filter(STANDARD_OR_ABOVE::contains).count();
        return rate(count, grades.size());
    }

    /** 등급 분포(CAUTION·STANDARD·GOOD 순서, 0명인 등급도 행이 있다). 비율의 분모는 그 등급이 있는 회원 수. 그 인원이 5명 미만이면 null */
    static List<GradeCount> gradeDistribution(List<MemberScore> members, Function<MemberScore, String> grade) {
        List<String> grades = gradesOf(members, grade);
        if (grades.size() < MIN_GROUP_SIZE) {
            return null;
        }
        List<GradeCount> out = new ArrayList<>();
        for (String code : GRADE_CODES) {
            int count = (int) grades.stream().filter(code::equals).count();
            out.add(new GradeCount(code, count, rate(count, grades.size())));
        }
        return out;
    }

    private static List<String> gradesOf(List<MemberScore> members, Function<MemberScore, String> grade) {
        return members.stream().map(grade).filter(g -> g != null).toList();
    }

    // 평균에 들어간 인원이 5명 미만이면 null(몇 명뿐이면 그 사람들의 점수가 드러난다). 값마다 따로 적용한다.
    private static BigDecimal average(List<Integer> values) {
        if (values.size() < MIN_GROUP_SIZE) {
            return null;
        }
        long sum = values.stream().mapToLong(Integer::longValue).sum();
        return BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(values.size()), 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal rate(long count, int total) {
        if (total == 0) {
            return null;
        }
        return BigDecimal.valueOf(count).multiply(HUNDRED).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }
}
