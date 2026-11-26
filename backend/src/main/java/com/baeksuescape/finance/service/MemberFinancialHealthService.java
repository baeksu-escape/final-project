package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.cashflow.MonthlyIncomeItem;
import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse;
import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse.LoanItem;
import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse.UtilityPayment;
import com.baeksuescape.finance.dto.health.FinancialHealthBaseResponse.UtilityPaymentMonth;
import com.baeksuescape.finance.dto.health.HealthAssetRow;
import com.baeksuescape.finance.dto.health.HealthLoanRow;
import com.baeksuescape.finance.mapper.FinancialHealthMapper;
import com.baeksuescape.finance.util.FinancialHealthCalculator;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * FP-239 N-16-1·2·4 DIAG-03-1 자산·부채 저장값 — 로그인 회원의 기준월(가장 늦은 소득월) 총자산·연소득·총부채·연 원리금·보유 대출.
 * 미입력은 0으로 바꾸지 않고 null로 돌려준다(O-15 A안, 동주 님 DIAG-01과 같은 규칙).
 * 공과금 납부율(N-20-5)은 기관 연동 기록을 집계하고, 건전성 비율·위험 단계는 화면이 DIAG-03을 호출해 구한다.
 */
@Service
@RequiredArgsConstructor
public class MemberFinancialHealthService {

    /** 연소득에 필요한 개월 수: 기준월 포함 최근 12개월(달력)이 모두 있어야 한다 */
    static final int ANNUAL_MONTHS = 12;
    private static final String NO_LOAN = "Y";

    private final IncomeVolatilityService incomeVolatilityService;
    private final FinancialHealthMapper mapper;

    /**
     * DIAG-03-1 N-20-1·N-20-5 기관 연동 공과금 기록과 기한 내 납부율을 저장값에 함께 담는다.
     * 저장된 소득이 없으면 loadIncomeHistory가 다른 저장값 API와 같은 404 NOT_FOUND를 던진다.
     */
    public FinancialHealthBaseResponse load(long userId) {
        List<MonthlyIncomeItem> history = incomeVolatilityService.loadIncomeHistory(userId, 0L);
        String baseMonth = history.get(history.size() - 1).getYearMonth();

        HealthAssetRow asset = mapper.selectLatestAsset(userId);
        List<HealthLoanRow> loans = mapper.selectLatestLoans(userId);
        boolean noLoan = loans.isEmpty() && asset != null && NO_LOAN.equals(asset.getNoLoanYn());

        // 대출 행이 있으면 합계, 없고 "대출 없음"이면 0, 둘 다 아니면 미입력(null). 삼항 연산자에 long과 null을 섞으면 null을 풀다가
        // NullPointerException이 나므로 if로 나눈다.
        Long totalDebt = null;
        Long annualPayment = null;
        if (!loans.isEmpty()) {
            totalDebt = loans.stream().mapToLong(HealthLoanRow::getBalanceAmount).sum();
            annualPayment = loans.stream().mapToLong(HealthLoanRow::getMonthlyPaymentAmount).sum() * ANNUAL_MONTHS;
        } else if (noLoan) {
            totalDebt = 0L;
            annualPayment = 0L;
        }

        return new FinancialHealthBaseResponse(baseMonth,
                asset == null ? null : asset.getTotalAssetAmount(),
                annualIncome(history),
                totalDebt,
                annualPayment,
                loans.stream().map(MemberFinancialHealthService::toItem).toList(),
                summarizeUtilityPayments(mapper.selectRecentUtilityPayments(userId)));
    }

    /** N-20-5 지연 납부와 미납을 합산하고, 연동 기록이 있는 달을 기준으로 기한 내 납부율을 계산한다. */
    private static UtilityPayment summarizeUtilityPayments(List<UtilityPaymentMonth> months) {
        if (months.isEmpty()) {
            return null;
        }

        int onTimeMonthCount = 0;
        int lateMonthCount = 0;
        // DDL의 NOT NULL·CK_UUP_STATUS는 아래 세 상태만 허용한다.
        // 예외 값은 상태별 집계에서 제외하고, 해당 달의 기록은 분모에 포함한다.
        for (UtilityPaymentMonth month : months) {
            String paymentStatusCode = month.paymentStatusCode();
            if (paymentStatusCode == null) {
                continue;
            }
            switch (paymentStatusCode) {
                case "ON_TIME" -> onTimeMonthCount++;
                case "LATE", "UNPAID" -> lateMonthCount++;
                default -> { }
            }
        }
        BigDecimal onTimeRatePct = FinancialHealthCalculator.calculateRatio(
                BigDecimal.valueOf(onTimeMonthCount), BigDecimal.valueOf(months.size()));
        return new UtilityPayment(months.size(), onTimeMonthCount, lateMonthCount, onTimeRatePct, months);
    }

    /**
     * 연소득 — N-20-3 공유 함수(FinancialHealthCalculator.calculateAnnualIncome)로 기준월 포함 최근 12개월(달력)의 합을 낸다.
     * 급여소득자는 loadIncomeHistory가 월급을 12개월로 펼쳐 주므로 합이 곧 월급 × 12다. 자영업자·프리랜서는 12개 달이 모두 있을 때만
     * 계산하고, 빠진 달이 있으면 null(일부 합으로 연소득을 낮게 보이지 않게 한다. DIAG-01과 같은 규칙).
     */
    static Long annualIncome(List<MonthlyIncomeItem> history) {
        if (history.size() != ANNUAL_MONTHS) {
            return null;
        }
        YearMonth base = YearMonth.parse(history.get(history.size() - 1).getYearMonth());
        for (int i = 0; i < ANNUAL_MONTHS; i++) {
            // 오름차순 i번째 행은 기준월에서 (11 − i)개월 전이어야 한다
            if (!base.minusMonths(ANNUAL_MONTHS - 1 - i).toString().equals(history.get(i).getYearMonth())) {
                return null;
            }
        }
        List<Long> incomes = history.stream().map(MonthlyIncomeItem::getIncome).toList();
        return FinancialHealthCalculator.calculateAnnualIncome(incomes, false).longValueExact();
    }

    private static LoanItem toItem(HealthLoanRow row) {
        return new LoanItem(row.getLoanId(), row.getLoanTypeCode(), row.getLoanTypeName(), row.getBalanceAmount(),
                row.getAnnualRatePct(), row.getRateTypeCode(), row.getRemainingMonths(), row.getMonthlyPaymentAmount());
    }
}
