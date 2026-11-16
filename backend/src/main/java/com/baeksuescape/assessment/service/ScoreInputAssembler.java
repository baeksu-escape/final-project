package com.baeksuescape.assessment.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.dto.DataInputRows.EasypayRow;
import com.baeksuescape.user.dto.DataInputRows.ExpenseRow;
import com.baeksuescape.user.dto.DataInputRows.IncomeRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;
import com.baeksuescape.user.dto.DataInputRows.LoanRow;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.FinancialInputMapper;

// FP-142 N-12-2 DB에 저장된 회원 입력 → FastAPI ML-03 요청 본문(B팀 명세서 4-3과 같은 필드 이름).
// 피처 계산은 하지 않는다. 계산은 FastAPI 한 곳에서만 한다(명세서 1장, 학습·서비스 계산이 갈라지지 않게).
// 소득·대출·지출·카드는 A팀 FinancialInputMapper의 읽기 메서드를 그대로 쓴다(A팀 코드는 고치지 않는다).
@Component
public class ScoreInputAssembler {

    static final String EMPLOYEE = "EMPLOYEE";

    private final FinancialInputMapper inputMapper;
    private final AssessmentMapper assessmentMapper;

    public ScoreInputAssembler(FinancialInputMapper inputMapper, AssessmentMapper assessmentMapper) {
        this.inputMapper = inputMapper;
        this.assessmentMapper = assessmentMapper;
    }

    // ML-03 요청 본문. baseMonth = 회원이 저장한 가장 최근 기준월, age = 올해 − 출생연도.
    public Map<String, Object> build(String requestId, String expectedModelVersion, UserAccount user, String baseMonth, int age) {
        long userId = user.getUserId();
        boolean employee = EMPLOYEE.equals(user.getWorkerTypeCode());
        Integer required = assessmentMapper.selectRequiredIncomeMonths(user.getWorkerTypeCode());

        Map<String, Object> applicant = new LinkedHashMap<>();
        applicant.put("workerTypeCode", user.getWorkerTypeCode());
        applicant.put("age", age);
        applicant.put("requiredIncomeMonths", required);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requestId", requestId);
        body.put("expectedModelVersion", expectedModelVersion);
        body.put("applicant", applicant);
        body.put("inputBaseMonth", baseMonth);
        body.put("incomeMonths", incomes(userId, baseMonth, employee));
        body.put("expenses", expenses(userId, baseMonth));
        body.put("loans", loans(userId, baseMonth));
        body.put("creditProfile", creditProfile(userId, baseMonth));
        body.put("alternativeData", alternativeData(userId));
        return body;
    }

    // 급여소득자는 기준월 월급 1개, 자영업자·프리랜서는 기준월로 끝나는 12개월.
    private List<Map<String, Object>> incomes(long userId, String baseMonth, boolean employee) {
        String from = employee ? baseMonth : YearMonth.parse(baseMonth).minusMonths(11).toString();
        List<Map<String, Object>> out = new ArrayList<>();
        for (IncomeRow row : inputMapper.selectIncomes(userId, from, baseMonth)) {
            out.add(map("baseMonth", row.getBaseMonth(), "incomeKindCode", row.getIncomeKindCode(), "incomeAmt", row.getIncomeAmt()));
        }
        return out;
    }

    private List<Map<String, Object>> expenses(long userId, String baseMonth) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ExpenseRow row : inputMapper.selectExpenses(userId, baseMonth)) {
            out.add(map("expenseGroupCode", row.getExpenseGroupCode(), "expenseCategory", row.getExpenseCategory(),
                    "monthlyAmt", row.getMonthlyAmt()));
        }
        return out;
    }

    // 대출 "해당 없음"(NO_LOAN_YN = 'Y', O-15 A안)이면 행이 없어 빈 목록이 된다.
    private List<Map<String, Object>> loans(long userId, String baseMonth) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (LoanRow row : inputMapper.selectLoans(userId, baseMonth)) {
            Map<String, Object> loan = map("loanTypeCode", row.getLoanTypeCode(), "sourceCode", row.getSourceCode(),
                    "balanceAmt", row.getBalanceAmt(), "annualRatePct", row.getAnnualRatePct());
            loan.put("remainingMonths", row.getRemainingMonths());
            loan.put("monthlyPaymentAmt", row.getMonthlyPaymentAmt());
            out.add(loan);
        }
        return out;
    }

    // 카드·신용 이용(회원 직접 입력, 1차는 MANUAL만). "신용 이력이 없어요"면 값이 null로 간다(0으로 바꾸지 않는다).
    private Map<String, Object> creditProfile(long userId, String baseMonth) {
        LocalDate baseDate = YearMonth.parse(baseMonth).atEndOfMonth();
        CreditRow row = inputMapper.selectManualCredit(userId, baseDate);
        Map<String, Object> credit = new LinkedHashMap<>();
        credit.put("sourceCode", "MANUAL");
        credit.put("delinqCount12m", row == null ? null : row.getDelinqCount12m());
        credit.put("newLoanCount3m", row == null ? null : row.getNewLoanCount3m());
        credit.put("cardLimitAmt", row == null ? null : row.getCardLimitAmt());
        credit.put("cardMonthlySpendAmt", row == null ? null : row.getCardMonthlySpendAmt());
        credit.put("cashAdvanceMonths", row == null ? null : row.getCashAdvanceMonths());
        credit.put("privateLenderLoanBalanceAmt", row == null ? null : row.getPrivateLenderLoanBalanceAmt());
        return credit;
    }

    // 대안 데이터 5종 — 동의가 필수라 모두 보낸다. 빈 목록은 "불러왔지만 기록 없음".
    private Map<String, Object> alternativeData(long userId) {
        Map<String, Object> alt = new LinkedHashMap<>();
        alt.put("telecom", bills(assessmentMapper.selectImportedTelecom(userId)));
        alt.put("utility", bills(assessmentMapper.selectImportedUtility(userId)));
        List<Map<String, Object>> easypay = new ArrayList<>();
        for (EasypayRow row : assessmentMapper.selectImportedEasypay(userId)) {
            Map<String, Object> month = map("baseMonth", row.getBaseMonth(), "observationStatusCode", row.getObservationStatusCode(),
                    "paymentCount", row.getPaymentCount(), "paymentAmt", row.getPaymentAmt());
            month.put("activeDays", row.getActiveDays());
            easypay.add(month);
        }
        alt.put("easypay", easypay);
        List<Map<String, Object>> insurance = new ArrayList<>();
        for (InsuranceRow row : assessmentMapper.selectImportedInsurance(userId)) {
            Map<String, Object> month = map("insuranceTypeCode", row.getInsuranceTypeCode(), "baseMonth", row.getBaseMonth(),
                    "coverageStatusCode", row.getCoverageStatusCode(), "payerTypeCode", row.getPayerTypeCode());
            month.put("paymentStatusCode", row.getPaymentStatusCode());
            month.put("individualAmt", row.getIndividualAmt());
            month.put("paidAmt", row.getPaidAmt());
            insurance.add(month);
        }
        alt.put("socialInsurance", insurance);
        return alt;
    }

    private static List<Map<String, Object>> bills(List<BillRow> rows) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (BillRow row : rows) {
            Map<String, Object> bill = map("billMonth", row.getBillMonth(), "billedAmt", row.getBilledAmt(),
                    "dueDate", text(row.getDueDate()), "paidDate", text(row.getPaidDate()));
            bill.put("paymentStatusCode", row.getPaymentStatusCode());
            out.add(bill);
        }
        return out;
    }

    private static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }

    // 값이 null이어도 키를 남기는 순서 있는 Map (Map.of는 null을 받지 않는다).
    private static Map<String, Object> map(Object... keyValues) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            out.put((String) keyValues[i], keyValues[i + 1]);
        }
        return out;
    }
}
