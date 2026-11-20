package com.baeksuescape.finance.dto.peer;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-15-2 평균에 넣을 회원 한 명의 직군·출생연도와 기준월(가장 늦은 소득월)의 총자산·총부채.
 */
@Getter
@Setter
@NoArgsConstructor
public class PeerMemberRow {
    private long userId;
    private String workerTypeCode;
    private Integer birthYear;
    /** 기준월 USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT (원, 없으면 0) */
    private long totalAssetAmount;
    /** 기준월 USER_LOAN.BALANCE_AMT 합 (원, 없으면 0) */
    private long totalDebtAmount;
}
