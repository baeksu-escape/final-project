package com.baeksuescape.finance.service;

import com.baeksuescape.assessment.service.ScoreCalculationService;
import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse;
import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse.GroupAverage;
import com.baeksuescape.finance.dto.peer.PeerIncomeRow;
import com.baeksuescape.finance.dto.peer.PeerMemberRow;
import com.baeksuescape.finance.mapper.PeerBenchmarkMapper;
import com.baeksuescape.finance.util.FinancialHealthCalculator;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.DataInputUsers;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * N-15-2 DIAG-01 같은 직군·같은 연령대 회원 평균(연소득·총자산·총부채) — 11/19 팀 결정으로 공공통계 대신 회원 표에서 계산한다.
 * 연소득은 N-20-3 공유 함수(FinancialHealthCalculator.calculateAnnualIncome), 연령대는 평가 저장과 같은 ScoreCalculationService.ageBandCode를 쓴다.
 */
@Service
@RequiredArgsConstructor
public class PeerBenchmarkService {

    /** 이보다 적은 그룹은 평균을 내지 않는다(몇 명뿐이면 그 사람들의 값이 드러난다). */
    static final int MIN_GROUP_SIZE = 5;

    private static final String SALARY_WORKER_TYPE = "EMPLOYEE";

    private final PeerBenchmarkMapper mapper;
    private final DataInputUsers users;

    /** 회원 한 명의 비교 값 (연령대는 올해 기준 연 나이) */
    record MemberValues(String workerTypeCode, String ageBandCode, long annualIncome, long totalAsset, long totalDebt) {
    }

    /**
     * 로그인 회원의 직군·연령대를 구하고, 같은 직군과 같은 연령대 회원의 평균을 각각 돌려준다(본인 포함).
     * 직군 미선택 409 JOB_TYPE_REQUIRED, 탈퇴·없는 계정 401은 DataInputUsers가 던진다.
     */
    public PeerBenchmarkResponse benchmark(long userId) {
        UserAccount me = users.requireUserWithJob(userId);
        int thisYear = users.now().getYear();
        String myAgeBand = me.getBirthYear() == null ? null : ScoreCalculationService.ageBandCode(thisYear - me.getBirthYear());

        List<MemberValues> members = loadMembers(thisYear);
        List<MemberValues> sameWorkerType = new ArrayList<>();
        List<MemberValues> sameAgeBand = new ArrayList<>();
        for (MemberValues member : members) {
            if (member.workerTypeCode().equals(me.getWorkerTypeCode())) {
                sameWorkerType.add(member);
            }
            if (member.ageBandCode().equals(myAgeBand)) {
                sameAgeBand.add(member);
            }
        }
        return new PeerBenchmarkResponse(me.getWorkerTypeCode(), myAgeBand, average(sameWorkerType), average(sameAgeBand));
    }

    // 평균 대상 회원 전원의 연소득·총자산·총부채를 계산한다.
    private List<MemberValues> loadMembers(int thisYear) {
        Map<Long, List<Long>> incomesByUser = new HashMap<>();
        for (PeerIncomeRow row : mapper.selectRecentIncomes()) {
            incomesByUser.computeIfAbsent(row.getUserId(), id -> new ArrayList<>()).add(row.getIncomeAmount());
        }
        List<MemberValues> members = new ArrayList<>();
        for (PeerMemberRow row : mapper.selectPeerMembers()) {
            List<Long> incomes = incomesByUser.getOrDefault(row.getUserId(), List.of());
            boolean salary = SALARY_WORKER_TYPE.equals(row.getWorkerTypeCode());
            long annualIncome = FinancialHealthCalculator.calculateAnnualIncome(incomes, salary).longValue();
            String ageBand = ScoreCalculationService.ageBandCode(thisYear - row.getBirthYear());
            members.add(new MemberValues(row.getWorkerTypeCode(), ageBand, annualIncome, row.getTotalAssetAmount(), row.getTotalDebtAmount()));
        }
        return members;
    }

    // 그룹 평균(원, 반올림). 기준 인원보다 적으면 금액은 null.
    static GroupAverage average(List<MemberValues> group) {
        int count = group.size();
        if (count < MIN_GROUP_SIZE) {
            return new GroupAverage(count, null, null, null);
        }
        long income = 0;
        long asset = 0;
        long debt = 0;
        for (MemberValues member : group) {
            income += member.annualIncome();
            asset += member.totalAsset();
            debt += member.totalDebt();
        }
        return new GroupAverage(count, divide(income, count), divide(asset, count), divide(debt, count));
    }

    private static Long divide(long sum, int count) {
        return BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(count), 0, RoundingMode.HALF_UP).longValue();
    }
}
