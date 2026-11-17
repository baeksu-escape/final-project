package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.IncomeMonthRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * N-22-1·N-21-1 저장 데이터 조회 매퍼.
 * 소득 변동성 진단과 현금흐름 전망에 필요한 회원의 소득·지출·원리금을 읽는다.
 */
@Mapper
public interface IncomeVolatilityMapper {

    /** 최근 12개월 소득 (기준월 오름차순) */
    List<IncomeMonthRow> selectRecentIncomeMonths(@Param("userId") long userId);

    /** 최신 기준월의 월 고정 지출(FIXED) 합계. 지출이 없으면 0 */
    long selectLatestFixedExpense(@Param("userId") long userId);

    /** 최신 기준월의 월 지출 합계(모든 지출 그룹). 지출이 없으면 0 */
    long selectLatestTotalExpense(@Param("userId") long userId);

    /** 최신 기준월의 월 원리금 합계. 대출이 없으면 0 */
    long selectLatestLoanMonthlyPayment(@Param("userId") long userId);
}
