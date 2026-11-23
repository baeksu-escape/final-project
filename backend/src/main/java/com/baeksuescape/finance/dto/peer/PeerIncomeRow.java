package com.baeksuescape.finance.dto.peer;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-15-2 회원별 최근 12개월 소득 한 행 (회원 번호·기준월 오름차순으로 읽는다).
 */
@Getter
@Setter
@NoArgsConstructor
public class PeerIncomeRow {
    private long userId;
    /** 기준월 (예: "2026-08") */
    private String baseMonth;
    /** 그 달 소득 (원) */
    private long incomeAmount;
}
