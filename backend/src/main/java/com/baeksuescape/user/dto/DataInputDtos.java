package com.baeksuescape.user.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

// FP-85·FP-86 N-05 데이터 입력·정보 제공 동의·대안 데이터 불러오기 요청·응답(API 정의서 v0.2 INP-01~06).
// 필드 이름은 프론트 utils/inputValues.js buildPayload, mocks/dataInputMockHandlers.js 응답과 같다.
// 숫자는 화면 검사("소수점 없이")를 서버에서도 하려고 BigDecimal로 받는다.
public final class DataInputDtos {

    private DataInputDtos() {
    }

    // INP-02 요청 본문 — 섹션마다 baseMonth가 함께 오지만 서버는 맨 위 baseMonth만 쓴다.
    public record FinancialInput(String jobType, String baseMonth, Income income, WorkPeriod workPeriod, Loans loans,
            CreditProfile creditProfile, Assets assets, FixedExpense fixedExpense, OtherExpenses otherExpenses) {
    }

    // 소득 — 급여소득자는 monthlySalary, 자영업자·프리랜서는 items(달마다 한 줄).
    public record Income(String incomeType, BigDecimal monthlySalary, List<IncomeItem> items) {
    }

    public record IncomeItem(String month, BigDecimal amount) {
    }

    public record WorkPeriod(BigDecimal periodMonths) {
    }

    // 대출 — noItems는 "보유한 대출이 없습니다." 체크(O-15 NO_LOAN_YN).
    public record Loans(List<LoanItem> items, Boolean noItems) {
    }

    public record LoanItem(String loanTypeCode, BigDecimal balanceAmount, BigDecimal annualRatePercent, String rateType,
            BigDecimal monthlyPaymentAmount, BigDecimal remainingMonths) {
    }

    // 카드·신용 이용(D-29 직접 입력). noCreditHistory면 대부업 잔액 외 칸은 null로 온다.
    public record CreditProfile(BigDecimal cardLimitAmount, BigDecimal cardMonthlySpendAmount, BigDecimal delinquencyCount12m,
            BigDecimal cashAdvanceMonths, BigDecimal newLoanCount3m, BigDecimal privateLenderLoanBalanceAmount, Boolean noCreditHistory) {
    }

    public record Assets(BigDecimal depositAmount, BigDecimal investmentAmount, BigDecimal realEstateAmount, BigDecimal otherAmount) {
    }

    public record FixedExpense(BigDecimal monthlyAmount) {
    }

    public record OtherExpenses(List<OtherExpenseItem> items) {
    }

    public record OtherExpenseItem(String category, String memo, BigDecimal monthlyAmount) {
    }

    // N-05-8 입력 완료 현황 — sections: 섹션 key별 입력 여부, altData: 대안 데이터 key별 불러옴 여부.
    public record InputStatus(Map<String, Boolean> sections, Map<String, Boolean> altData) {
    }

    // 불러온 대안 데이터 한 종류(화면 표가 읽는 모양).
    public record ImportedAltData(OffsetDateTime importedAt, List<Map<String, Object>> rows, Long consentId) {
    }

    // INP-01 응답. input은 저장한 적이 없으면 null이다.
    public record FinancialInputResponse(Map<String, Object> input, InputStatus status, Map<String, ImportedAltData> altData,
            List<String> savedBaseMonths) {
    }

    // INP-02 응답.
    public record SaveResponse(OffsetDateTime savedAt, InputStatus status, List<String> savedBaseMonths) {
    }

    // INP-03 요청·응답. notice는 기관 기록이 없는 계정(EMPTY·BORROW)일 때만 보낸다.
    public record AltDataImportRequest(String baseMonth, Long consentId) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AltDataImportResponse(String source, OffsetDateTime importedAt, List<Map<String, Object>> rows, Long consentId,
            String notice) {
    }

    // INP-04~06 정보 제공 동의.
    public record ConsentItem(Long consentId, String consentTypeCode, String providerCode, String itemCode, OffsetDateTime agreedAt,
            OffsetDateTime expiresAt, OffsetDateTime withdrawnAt) {
    }

    public record ConsentList(List<ConsentItem> items) {
    }

    public record ConsentAgree(String consentTypeCode, String providerCode, String itemCode) {
    }

    public record ConsentAgreed(Long consentId, OffsetDateTime agreedAt) {
    }

    public record ConsentWithdrawn(Long consentId, OffsetDateTime withdrawnAt) {
    }
}
