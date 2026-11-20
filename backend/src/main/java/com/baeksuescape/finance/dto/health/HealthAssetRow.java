package com.baeksuescape.finance.dto.health;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * FP-239 N-16 DIAG-03-1 기준월(가장 늦은 소득월)의 자산 행 — 총자산과 대출 입력 확인 상태.
 * totalAssetAmount가 null이면 미입력이다. noLoanYn은 'Y'(대출 없음 선택)·'N'(대출 있음)·null(미입력/미확인).
 */
@Getter
@Setter
@NoArgsConstructor
public class HealthAssetRow {
    private Long totalAssetAmount;
    private String noLoanYn;
}
