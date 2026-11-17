package com.baeksuescape.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.YearMonth;

/**
 * 월별 소득·지출 단위 데이터 DTO.
 * N-22 소득 변동성 및 N-21 현금흐름 계산의 기본 입력 단위로 사용된다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonthlyIncomeItem {
    /** 기준월 (예: "2026-08") */
    private String yearMonth;
    /** 해당 월 소득 금액 (원) */
    private long income;
    /** 해당 월 지출 금액 (원, 선택적) */
    private long expense;

    public YearMonth toYearMonth() {
        return YearMonth.parse(this.yearMonth);
    }
}

