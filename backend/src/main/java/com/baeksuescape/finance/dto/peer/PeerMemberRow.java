package com.baeksuescape.finance.dto.peer;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-15-2 평균에 넣을 회원 한 명의 직군·출생연도와 기준월(가장 늦은 소득월)의 총자산·총부채.
 * 금액이 null이면 미입력이라 그 금액 평균에서 뺀다(O-15 A안).
 */
@Getter
@Setter
@NoArgsConstructor
public class PeerMemberRow {
    private long userId;
    private String workerTypeCode;
    private Integer birthYear;
    /** 기준월 (가장 늦은 소득월, 예: "2026-08") */
    private String baseMonth;
    /** 직군별 필요 소득 개월 수 (DIM_WORKER_TYPE: 급여소득자 1, 자영업자·프리랜서 12) */
    private int requiredIncomeMonths;
    /** 기준월 USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT (원). null = 미입력 */
    private Long totalAssetAmount;
    /** 기준월 USER_LOAN.BALANCE_AMT 합 (원). 대출 없음(NO_LOAN_YN='Y')이면 0, null = 미입력 */
    private Long totalDebtAmount;
}
