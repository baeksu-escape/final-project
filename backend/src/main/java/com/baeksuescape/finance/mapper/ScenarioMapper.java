package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.scenario.PolicyRateRow;
import com.baeksuescape.finance.dto.scenario.VariableLoanRow;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * N-17 시나리오 테스트 저장 데이터 조회 매퍼 (FP-167). 소득·지출·월 원리금은 IncomeVolatilityMapper를 함께 쓴다.
 */
@Mapper
public interface ScenarioMapper {

    /** 소득 기준월의 변동금리(VARIABLE) 대출 행(잔액·연 금리·월 원리금). 없으면 빈 목록 */
    List<VariableLoanRow> selectLatestVariableLoans(@Param("userId") long userId);

    /** 소득 기준월의 총자산. 행이 없거나 미입력(NULL)이면 null */
    Long selectLatestTotalAsset(@Param("userId") long userId);

    /** 한국은행 기준금리 중 가장 최근 값. 없으면 null */
    PolicyRateRow selectLatestPolicyRate();
}
