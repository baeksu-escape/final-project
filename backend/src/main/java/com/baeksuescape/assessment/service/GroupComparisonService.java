package com.baeksuescape.assessment.service;

import static com.baeksuescape.admin.service.AdminStatsService.AGE_BAND_CODES;
import static com.baeksuescape.admin.service.AdminStatsService.MIN_GROUP_SIZE;
import static com.baeksuescape.admin.service.AdminStatsService.WORKER_TYPE_CODES;
import static com.baeksuescape.admin.service.AdminStatsService.groupStats;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.baeksuescape.admin.dto.AdminStatsDtos.GroupStats;
import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.assessment.dto.GroupComparisonDtos.GridCell;
import com.baeksuescape.assessment.dto.GroupComparisonDtos.GroupComparisonResponse;
import com.baeksuescape.assessment.dto.GroupComparisonDtos.Me;

/**
 * FP-164 N-26-5~7 사용자 비교 분석(ADM-04) — 직군 × 연령 격자, 직군별·연령별 비교, 내 위치.
 * 집계 기준과 계산은 관리자 통계 ADM-03(FP-161)과 같다(11/23 동주 합의): 같은 매퍼로 ACTIVE 모델의 회원별 최근 SCORED 서비스 평가를 읽고(탈퇴 제외, D-28),
 * 집단마다 AdminStatsService.groupStats로 값을 낸다(값마다 계산 인원 5명 미만이면 null).
 * 화면(N-13 내 위치 카드·/comparison 틀)은 동주, 격자·비교 화면은 그 아래에 광희가 붙인다.
 */
@Service
public class GroupComparisonService {

    static final String ALL = "ALL";

    private final AdminStatsMapper mapper;

    public GroupComparisonService(AdminStatsMapper mapper) {
        this.mapper = mapper;
    }

    /** ADM-04. userId는 토큰의 회원이다. ACTIVE 모델이 없으면 모든 집단이 0명인 응답(modelVersion·me null)을 준다(ADM-03과 같음). */
    public GroupComparisonResponse compare(Long userId) {
        String modelVersion = mapper.selectActiveModelVersion();
        List<MemberScore> members = modelVersion == null ? List.of() : mapper.selectLatestScoredMembers(modelVersion);
        return build(userId, members, modelVersion);
    }

    /** 계산 본체(DB 없이 테스트). */
    static GroupComparisonResponse build(Long userId, List<MemberScore> members, String modelVersion) {
        List<GroupStats> byWorkerType = new ArrayList<>();
        for (String workerType : WORKER_TYPE_CODES) {
            byWorkerType.add(groupStats(workerType, members.stream().filter(m -> workerType.equals(m.getWorkerTypeCode())).toList()));
        }
        List<GroupStats> byAgeBand = new ArrayList<>();
        for (String ageBand : AGE_BAND_CODES) {
            byAgeBand.add(groupStats(ageBand, members.stream().filter(m -> ageBand.equals(m.getAgeBandCode())).toList()));
        }
        List<GridCell> grid = new ArrayList<>();
        for (String workerType : WORKER_TYPE_CODES) {
            for (String ageBand : AGE_BAND_CODES) {
                List<MemberScore> cell = members.stream()
                        .filter(m -> workerType.equals(m.getWorkerTypeCode()) && ageBand.equals(m.getAgeBandCode()))
                        .toList();
                grid.add(new GridCell(workerType, ageBand, groupStats(workerType + ":" + ageBand, cell)));
            }
        }
        return new GroupComparisonResponse(modelVersion, MIN_GROUP_SIZE, me(userId, members), groupStats(ALL, members),
                byWorkerType, byAgeBand, grid);
    }

    // 통계에 들어간 내 평가(매퍼가 회원마다 1건만 준다). 없으면 null
    private static Me me(Long userId, List<MemberScore> members) {
        return members.stream()
                .filter(m -> userId != null && userId.equals(m.getUserId()))
                .findFirst()
                .map(m -> new Me(m.getWorkerTypeCode(), m.getAgeBandCode(), m.getTradScore(), m.getAltScore(),
                        m.getTradGradeBandCode(), m.getAltGradeBandCode()))
                .orElse(null);
    }
}
