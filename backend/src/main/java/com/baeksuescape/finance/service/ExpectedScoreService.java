package com.baeksuescape.finance.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.baeksuescape.assessment.client.PredictionClient;
import com.baeksuescape.assessment.client.PredictionClient.PredictionFailedException;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.assessment.service.ScoreInputAssembler;
import com.baeksuescape.finance.dto.cashflow.CashFlowConditionRequest;
import com.baeksuescape.finance.dto.cashflow.ExpectedScoreResponse;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.DataInputUsers;
import com.baeksuescape.user.service.FinancialInputService;

/**
 * FP-170 N-21-8 DIAG-09 현금흐름 조건별 예상 대안 점수 — 저장된 입력으로 ML-03 요청을 만들고 소득·지출만 바꿔 다시 계산한다(저장 안 함).
 * 요청 모양은 ScoreInputAssembler 한 곳에서만 만든다(범영 11/18). 저장하는 ScoreCalculationService.calculate()는 쓰지 않는다.
 */
@Service
public class ExpectedScoreService {

    static final String FIXED_GROUP = "FIXED";
    static final String FIXED_CATEGORY = "고정지출";
    /** 소득 변동 폭을 보내지 않으면 과거 달 소득을 그대로 쓴다(100%) */
    static final int DEFAULT_VARIATION_PCT = 100;
    /** N-21-2 카드값·대출 납부 '밀림' */
    static final String DELAYED = "DELAYED";
    /** FP-239 밀림이면 최근 1년 30일 이상 연체(DQ1200001)를 이만큼 더한다(경환 제안, 범영 11/20 동의) */
    static final int ASSUMED_DELINQUENCY_INCREMENT = 1;

    private final AssessmentMapper assessmentMapper;
    private final ScoreInputAssembler assembler;
    private final PredictionClient predictionClient;
    private final DataInputUsers users;
    private final FinancialInputService financialInput;
    private final IncomeVolatilityService incomeVolatilityService;

    public ExpectedScoreService(AssessmentMapper assessmentMapper, ScoreInputAssembler assembler,
            PredictionClient predictionClient, DataInputUsers users, FinancialInputService financialInput,
            IncomeVolatilityService incomeVolatilityService) {
        this.assessmentMapper = assessmentMapper;
        this.assembler = assembler;
        this.predictionClient = predictionClient;
        this.users = users;
        this.financialInput = financialInput;
        this.incomeVolatilityService = incomeVolatilityService;
    }

    /** DIAG-09: 조건 검사 → 현재 점수(최근 SCORED) → 바꾼 입력으로 ML-03 1회 호출 → 점수 차이. */
    public ExpectedScoreResponse expectedScore(long userId, CashFlowConditionRequest condition) {
        CashFlowConditionRequest cond = condition == null ? new CashFlowConditionRequest() : condition;
        incomeVolatilityService.validateScreenConditions(cond);

        AssessmentRow current = assessmentMapper.selectLatestScored(userId);
        if (current == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다.");
        }

        // 회원·기준월·나이는 점수 산출(RPT-01)과 같은 방식으로 구한다
        UserAccount user = users.requireUserWithJob(userId);
        List<String> savedBaseMonths = financialInput.load(userId).savedBaseMonths();
        if (savedBaseMonths.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "INPUT_INCOMPLETE", "입력 완료 현황 6개 항목을 모두 채워 주세요.");
        }
        if (user.getBirthYear() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "INPUT_INCOMPLETE", "출생연도 정보가 없어 점수를 산출할 수 없습니다.");
        }
        String baseMonth = savedBaseMonths.get(savedBaseMonths.size() - 1);
        int age = users.now().getYear() - user.getBirthYear();
        String activeModel = assessmentMapper.selectActiveModelVersion();

        Map<String, Object> request = assembler.build(UUID.randomUUID().toString(), activeModel, user, baseMonth, age);
        checkIncomeMonths(request);   // 소득 개월 수가 모자라면 ML-03이 422로 거절하므로 부르기 전에 409로 알린다
        checkBillData(request);       // 통신비·공과금 기관 기록이 없어도 ML-03이 422로 거절하므로 이유를 알려 준다(FP-239 리뷰, 범영 제안)
        applyIncomeCondition(request, cond);
        applyExpenseCondition(request, cond);
        Integer assumedDelinquencyCount = applyPaymentStatus(request, cond);

        Map<String, Object> result;
        try {
            result = predictionClient.score(request);   // 한 번만 부르고 저장하지 않는다
        } catch (PredictionFailedException e) {
            throw toApiException(e);
        }
        return toResponse(current, result, assumedDelinquencyCount);
    }

    /**
     * FP-239 납부 상태 반영(N-21-2) — 밀림(DELAYED)이면 ML-03 요청의 최근 1년 30일 이상 연체 건수(creditProfile.delinqCount12m,
     * 피처 DQ1200001)에 1을 더하고 그 값을 돌려준다. 저장값이 없으면(신용 이력 없음) 0으로 보고 더한다(모델 0.2가 null을 0으로 읽는 것과 같음, D-31).
     * 제때(ON_TIME)·생략이면 바꾸지 않고 null이다. 화면 문구: "최근 1년 30일 이상 연체 1회 추가로 가정"(범영 11/20 동의).
     */
    @SuppressWarnings("unchecked")
    static Integer applyPaymentStatus(Map<String, Object> request, CashFlowConditionRequest cond) {
        if (!DELAYED.equals(cond.getPaymentStatus())) {
            return null;
        }
        Map<String, Object> credit = request.get("creditProfile") instanceof Map
                ? (Map<String, Object>) request.get("creditProfile") : null;
        if (credit == null) {
            credit = new LinkedHashMap<>();
            request.put("creditProfile", credit);
        }
        int stored = credit.get("delinqCount12m") instanceof Number n ? n.intValue() : 0;
        int assumed = stored + ASSUMED_DELINQUENCY_INCREMENT;
        credit.put("delinqCount12m", assumed);
        return assumed;
    }

    /**
     * N-21-8 통신비 또는 공과금 기관 기록이 0건이면 예상 점수를 계산하지 않고 409 ALT_DATA_EMPTY로 이유를 알린다(11/23 FP-239 리뷰 후속).
     * 기준은 점수 산출(RPT-01)의 ScoreCalculationService.isBillDataEmpty와 같다(피처 정의서 8-5·D-30 (다)). 그 메서드는 다른 패키지라 같은 조건을 여기에 둔다.
     * 간편결제·보험은 0건도 학습에 있어 막지 않는다.
     */
    @SuppressWarnings("unchecked")
    static void checkBillData(Map<String, Object> request) {
        Map<String, Object> alt = request.get("alternativeData") instanceof Map
                ? (Map<String, Object>) request.get("alternativeData") : null;
        List<Object> telecom = alt == null ? null : (List<Object>) alt.get("telecom");
        List<Object> utility = alt == null ? null : (List<Object>) alt.get("utility");
        if (telecom == null || telecom.isEmpty() || utility == null || utility.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "ALT_DATA_EMPTY", "통신비·공과금 기록이 없어 예상 점수를 계산할 수 없어요.");
        }
    }

    /**
     * 소득이 직군에 필요한 개월 수(DIM_WORKER_TYPE: 자영업자·프리랜서 12, 급여소득자 1)만큼 서로 다른 달로 있는지 확인한다.
     * 모자라면 점수 산출(RPT-01)과 같은 409 INPUT_INCOMPLETE. 0원으로 채워 계산하지 않는다(경환 님 요청 ④, 11/19).
     */
    @SuppressWarnings("unchecked")
    static void checkIncomeMonths(Map<String, Object> request) {
        Map<String, Object> applicant = (Map<String, Object>) request.get("applicant");
        List<Map<String, Object>> incomes = (List<Map<String, Object>>) request.get("incomeMonths");
        Object required = applicant == null ? null : applicant.get("requiredIncomeMonths");
        long distinct = incomes == null ? 0 : incomes.stream().map(m -> m.get("baseMonth")).distinct().count();
        if (!(required instanceof Integer months) || incomes == null || incomes.size() != months || distinct != months) {
            throw new ApiException(HttpStatus.CONFLICT, "INPUT_INCOMPLETE", "소득을 필요한 개월 수만큼 입력해 주세요.");
        }
    }

    /**
     * 소득 조건 반영(N-21-2) — 각 달 = 평균 + (그 달 − 평균) × 변동 폭% 에 소득 변화율%를 곱한다. 0원 아래는 0, 원 단위 반올림.
     * 현금흐름 전망과 같은 식이다. 급여소득자(1개월)는 평균이 곧 그 달이라 변화율만 적용된다.
     */
    @SuppressWarnings("unchecked")
    static void applyIncomeCondition(Map<String, Object> request, CashFlowConditionRequest cond) {
        List<Map<String, Object>> incomes = (List<Map<String, Object>>) request.get("incomeMonths");
        if (incomes == null || incomes.isEmpty()) {
            return;
        }
        double mean = incomes.stream().mapToDouble(m -> amount(m.get("incomeAmt"))).average().orElse(0);
        int variation = cond.getIncomeVariationPct() == null ? DEFAULT_VARIATION_PCT : cond.getIncomeVariationPct();
        double change = 1.0 + cond.getIncomeChangePercent() / 100.0;
        for (Map<String, Object> month : incomes) {
            double varied = mean + (amount(month.get("incomeAmt")) - mean) * variation / 100.0;
            month.put("incomeAmt", Math.max(0L, Math.round(varied * change)));
        }
    }

    /**
     * 지출 조건 반영(N-21-2) — 월 고정 지출을 보내면 FIXED 항목들의 비율을 지킨 채 합계를 그 값으로 맞춘다(반올림 차이는 마지막 항목).
     * FIXED 항목이 없으면 FIXED 1행을 더한다. 그다음 모든 항목에 지출 변화율%를 곱한다.
     */
    @SuppressWarnings("unchecked")
    static void applyExpenseCondition(Map<String, Object> request, CashFlowConditionRequest cond) {
        List<Map<String, Object>> expenses = (List<Map<String, Object>>) request.get("expenses");
        if (expenses == null) {
            expenses = new ArrayList<>();
            request.put("expenses", expenses);
        }
        Long target = cond.getFixedExpenseAmount();
        if (target != null) {
            List<Map<String, Object>> fixed = expenses.stream()
                    .filter(e -> FIXED_GROUP.equals(e.get("expenseGroupCode"))).toList();
            if (fixed.isEmpty()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("expenseGroupCode", FIXED_GROUP);
                row.put("expenseCategory", FIXED_CATEGORY);
                row.put("monthlyAmt", target);
                expenses.add(row);
            } else {
                scaleFixed(fixed, target);
            }
        }
        double change = 1.0 + cond.getExpenseChangePercent() / 100.0;
        if (change != 1.0) {
            for (Map<String, Object> e : expenses) {
                e.put("monthlyAmt", Math.max(0L, Math.round(amount(e.get("monthlyAmt")) * change)));
            }
        }
    }

    // FIXED 항목 합계를 target으로 맞춘다. 저장 합계가 0이면 비율을 정할 수 없어 마지막 항목에 모두 둔다.
    private static void scaleFixed(List<Map<String, Object>> fixed, long target) {
        double sum = fixed.stream().mapToDouble(e -> amount(e.get("monthlyAmt"))).sum();
        long assigned = 0;
        for (int i = 0; i < fixed.size() - 1; i++) {
            long value = sum == 0 ? 0 : Math.round(amount(fixed.get(i).get("monthlyAmt")) * target / sum);
            fixed.get(i).put("monthlyAmt", value);
            assigned += value;
        }
        fixed.get(fixed.size() - 1).put("monthlyAmt", Math.max(0L, target - assigned));
    }

    /** ML-03 실패 → 화면 오류 (SIM-02와 같은 규칙). 4xx(다시 보내도 같음)는 400, 연결 실패·타임아웃·5xx는 503. 저장하지 않는다. */
    static ApiException toApiException(PredictionFailedException e) {
        if (!e.isRetryable()) {
            return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.");
        }
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MODEL_NOT_READY",
                CreditCareSimulationService.MODEL_NOT_READY_MESSAGE);
    }

    @SuppressWarnings("unchecked")
    private static ExpectedScoreResponse toResponse(AssessmentRow current, Map<String, Object> result, Integer assumedDelinquencyCount) {
        Map<String, Object> alt = result.get("alternative") instanceof Map ? (Map<String, Object>) result.get("alternative") : Map.of();
        Integer expected = alt.get("score") instanceof Number n ? (int) Math.round(n.doubleValue()) : null;
        Integer diff = expected == null || current.getAltScore() == null ? null : expected - current.getAltScore();
        // 현재 점수를 낸 모델(baseModelVersion)을 함께 보내, 예상 점수 모델과 다르면 화면이 "모델이 바뀌어 차이가 클 수 있음"을 안내한다(경환 11/19).
        // FP-239 밀림이면 연체 +1을 점수에 반영했다는 것(paymentStatusApplied)과 넣은 연체 건수를 화면에 알린다
        return new ExpectedScoreResponse(current.getAltScore(), current.getAltGradeBandCode(), expected,
                (String) alt.get("gradeBandCode"), diff, (String) result.get("modelVersion"), current.getModelVersion(),
                current.getRequestId(), assumedDelinquencyCount != null, assumedDelinquencyCount);
    }

    private static double amount(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0;
    }
}
