package com.baeksuescape.finance.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-22-1·N-21-1 USER_INCOME_MONTH 조회 결과 한 행.
 * 기준월, 소득 금액, 소득 종류(MONTHLY_INCOME=월별 소득, SALARY=월급)를 담는다.
 */
@Getter
@Setter
@NoArgsConstructor
public class IncomeMonthRow {
    /** 기준월 (예: "2026-08") */
    private String yearMonth;
    /** 그 달 소득 금액 (원) */
    private long income;
    /** 소득 종류 코드 */
    private String incomeKindCode;
}
