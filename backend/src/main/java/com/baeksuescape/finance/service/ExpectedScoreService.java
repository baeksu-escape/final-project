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
        applyIncomeCondition(request, cond);
        applyExpenseCondition(request, cond);

        Map<String, Object> result;
        try {
            result = predictionClient.score(request);   // 한 번만 부르고 저장하지 않는다
        } catch (PredictionFailedException e) {
            throw toApiException(e);
        }
        return toResponse(current, result);
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
    private static ExpectedScoreResponse toResponse(AssessmentRow current, Map<String, Object> result) {
        Map<String, Object> alt = result.get("alternative") instanceof Map ? (Map<String, Object>) result.get("alternative") : Map.of();
        Integer expected = alt.get("score") instanceof Number n ? (int) Math.round(n.doubleValue()) : null;
        Integer diff = expected == null || current.getAltScore() == null ? null : expected - current.getAltScore();
        // 현재 점수를 낸 모델(baseModelVersion)을 함께 보내, 예상 점수 모델과 다르면 화면이 "모델이 바뀌어 차이가 클 수 있음"을 안내한다(경환 11/19).
        // 납부 상태(DELAYED)를 어느 피처에 반영할지 정해지기 전이라 점수에 쓰지 않았다는 것을 화면에 알린다
        return new ExpectedScoreResponse(current.getAltScore(), current.getAltGradeBandCode(), expected,
                (String) alt.get("gradeBandCode"), diff, (String) result.get("modelVersion"), current.getModelVersion(),
                current.getRequestId(), false);
    }

    private static double amount(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0;
    }
}
