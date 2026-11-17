package com.baeksuescape.finance.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * N-17-3·N-18-4·N-21-4 공통 재계산 틀 — 현재 값에 바꾼 값을 반영해 "재계산 입력값"을 만든다.
 * 시나리오(N-17)·시뮬레이터(N-18)·현금흐름 전망(N-21)이 이 클래스 하나를 함께 쓴다(AGENTS.md 3-1). 계산 자체는 각 기능이 한다.
 */
public final class RecalculationFrame {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    /** PERCENT 변경 결과의 소수 자릿수 (금액·비율 모두 소수 둘째 자리까지 두고, 쓰는 쪽에서 필요하면 원 단위로 반올림한다) */
    private static final int RESULT_SCALE = 2;

    /** 바꾸는 방식 */
    public enum ChangeType {
        /** 값 자체를 바꾼다. 예) 통신비 정시 납부 기간 → 24 (N-18 슬라이더) */
        SET,
        /** 현재 값에서 비율로 바꾼다. 예) 소득 -20 → 현재 × 0.8 (N-17, N-21) */
        PERCENT,
        /** 현재 값에 더한다. 예) 금리 +1 (%p) → 현재 + 1 (N-17) */
        ADD
    }

    /** 바꿀 항목 하나: 항목 이름, 바꾸는 방식, 값 */
    public record ValueChange(String field, ChangeType type, BigDecimal amount) {
    }

    private RecalculationFrame() {
        // 유틸리티 클래스 인스턴스화 방지
    }

    /**
     * 현재 값(current)에 바꾼 값(changes)을 차례로 반영한 새 Map을 돌려준다. 같은 항목을 여러 번 바꾸면 앞의 결과에 이어서 반영한다.
     * 원래 Map은 바꾸지 않으므로 "내 실제 값으로 되돌리기"(N-18-10)는 current를 다시 쓰면 된다.
     * 현재 값에 없는 항목 이름이 오면 오타로 보고 IllegalArgumentException을 던진다.
     */
    public static Map<String, BigDecimal> apply(Map<String, BigDecimal> current, List<ValueChange> changes) {
        if (current == null) {
            throw new IllegalArgumentException("현재 값이 없습니다.");
        }
        Map<String, BigDecimal> result = new LinkedHashMap<>(current);
        if (changes == null || changes.isEmpty()) {
            return Collections.unmodifiableMap(result);
        }

        for (ValueChange change : changes) {
            if (change == null || change.field() == null || change.type() == null || change.amount() == null) {
                throw new IllegalArgumentException("바꿀 값의 항목·방식·값이 모두 있어야 합니다.");
            }
            if (!result.containsKey(change.field())) {
                throw new IllegalArgumentException("현재 값에 없는 항목입니다: " + change.field());
            }
            BigDecimal before = result.get(change.field());
            result.put(change.field(), applyOne(before, change));
        }
        return Collections.unmodifiableMap(result);
    }

    /** 항목 하나에 바꾸는 방식을 적용한다. 현재 값이 비어 있으면 0으로 보고 계산한다. */
    private static BigDecimal applyOne(BigDecimal before, ValueChange change) {
        BigDecimal base = before == null ? BigDecimal.ZERO : before;
        switch (change.type()) {
            case SET:
                return change.amount();
            case PERCENT:
                // 예) 현재 3,000,000, -10 → 3,000,000 × (100 - 10) ÷ 100 = 2,700,000
                return base.multiply(HUNDRED.add(change.amount()))
                        .divide(HUNDRED, RESULT_SCALE, RoundingMode.HALF_UP);
            case ADD:
                return base.add(change.amount());
            default:
                throw new IllegalArgumentException("지원하지 않는 변경 방식입니다: " + change.type());
        }
    }
}
