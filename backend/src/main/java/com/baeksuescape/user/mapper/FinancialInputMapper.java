package com.baeksuescape.user.mapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.user.dto.DataInputRows.AssetRow;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.dto.DataInputRows.ExpenseRow;
import com.baeksuescape.user.dto.DataInputRows.IncomeRow;
import com.baeksuescape.user.dto.DataInputRows.LoanRow;

// FP-85·FP-86 N-05 데이터 입력 저장·조회(INP-01·02). 기준월(BASE_MONTH)별로 저장한다(D-16).
@Mapper
public interface FinancialInputMapper {

    // ── 자산·대출 없음(USER_ASSET_SNAPSHOT) — 저장한 기준월의 기록을 겸한다 ──
    List<String> selectSavedBaseMonths(@Param("userId") long userId);

    AssetRow selectAsset(@Param("userId") long userId, @Param("baseMonth") String baseMonth);

    int mergeAsset(AssetRow row);

    // ── 소득(USER_INCOME_MONTH) ──
    List<IncomeRow> selectIncomes(@Param("userId") long userId, @Param("fromMonth") String fromMonth, @Param("toMonth") String toMonth);

    int mergeIncome(IncomeRow row);

    int deleteIncome(@Param("userId") long userId, @Param("baseMonth") String baseMonth);

    // ── 기간(APP_USER.WORK_PERIOD_MONTHS) ──
    Integer selectWorkPeriod(@Param("userId") long userId);

    int updateWorkPeriod(@Param("userId") long userId, @Param("months") Integer months, @Param("now") LocalDateTime now);

    // ── 대출(USER_LOAN) ──
    List<LoanRow> selectLoans(@Param("userId") long userId, @Param("baseMonth") String baseMonth);

    int deleteManualLoans(@Param("userId") long userId, @Param("baseMonth") String baseMonth);

    int insertLoan(LoanRow row);

    // ── 지출(USER_EXPENSE_ITEM) ──
    List<ExpenseRow> selectExpenses(@Param("userId") long userId, @Param("baseMonth") String baseMonth);

    int deleteExpenses(@Param("userId") long userId, @Param("baseMonth") String baseMonth);

    int insertExpense(ExpenseRow row);

    // ── 카드·신용(USER_CREDIT_PROFILE, 직접 입력 행만) ──
    CreditRow selectManualCredit(@Param("userId") long userId, @Param("baseDate") LocalDate baseDate);

    // 바뀐 행 수. 같은 기준일에 불러온(IMPORTED) 행이 있으면 0이다(UK_UCP_USER_DATE, 직접 입력 행만 바꾼다).
    int mergeManualCredit(CreditRow row);

    int deleteManualCredit(@Param("userId") long userId, @Param("baseDate") LocalDate baseDate);
}
