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
 * 미입력 금액(총자산 NULL, 대출 미입력, 소득 개월 부족)은 0원으로 넣지 않고 그 금액 평균에서만 뺀다(O-15 A안).
 * 연소득은 N-20-3 공유 함수(FinancialHealthCalculator.calculateAnnualIncome), 연령대는 평가 저장과 같은 ScoreCalculationService.ageBandCode를 쓴다.
 */
@Service
@RequiredArgsConstructor
public class PeerBenchmarkService {

    /** 금액마다 입력한 회원이 이보다 적으면 그 금액 평균을 내지 않는다(몇 명뿐이면 그 사람들의 값이 드러난다). */
    static final int MIN_GROUP_SIZE = 5;

    private static final String SALARY_WORKER_TYPE = "EMPLOYEE";

    private final PeerBenchmarkMapper mapper;
    private final DataInputUsers users;

    /** 회원 한 명의 비교 값 (연령대는 올해 기준 연 나이). 금액이 null이면 미입력·개월 부족이라 그 금액 평균에서 뺀다. */
    record MemberValues(String workerTypeCode, String ageBandCode, Long annualIncome, Long totalAsset, Long totalDebt) {
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

    // 평균 대상 회원 전원의 연소득·총자산·총부채를 계산한다. 소득은 매퍼가 기준월 포함 최근 12개월 안의 행만 준다.
    private List<MemberValues> loadMembers(int thisYear) {
        Map<Long, List<Long>> incomesByUser = new HashMap<>();
        for (PeerIncomeRow row : mapper.selectRecentIncomes()) {
            incomesByUser.computeIfAbsent(row.getUserId(), id -> new ArrayList<>()).add(row.getIncomeAmount());
        }
        List<MemberValues> members = new ArrayList<>();
        for (PeerMemberRow row : mapper.selectPeerMembers()) {
            List<Long> incomes = incomesByUser.getOrDefault(row.getUserId(), List.of());
            String ageBand = ScoreCalculationService.ageBandCode(thisYear - row.getBirthYear());
            members.add(new MemberValues(row.getWorkerTypeCode(), ageBand, annualIncome(row, incomes),
                    row.getTotalAssetAmount(), row.getTotalDebtAmount()));
        }
        return members;
    }

    // 연소득 — 직군별 필요 개월 수(점수 산출의 입력 완료 기준과 같음)만큼 있을 때만 계산하고, 모자라면 null(소득 평균에서 제외).
    // 급여소득자는 기준월 월급 × 12, 자영업자·프리랜서는 12개월 합(N-20-3 공유 함수).
    static Long annualIncome(PeerMemberRow row, List<Long> incomesInWindow) {
        if (incomesInWindow.size() < row.getRequiredIncomeMonths()) {
            return null;
        }
        boolean salary = SALARY_WORKER_TYPE.equals(row.getWorkerTypeCode());
        return FinancialHealthCalculator.calculateAnnualIncome(incomesInWindow, salary).longValue();
    }

    // 그룹 평균(원, 반올림). 금액마다 입력한 회원만 세고, 그 인원이 기준보다 적으면 그 금액만 null.
    static GroupAverage average(List<MemberValues> group) {
        List<Long> incomes = new ArrayList<>();
        List<Long> assets = new ArrayList<>();
        List<Long> debts = new ArrayList<>();
        for (MemberValues member : group) {
            addIfPresent(incomes, member.annualIncome());
            addIfPresent(assets, member.totalAsset());
            addIfPresent(debts, member.totalDebt());
        }
        return new GroupAverage(group.size(), averageOf(incomes), averageOf(assets), averageOf(debts),
                incomes.size(), assets.size(), debts.size());
    }

    private static void addIfPresent(List<Long> values, Long value) {
        if (value != null) {
            values.add(value);
        }
    }

    private static Long averageOf(List<Long> values) {
        if (values.size() < MIN_GROUP_SIZE) {
            return null;
        }
        long sum = 0;
        for (long value : values) {
            sum += value;
        }
        return BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(values.size()), 0, RoundingMode.HALF_UP).longValue();
    }
}
