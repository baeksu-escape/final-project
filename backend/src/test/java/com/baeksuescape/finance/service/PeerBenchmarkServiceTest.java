package com.baeksuescape.finance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse;
import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse.GroupAverage;
import com.baeksuescape.finance.dto.peer.PeerIncomeRow;
import com.baeksuescape.finance.dto.peer.PeerMemberRow;
import com.baeksuescape.finance.mapper.PeerBenchmarkMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.DataInputUsers;

/**
 * FP-160 N-15-2 DIAG-01 같은 직군·연령대 회원 평균 계산 시험 (매퍼·회원 확인은 mock, DB 없음).
 * 올해를 2026년으로 고정한다 — 연 나이 = 2026 − 출생연도.
 */
class PeerBenchmarkServiceTest {

    private PeerBenchmarkMapper mapper;
    private DataInputUsers users;
    private PeerBenchmarkService service;

    private final List<PeerMemberRow> members = new ArrayList<>();
    private final List<PeerIncomeRow> incomes = new ArrayList<>();

    @BeforeEach
    void setUp() {
        mapper = mock(PeerBenchmarkMapper.class);
        users = mock(DataInputUsers.class);
        service = new PeerBenchmarkService(mapper, users);
        when(users.now()).thenReturn(LocalDateTime.of(2026, 11, 20, 10, 0));
        when(mapper.selectPeerMembers()).thenReturn(members);
        when(mapper.selectRecentIncomes()).thenReturn(incomes);
    }

    // 로그인 회원 1번
    private void me(String workerType, Integer birthYear) {
        UserAccount account = new UserAccount();
        account.setUserId(1L);
        account.setWorkerTypeCode(workerType);
        account.setBirthYear(birthYear);
        when(users.requireUserWithJob(1L)).thenReturn(account);
    }

    // 평균 대상 회원 한 명과 그 회원의 월 소득들(매퍼가 이미 최근 12개월 창으로 거른 값). 필요 개월 수는 DIM_WORKER_TYPE과 같게 넣는다.
    // 금액을 미입력(null)으로 바꿔 보려고 만든 행을 돌려준다.
    private PeerMemberRow member(long userId, String workerType, int birthYear, long asset, long debt, long... monthlyIncomes) {
        PeerMemberRow row = new PeerMemberRow();
        row.setUserId(userId);
        row.setWorkerTypeCode(workerType);
        row.setBirthYear(birthYear);
        row.setBaseMonth("2026-12");
        row.setRequiredIncomeMonths("EMPLOYEE".equals(workerType) ? 1 : 12);
        row.setTotalAssetAmount(asset);
        row.setTotalDebtAmount(debt);
        members.add(row);
        for (int i = 0; i < monthlyIncomes.length; i++) {
            PeerIncomeRow income = new PeerIncomeRow();
            income.setUserId(userId);
            income.setBaseMonth(String.format("2026-%02d", i + 1));
            income.setIncomeAmount(monthlyIncomes[i]);
            incomes.add(income);
        }
        return row;
    }

    // 자영업자·프리랜서용 12개월 소득 (모두 같은 금액)
    private static long[] twelveMonths(long monthly) {
        long[] months = new long[12];
        java.util.Arrays.fill(months, monthly);
        return months;
    }

    @Test
    @DisplayName("급여소득자는 최근 월급 × 12, 자영업자는 월 소득 합으로 연소득을 내고, 같은 직군 5명의 평균을 반올림한다")
    void sameWorkerType_average_withSharedAnnualIncomeRule() {
        me("EMPLOYEE", 1990);
        // 급여소득자 5명: 마지막 월급 × 12 → 1,200만·2,400만·3,600만·4,800만·6,000만 → 평균 3,600만
        member(1, "EMPLOYEE", 1990, 10_000_000, 1_000_000, 900_000, 1_000_000);
        member(2, "EMPLOYEE", 1991, 20_000_000, 0, 2_000_000);
        member(3, "EMPLOYEE", 1992, 30_000_000, 0, 3_000_000);
        member(4, "EMPLOYEE", 1993, 40_000_000, 0, 4_000_000);
        member(5, "EMPLOYEE", 1994, 50_000_001, 2, 5_000_000);
        // 다른 직군은 같은 직군 평균에 안 들어간다
        member(6, "SELF_EMPLOYED", 1990, 999_000_000, 999_000_000, 1, 2, 3);

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(5, group.memberCount());
        assertEquals(36_000_000L, group.annualIncomeAmount());
        assertEquals(30_000_000L, group.totalAssetAmount()); // 150,000,001 / 5 = 30,000,000.2 → 반올림
        assertEquals(200_000L, group.totalDebtAmount());     // 1,000,002 / 5 = 200,000.4 → 반올림
    }

    @Test
    @DisplayName("자영업자·프리랜서는 최근 12개월 소득을 모두 더한다(월급 × 12가 아님)")
    void selfEmployed_annualIncome_isSumOfMonths() {
        me("SELF_EMPLOYED", 1990);
        for (long id = 1; id <= 5; id++) {
            member(id, "SELF_EMPLOYED", 1990, 0, 0, twelveMonths(500_000));
        }

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(6_000_000L, group.annualIncomeAmount());
        assertEquals(5, group.incomeMemberCount());
    }

    @Test
    @DisplayName("자영업자·프리랜서가 최근 12개월 중 빠진 달이 있으면 소득 평균에서만 빼고, 자산·부채 평균에는 넣는다")
    void missingIncomeMonths_excludedFromIncomeOnly() {
        me("FREELANCER", 1990);
        for (long id = 1; id <= 5; id++) {
            member(id, "FREELANCER", 1990, 10_000_000, 1_000_000, twelveMonths(400_000));
        }
        member(6, "FREELANCER", 1990, 40_000_000, 7_000_000, 9_000_000, 9_000_000); // 2개월뿐

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(6, group.memberCount());
        assertEquals(5, group.incomeMemberCount());
        assertEquals(4_800_000L, group.annualIncomeAmount());   // 6번 제외
        assertEquals(6, group.assetMemberCount());
        assertEquals(15_000_000L, group.totalAssetAmount());    // (10,000,000×5 + 40,000,000) / 6
        assertEquals(2_000_000L, group.totalDebtAmount());      // (1,000,000×5 + 7,000,000) / 6
    }

    @Test
    @DisplayName("O-15: 총자산 NULL(미입력)·대출 미입력(NULL)은 0원으로 넣지 않고 그 금액 평균에서만 뺀다, 대출 없음(0)은 넣는다")
    void unenteredAssetAndDebt_excludedPerAmount() {
        me("EMPLOYEE", 1990);
        for (long id = 1; id <= 5; id++) {
            member(id, "EMPLOYEE", 1990, 30_000_000, 0, 3_000_000); // 대출 없음(NO_LOAN_YN='Y') → 0
        }
        member(6, "EMPLOYEE", 1990, 0, 0, 3_000_000).setTotalAssetAmount(null);
        member(7, "EMPLOYEE", 1990, 30_000_000, 0, 3_000_000).setTotalDebtAmount(null);

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(7, group.memberCount());
        assertEquals(7, group.incomeMemberCount());
        assertEquals(6, group.assetMemberCount());
        assertEquals(30_000_000L, group.totalAssetAmount()); // 6번(NULL)을 0원으로 넣었다면 25,714,286
        assertEquals(6, group.debtMemberCount());
        assertEquals(0L, group.totalDebtAmount());
    }

    @Test
    @DisplayName("금액마다 입력한 회원이 5명보다 적으면 그 금액만 null이고 인원은 그대로 준다")
    void smallGroup_amountsAreNullPerAmount() {
        me("FREELANCER", 1990);
        for (long id = 1; id <= 5; id++) {
            member(id, "FREELANCER", 1990, 10_000_000, 0, twelveMonths(100_000));
        }
        // 5명 중 2명만 자산 입력 → 자산 평균만 null
        for (PeerMemberRow row : members.subList(0, 3)) {
            row.setTotalAssetAmount(null);
        }

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(5, group.memberCount());
        assertEquals(1_200_000L, group.annualIncomeAmount());
        assertEquals(2, group.assetMemberCount());
        assertNull(group.totalAssetAmount());
        assertEquals(0L, group.totalDebtAmount());
    }

    @Test
    @DisplayName("같은 그룹이 5명보다 적으면 금액 3개 모두 null이다")
    void smallGroup_amountsAreNull() {
        me("FREELANCER", 1990);
        for (long id = 1; id <= 4; id++) {
            member(id, "FREELANCER", 1990, 10_000_000, 0, twelveMonths(100_000));
        }

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(4, group.memberCount());
        assertEquals(4, group.incomeMemberCount());
        assertNull(group.annualIncomeAmount());
        assertNull(group.totalAssetAmount());
        assertNull(group.totalDebtAmount());
    }

    @Test
    @DisplayName("연령대는 연 나이(2026 − 출생연도)로 평가 저장과 같은 구간을 쓰고, 직군과 상관없이 같은 연령대끼리 묶는다")
    void sameAgeBand_usesAgeBandBoundaries() {
        me("EMPLOYEE", 1996); // 30살 → 30S
        member(1, "EMPLOYEE", 1996, 0, 0, 1_000_000);          // 30 → 30S
        member(2, "SELF_EMPLOYED", 1987, 0, 0, 1_000_000);     // 39 → 30S
        member(3, "FREELANCER", 1990, 0, 0, 1_000_000);        // 36 → 30S
        member(4, "EMPLOYEE", 1993, 0, 0, 1_000_000);          // 33 → 30S
        member(5, "EMPLOYEE", 1995, 0, 0, 1_000_000);          // 31 → 30S
        member(6, "EMPLOYEE", 1997, 0, 0, 9_000_000);          // 29 → 20S (제외)
        member(7, "EMPLOYEE", 1986, 0, 0, 9_000_000);          // 40 → 40S (제외)

        PeerBenchmarkResponse response = service.benchmark(1L);

        assertEquals("EMPLOYEE", response.workerTypeCode());
        assertEquals("30S", response.ageBandCode());
        assertEquals(5, response.sameAgeBand().memberCount());
        assertEquals(5, response.sameWorkerType().memberCount()); // 급여소득자 1·4·5·6·7번 (나이와 상관없음)
    }

    @Test
    @DisplayName("직군을 고르지 않은 회원은 409 JOB_TYPE_REQUIRED이고 회원 표를 읽지 않는다")
    void noJobType_conflict() {
        when(users.requireUserWithJob(1L))
                .thenThrow(new ApiException(HttpStatus.CONFLICT, "JOB_TYPE_REQUIRED", "직군을 먼저 선택해 주세요."));

        ApiException error = assertThrows(ApiException.class, () -> service.benchmark(1L));

        assertEquals(HttpStatus.CONFLICT, error.getStatus());
        verifyNoInteractions(mapper);
    }
}
