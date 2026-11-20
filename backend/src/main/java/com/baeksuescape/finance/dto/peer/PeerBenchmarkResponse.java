package com.baeksuescape.finance.dto.peer;

/**
 * N-15-2 DIAG-01 응답 — 로그인 회원의 직군·연령대와, 같은 직군·같은 연령대 회원 평균.
 * 필드 이름은 자산·부채 건전성 화면(FP-94)의 peer와 같다. 금액은 원 단위 반올림 정수.
 */
public record PeerBenchmarkResponse(
        String workerTypeCode,
        String ageBandCode,
        GroupAverage sameWorkerType,
        GroupAverage sameAgeBand) {

    /**
     * 그룹 하나의 평균. 회원이 기준(5명)보다 적으면 금액 3개는 null이고 memberCount만 채운다.
     */
    public record GroupAverage(
            int memberCount,
            Long annualIncomeAmount,
            Long totalAssetAmount,
            Long totalDebtAmount) {
    }
}
