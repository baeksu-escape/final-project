package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse.UtilityPaymentMonth;
import com.baeksuescape.finance.dto.health.HealthAssetRow;
import com.baeksuescape.finance.dto.health.HealthLoanRow;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * FP-239 N-16 DIAG-03-1 자산·부채 저장값 조회 매퍼. 기준월은 소득 기준월(USER_INCOME_MONTH의 가장 늦은 달)이다.
 * 소득은 IncomeVolatilityService.loadIncomeHistory를 함께 쓴다.
 */
@Mapper
public interface FinancialHealthMapper {

    /** 기준월 자산 행(총자산·대출 입력 확인 상태). 행이 없으면 null */
    HealthAssetRow selectLatestAsset(@Param("userId") long userId);

    /** 기준월 보유 대출(종류 이름 포함), 대출 번호 순. 없으면 빈 목록 */
    List<HealthLoanRow> selectLatestLoans(@Param("userId") long userId);

    /** N-20-1 회원의 최신 기관 연동 청구월을 포함한 달력 12개월의 기록을 청구월 오름차순으로 읽는다. */
    List<UtilityPaymentMonth> selectRecentUtilityPayments(@Param("userId") long userId);
}
