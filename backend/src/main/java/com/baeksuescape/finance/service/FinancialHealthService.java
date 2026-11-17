package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.DsrCalculateRequest;
import com.baeksuescape.finance.dto.DsrCalculateResponse;
import com.baeksuescape.finance.dto.FinancialHealthRequest;
import com.baeksuescape.finance.dto.FinancialHealthResponse;
import com.baeksuescape.finance.util.FinancialHealthCalculator;
import com.baeksuescape.finance.util.FinancialHealthCalculator.HealthResult;
import com.baeksuescape.finance.util.FinancialHealthCalculator.RiskLevel;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-166 건전성 지표(N-16-1·2)와 DSR 계산기(N-20-4) 서비스.
 * 받은 값을 검사한 뒤 FinancialHealthCalculator로 계산하고 화면 응답 형식으로 바꾼다. DB는 읽지 않는다.
 */
@Service
public class FinancialHealthService {

    /**
     * N-20-4 DSR 계산·위험 단계. 기존 프론트 mock과 같은 응답 형식(DsrCalculateResponse)으로 돌려준다.
     * 금액이 음수이거나 연소득이 0 이하이면 계산할 수 없으므로 400 INVALID_INPUT을 던진다.
     */
    public DsrCalculateResponse calculateDsr(DsrCalculateRequest request) {
        if (request == null) {
            throw badRequest(null, "요청 값이 없습니다.");
        }
        requireNotNegative(request.getAnnualIncome(), "annualIncome", "연소득");
        requireNotNegative(request.getAnnualDebtService(), "annualDebtService", "연간 원리금 상환액");

        BigDecimal ratio = FinancialHealthCalculator.calculateRepaymentBurdenRatio(
                BigDecimal.valueOf(request.getAnnualDebtService()),
                BigDecimal.valueOf(request.getAnnualIncome()));
        if (ratio == null) {
            throw badRequest("annualIncome", "연소득이 0원이라 DSR을 계산할 수 없습니다.");
        }

        RiskLevel level = FinancialHealthCalculator.evaluateRiskLevel(
                ratio, FinancialHealthCalculator.DSR_CAUTION, FinancialHealthCalculator.DSR_DANGER);

        return DsrCalculateResponse.builder()
                .annualIncome(request.getAnnualIncome())
                .annualDebtService(request.getAnnualDebtService())
                .dsrRatio(ratio.doubleValue())
                .riskLevel(level.name())
                .riskBadgeText(badgeText(level))
                .description(dsrDescription(level))
                .build();
    }

    /**
     * N-16-1·2·3 건전성 지표 계산. 저장 값이든 값 바꿔 보기로 바꾼 값이든 같은 방식으로 계산한다.
     * 금액이 음수면 400 INVALID_INPUT을 던진다. 나누는 값이 0 이하인 비율은 null(계산 불가)로 돌려준다.
     */
    public FinancialHealthResponse calculateHealth(FinancialHealthRequest request) {
        if (request == null) {
            throw badRequest(null, "요청 값이 없습니다.");
        }
        requireNotNegative(request.getTotalAsset(), "totalAsset", "총자산");
        requireNotNegative(request.getAnnualIncome(), "annualIncome", "연소득");
        requireNotNegative(request.getTotalDebt(), "totalDebt", "총부채");
        requireNotNegative(request.getAnnualDebtService(), "annualDebtService", "연간 원리금 상환액");

        HealthResult result = FinancialHealthCalculator.calculateHealth(
                BigDecimal.valueOf(request.getTotalAsset()),
                BigDecimal.valueOf(request.getAnnualIncome()),
                BigDecimal.valueOf(request.getTotalDebt()),
                BigDecimal.valueOf(request.getAnnualDebtService()));

        return FinancialHealthResponse.builder()
                .totalAsset(result.totalAsset().longValue())
                .totalDebt(result.totalDebt().longValue())
                .netAsset(result.netAsset().longValue())
                .repaymentBurdenRatio(toDouble(result.repaymentBurdenRatio()))
                .repaymentBurdenLevel(toName(result.repaymentBurdenLevel()))
                .debtToAssetRatio(toDouble(result.debtToAssetRatio()))
                .debtToAssetLevel(toName(result.debtToAssetLevel()))
                .debtToNetAssetRatio(toDouble(result.debtToNetAssetRatio()))
                .debtToNetAssetLevel(toName(result.debtToNetAssetLevel()))
                .build();
    }

    /** 위험 배지에 쓰는 한국어 이름 (프론트 mock의 DSR_RISK_LEVELS와 같은 문구) */
    private String badgeText(RiskLevel level) {
        switch (level) {
            case DANGER:
                return "위험";
            case CAUTION:
                return "주의";
            default:
                return "안전";
        }
    }

    /** DSR 단계별 안내 문구. 프론트 mock의 "30%를 초과" 표현은 실제 기준(30% 이상)과 달라 "이상"으로 고쳐 썼다. */
    private String dsrDescription(RiskLevel level) {
        switch (level) {
            case DANGER:
                return "상환 부담률이 40% 이상이라 연체 위험이 높은 위험 단계입니다.";
            case CAUTION:
                return "상환 부담률이 30% 이상이라 추가 대출 시 주의가 필요합니다.";
            default:
                return "연소득 대비 원리금 상환 부담이 안정적인 수준입니다.";
        }
    }

    /** 금액이 음수면 그 필드를 fieldErrors에 담아 400을 던진다(프론트 serverErrors.js가 칸 옆에 표시). */
    private void requireNotNegative(long value, String field, String label) {
        if (value < 0) {
            throw badRequest(field, label + "은(는) 0 이상이어야 합니다.");
        }
    }

    /** 팀 공통 오류 형식 { code: INVALID_INPUT, message, fieldErrors }로 400을 만든다. field가 null이면 fieldErrors는 비운다. */
    private ApiException badRequest(String field, String message) {
        List<FieldErrorItem> fieldErrors = field == null ? List.of() : List.of(new FieldErrorItem(field, message));
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message, fieldErrors);
    }

    private Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private String toName(RiskLevel level) {
        return level == null ? null : level.name();
    }
}
