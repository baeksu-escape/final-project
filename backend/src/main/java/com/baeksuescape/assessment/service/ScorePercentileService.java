package com.baeksuescape.assessment.service;

import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.assessment.dto.ScorePercentileResponse;
import com.baeksuescape.assessment.dto.ScorePercentileResponse.GroupPosition;
import com.baeksuescape.global.exception.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * FP-251 N-13-1~3 내 위치(RPT-05) — 같은 직군·연령대·직군+연령대 회원의 대안 점수 안에서 내 상위 n%와 평균 대비 차이를 구한다.
 * 비교 대상은 관리자 통계(ADM-03, FP-161)와 같은 쿼리를 쓴다: ACTIVE 모델로 낸 회원별 최근 SCORED 평가 1건, 탈퇴 회원 제외(D-28).
 */
@Service
@RequiredArgsConstructor
public class ScorePercentileService {

    /** 집단 인원이 이보다 적으면 상위 n%·평균·차이를 내지 않는다(ADM-03·DIAG-01과 같은 기준) */
    static final int MIN_GROUP_SIZE = 5;

    static final String WORKER_TYPE = "WORKER_TYPE";
    static final String AGE_BAND = "AGE_BAND";
    static final String WORKER_TYPE_AGE = "WORKER_TYPE_AGE";

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final AdminStatsMapper mapper;

    /** RPT-05. ACTIVE 모델로 낸 내 점수가 없으면 404 ASSESSMENT_NOT_FOUND(RPT-02와 같은 코드, 화면은 점수 산출 안내). */
    public ScorePercentileResponse percentile(long userId) {
        String modelVersion = mapper.selectActiveModelVersion();
        if (modelVersion == null) {
            throw scoreNotFound();
        }
        return build(userId, mapper.selectLatestScoredMembers(modelVersion), modelVersion);
    }

    /** 계산 본체(DB 없이 시험). members에서 나를 찾고, 내 평가에 저장된 직군·연령대로 세 집단을 나눈다. */
    static ScorePercentileResponse build(long userId, List<MemberScore> members, String modelVersion) {
        List<MemberScore> scored = members.stream().filter(m -> m.getAltScore() != null).toList();
        MemberScore me = scored.stream()
                .filter(m -> m.getUserId() == userId)
                .findFirst()
                .orElseThrow(ScorePercentileService::scoreNotFound);

        List<MemberScore> sameWorkerType = scored.stream()
                .filter(m -> me.getWorkerTypeCode().equals(m.getWorkerTypeCode())).toList();
        List<MemberScore> sameAgeBand = scored.stream()
                .filter(m -> me.getAgeBandCode().equals(m.getAgeBandCode())).toList();
        List<MemberScore> sameBoth = sameWorkerType.stream()
                .filter(m -> me.getAgeBandCode().equals(m.getAgeBandCode())).toList();

        int myScore = me.getAltScore();
        return new ScorePercentileResponse(myScore, me.getWorkerTypeCode(), me.getAgeBandCode(), modelVersion, MIN_GROUP_SIZE,
                List.of(position(WORKER_TYPE, myScore, sameWorkerType),
                        position(AGE_BAND, myScore, sameAgeBand),
                        position(WORKER_TYPE_AGE, myScore, sameBoth)));
    }

    /**
     * 집단 하나에서의 내 위치(본인 포함). 상위 n% = (나보다 점수가 높은 사람 수 + 1) ÷ 인원 × 100이라 동점은 같은 순위다.
     * 명세 N-13-3에 식이 없어 담당자가 정했다(11/23, 동주).
     */
    static GroupPosition position(String groupType, int myScore, List<MemberScore> group) {
        int memberCount = group.size();
        if (memberCount < MIN_GROUP_SIZE) {
            return new GroupPosition(groupType, memberCount, null, null, null);
        }
        long higherCount = group.stream().filter(m -> m.getAltScore() > myScore).count();
        long scoreSum = group.stream().mapToLong(MemberScore::getAltScore).sum();
        BigDecimal count = BigDecimal.valueOf(memberCount);
        BigDecimal topPct = BigDecimal.valueOf(higherCount + 1).multiply(HUNDRED).divide(count, 1, RoundingMode.HALF_UP);
        // 화면에 함께 보이는 값이라 반올림한 평균에서 뺀다(평균 + 차이 = 내 점수가 되게).
        BigDecimal avgScore = BigDecimal.valueOf(scoreSum).divide(count, 1, RoundingMode.HALF_UP);
        return new GroupPosition(groupType, memberCount, topPct, avgScore, BigDecimal.valueOf(myScore).subtract(avgScore));
    }

    private static ApiException scoreNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다.");
    }
}
