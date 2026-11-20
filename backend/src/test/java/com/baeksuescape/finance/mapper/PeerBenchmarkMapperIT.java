package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.peer.PeerIncomeRow;
import com.baeksuescape.finance.dto.peer.PeerMemberRow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * FP-160 PeerBenchmarkMapper를 실제 Oracle 더미 DB에 붙여 확인하는 통합 시험.
 * DB가 없는 팀원 빌드를 깨지 않도록 -Ddb.it=true를 줄 때만 실행한다(IncomeVolatilityMapperIT와 같은 방식).
 */
@SpringBootTest
@EnabledIfSystemProperty(named = "db.it", matches = "true")
class PeerBenchmarkMapperIT {

    @Autowired
    private PeerBenchmarkMapper mapper;

    @Test
    @DisplayName("평균 대상 회원을 읽고, 직군·출생연도·기준월·필요 개월 수가 있으며 입력된 금액은 음수가 아니다(NULL = 미입력)")
    void selectPeerMembers() {
        List<PeerMemberRow> rows = mapper.selectPeerMembers();
        long assetNull = rows.stream().filter(row -> row.getTotalAssetAmount() == null).count();
        long debtNull = rows.stream().filter(row -> row.getTotalDebtAmount() == null).count();
        System.out.println("[FP-160] 평균 대상 회원 수 = " + rows.size() + ", 자산 미입력 = " + assetNull + ", 대출 미입력 = " + debtNull);

        assertFalse(rows.isEmpty(), "더미 시드(run_seed_only.sql)가 적재되어 있어야 한다");
        for (PeerMemberRow row : rows) {
            assertNotNull(row.getWorkerTypeCode());
            assertNotNull(row.getBirthYear());
            assertNotNull(row.getBaseMonth());
            assertTrue(row.getRequiredIncomeMonths() == 1 || row.getRequiredIncomeMonths() == 12);
            assertTrue(row.getTotalAssetAmount() == null || row.getTotalAssetAmount() >= 0);
            assertTrue(row.getTotalDebtAmount() == null || row.getTotalDebtAmount() >= 0);
        }
    }

    @Test
    @DisplayName("소득은 회원 기준월 포함 최근 12개월(달력) 안의 행만, 기준월 오름차순으로 나오고 평균 대상 회원만 나온다")
    void selectRecentIncomes() {
        Map<Long, String> baseMonthByUser = new HashMap<>();
        for (PeerMemberRow member : mapper.selectPeerMembers()) {
            baseMonthByUser.put(member.getUserId(), member.getBaseMonth());
        }
        List<PeerIncomeRow> incomes = mapper.selectRecentIncomes();

        Map<Long, Integer> countByUser = new HashMap<>();
        Map<Long, String> lastMonthByUser = new HashMap<>();
        for (PeerIncomeRow row : incomes) {
            countByUser.merge(row.getUserId(), 1, Integer::sum);
            String last = lastMonthByUser.put(row.getUserId(), row.getBaseMonth());
            assertTrue(last == null || last.compareTo(row.getBaseMonth()) < 0, "기준월 오름차순: 회원 " + row.getUserId());
            YearMonth base = YearMonth.parse(baseMonthByUser.get(row.getUserId()));
            YearMonth month = YearMonth.parse(row.getBaseMonth());
            assertFalse(month.isBefore(base.minusMonths(11)) || month.isAfter(base), "12개월 창 밖: 회원 " + row.getUserId() + " " + month);
        }
        assertEquals(baseMonthByUser.size(), countByUser.size(), "소득이 있는 회원 수 = 평균 대상 회원 수");
        countByUser.values().forEach(count -> assertTrue(count <= 12));
    }
}
