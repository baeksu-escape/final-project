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

    // 평균 대상 회원 한 명과 그 회원의 월 소득들
    private void member(long userId, String workerType, int birthYear, long asset, long debt, long... monthlyIncomes) {
        PeerMemberRow row = new PeerMemberRow();
        row.setUserId(userId);
        row.setWorkerTypeCode(workerType);
        row.setBirthYear(birthYear);
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
            member(id, "SELF_EMPLOYED", 1990, 0, 0, 1_000_000, 2_000_000, 3_000_000);
        }

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(6_000_000L, group.annualIncomeAmount());
    }

    @Test
    @DisplayName("소득 행이 없는 회원의 연소득은 0으로 평균에 들어간다")
    void memberWithoutIncome_countsAsZero() {
        me("FREELANCER", 1990);
        for (long id = 1; id <= 4; id++) {
            member(id, "FREELANCER", 1990, 0, 0, 5_000_000);
        }
        member(5, "FREELANCER", 1990, 0, 0);

        assertEquals(4_000_000L, service.benchmark(1L).sameWorkerType().annualIncomeAmount());
    }

    @Test
    @DisplayName("같은 그룹이 5명보다 적으면 인원만 주고 금액 3개는 null이다")
    void smallGroup_amountsAreNull() {
        me("FREELANCER", 1990);
        for (long id = 1; id <= 4; id++) {
            member(id, "FREELANCER", 1990, 10_000_000, 0, 1_000_000);
        }

        GroupAverage group = service.benchmark(1L).sameWorkerType();

        assertEquals(4, group.memberCount());
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
