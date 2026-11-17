package com.baeksuescape.finance.util;

import com.baeksuescape.finance.util.RecalculationFrame.ChangeType;
import com.baeksuescape.finance.util.RecalculationFrame.ValueChange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * N-17-3·N-18-4·N-21-4 공통 재계산 틀 단위 테스트.
 */
class RecalculationFrameTest {

    private Map<String, BigDecimal> current() {
        Map<String, BigDecimal> values = new LinkedHashMap<>();
        values.put("monthlyIncome", new BigDecimal("3000000"));
        values.put("interestRate", new BigDecimal("5.5"));
        values.put("telecomPaymentMonths", new BigDecimal("12"));
        return values;
    }

    @Test
    @DisplayName("SET·PERCENT·ADD 방식으로 바꾼 값이 반영된다")
    void applyAllTypes() {
        Map<String, BigDecimal> result = RecalculationFrame.apply(current(), List.of(
                new ValueChange("monthlyIncome", ChangeType.PERCENT, new BigDecimal("-20")),      // N-17 소득 -20%
                new ValueChange("interestRate", ChangeType.ADD, new BigDecimal("1")),             // N-17 금리 +1%p
                new ValueChange("telecomPaymentMonths", ChangeType.SET, new BigDecimal("24"))     // N-18 슬라이더
        ));

        assertEquals(0, new BigDecimal("2400000").compareTo(result.get("monthlyIncome")));
        assertEquals(0, new BigDecimal("6.5").compareTo(result.get("interestRate")));
        assertEquals(0, new BigDecimal("24").compareTo(result.get("telecomPaymentMonths")));
    }

    @Test
    @DisplayName("원래 값은 바뀌지 않는다 (N-18-10 되돌리기)")
    void originalUnchanged() {
        Map<String, BigDecimal> original = current();
        RecalculationFrame.apply(original, List.of(
                new ValueChange("monthlyIncome", ChangeType.SET, BigDecimal.ONE)));

        assertEquals(0, new BigDecimal("3000000").compareTo(original.get("monthlyIncome")));
    }

    @Test
    @DisplayName("바꾼 값이 없으면 현재 값 그대로, 같은 항목은 이어서 반영된다")
    void noChangesAndChained() {
        assertEquals(current(), RecalculationFrame.apply(current(), null));

        Map<String, BigDecimal> result = RecalculationFrame.apply(current(), List.of(
                new ValueChange("monthlyIncome", ChangeType.PERCENT, new BigDecimal("10")),
                new ValueChange("monthlyIncome", ChangeType.ADD, new BigDecimal("-300000"))));
        assertEquals(0, new BigDecimal("3000000").compareTo(result.get("monthlyIncome"))); // 330만 - 30만
    }

    @Test
    @DisplayName("현재 값에 없는 항목이나 빈 변경은 오류")
    void invalidChanges() {
        assertThrows(IllegalArgumentException.class, () -> RecalculationFrame.apply(current(), List.of(
                new ValueChange("montlyIncome", ChangeType.SET, BigDecimal.ONE))));
        assertThrows(IllegalArgumentException.class, () -> RecalculationFrame.apply(current(), List.of(
                new ValueChange("monthlyIncome", null, BigDecimal.ONE))));
        assertThrows(IllegalArgumentException.class, () -> RecalculationFrame.apply(null, List.of()));
    }

    @Test
    @DisplayName("결과 Map은 읽기 전용이다")
    void resultIsReadOnly() {
        Map<String, BigDecimal> result = RecalculationFrame.apply(current(), List.of());
        assertThrows(UnsupportedOperationException.class, () -> result.put("x", BigDecimal.ONE));
    }
}
