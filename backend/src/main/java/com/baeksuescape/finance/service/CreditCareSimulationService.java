package com.baeksuescape.finance.service;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.baeksuescape.assessment.client.PredictionClient;
import com.baeksuescape.assessment.client.PredictionClient.SimulationFailedException;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FeatureRow;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.finance.dto.simulation.CreditCareBaseResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationRequest;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse.Delta;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse.ReductionFactor;
import com.baeksuescape.finance.dto.simulation.CreditCareSimulationResponse.ScoreSummary;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;
import com.baeksuescape.user.mapper.FinancialInputMapper;
import com.baeksuescape.user.service.DataInputUsers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * FP-170 N-18 신용케어 시뮬레이터 — SIM-01 입력 10개의 내 실제 값, SIM-02 바꾼 값으로 점수 재계산(FastAPI ML-04, 저장 안 함).
 * 출발 평가는 점수가 나온(SCORED) 가장 최근 평가다. 저장된 피처값(FEATURE_SNAPSHOT)은 서버 안에서만 쓰고 화면에 보내지 않는다.
 */
@Service
public class CreditCareSimulationService {

    static final String TELECOM = "TELECOM_ON_TIME_MONTHS";
    static final String UTILITY = "UTILITY_LATE_MONTHS";
    static final String EASYPAY = "EASYPAY_MONTHLY_COUNT";
    static final String CARD_LIMIT = "CARD_LIMIT_AMT";
    static final String CARD_SPEND = "CARD_MONTHLY_SPEND_AMT";

    /** 화면 키 → 저장된 피처 코드 (FastAPI simulation.py DIRECT_CHANGES와 같다). 간편결제·카드는 따로 구한다. */
    private static final Map<String, String> DIRECT_FEATURES = orderedMap(
            TELECOM, "telecom_on_time_streak",
            UTILITY, "utility_late_months",
            "DELINQ_COUNT_12M", "DQ1200001",
            "CASH_ADVANCE_MONTHS", "CF1231605",
            "NEW_LOAN_COUNT_3M", "L22000900",
            "LOAN_BALANCE_AMT", "debt_balance_krw",
            "PRIVATE_LENDER_LOAN_BALANCE_AMT", "LA0099212");
    private static final String EASYPAY_FEATURE = "dp_payment_count_12m";

    /** ML-04가 받는 키 10개 (B팀 명세서 4-4) */
    static final Set<String> ALLOWED_KEYS = Set.of(TELECOM, UTILITY, "DELINQ_COUNT_12M", "CASH_ADVANCE_MONTHS",
            "NEW_LOAN_COUNT_3M", "LOAN_BALANCE_AMT", "PRIVATE_LENDER_LOAN_BALANCE_AMT", EASYPAY, CARD_LIMIT, CARD_SPEND);
    /**
     * 상한이 있는 키: 통신비 정시 납부·공과금 미납 개월 수는 0~12 (피처 정의서 8-2, 학습 데이터 기준). 나머지 상한은 화면 범위가 정해지면 추가한다.
     * TODO(정의서 8-2) 통신비는 B팀 명세 예시의 18·24개월과 맞추는 중이라 12는 임시값이다(화면 mock과 같다).
     */
    static final int MAX_MONTHS = 12;
    private static final Set<String> MONTH_KEYS = Set.of(TELECOM, UTILITY);

    static final String MODEL_NOT_READY_MESSAGE = "점수 계산 서버가 준비 중입니다. 잠시 후 다시 시도해 주세요.";

    private final AssessmentMapper assessmentMapper;
    private final FinancialInputMapper inputMapper;
    private final PredictionClient predictionClient;
    private final DataInputUsers users;
    private final ObjectMapper objectMapper;

    public CreditCareSimulationService(AssessmentMapper assessmentMapper, FinancialInputMapper inputMapper,
            PredictionClient predictionClient, DataInputUsers users, ObjectMapper objectMapper) {
        this.assessmentMapper = assessmentMapper;
        this.inputMapper = inputMapper;
        this.predictionClient = predictionClient;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    /** N-18-1·10 SIM-01: 출발 평가의 피처값에서 8개, 그 기준월의 카드 직접 입력에서 한도·월 사용액 2개를 꺼낸다. */
    public CreditCareBaseResponse base(long userId) {
        AssessmentRow base = requireLatestScored(userId);
        Map<String, Object> snapshot = readSnapshot(base);

        Map<String, Long> values = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : DIRECT_FEATURES.entrySet()) {
            values.put(entry.getKey(), toLong(snapshot.get(entry.getValue())));
        }
        // ML-04는 월 건수 × 12로 바꾸므로 거꾸로 ÷ 12 해서 월 건수로 보여 준다
        Long easypay12m = toLong(snapshot.get(EASYPAY_FEATURE));
        values.put(EASYPAY, easypay12m == null ? null : Math.round(easypay12m / 12.0));
        // 피처값에는 카드 사용률만 있어서, 한도·월 사용액은 그 평가 기준월의 직접 입력에서 읽는다
        CreditRow credit = base.getInputBaseMonth() == null ? null
                : inputMapper.selectManualCredit(userId, YearMonth.parse(base.getInputBaseMonth()).atEndOfMonth());
        values.put(CARD_LIMIT, credit == null ? null : credit.getCardLimitAmt());
        values.put(CARD_SPEND, credit == null ? null : credit.getCardMonthlySpendAmt());

        return new CreditCareBaseResponse(base.getRequestId(), users.toOffset(base.getAssessedAt()), base.getAltScore(),
                base.getAltGradeBandCode(), values);
    }

    /** N-18-4·5·8 SIM-02: 바꾼 값을 검사하고 ML-04로 다시 계산한다. 실패하면 저장하지 않고 화면에 알린다. */
    public CreditCareSimulationResponse recalculate(long userId, CreditCareSimulationRequest request) {
        Map<String, Object> changes = validateChanges(request == null ? null : request.changes());
        AssessmentRow base = requireLatestScored(userId);

        Map<String, Object> baseAssessment = new LinkedHashMap<>();
        baseAssessment.put("requestId", base.getRequestId());
        baseAssessment.put("modelVersion", base.getModelVersion());
        baseAssessment.put("featureSetVersion", base.getFeatureSetVersion());
        baseAssessment.put("featureSnapshot", readSnapshot(base));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("requestId", UUID.randomUUID().toString());
        body.put("baseAssessment", baseAssessment);
        body.put("changes", changes);

        Map<String, Object> result;
        try {
            result = predictionClient.simulate(body);
        } catch (SimulationFailedException e) {
            throw toApiException(e);
        }
        return toResponse(result, featureNames(base));
    }

    /** 점수가 나온 최근 평가. 하나도 없으면 리포트와 같은 404 ASSESSMENT_NOT_FOUND. */
    private AssessmentRow requireLatestScored(long userId) {
        AssessmentRow row = assessmentMapper.selectLatestScored(userId);
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다.");
        }
        return row;
    }

    /**
     * 바꾼 값 검사 — 문제를 모두 모아 400 INVALID_INPUT(field = changes.<키>)으로 알린다. FastAPI는 범위를 검사하지 않아 여기서 먼저 막는다.
     * null 값은 키를 뺀 것과 같아 ML-04로 보내지 않는다. 돌려주는 Map은 null이 빠진 바꾼 값이다.
     */
    static Map<String, Object> validateChanges(Map<String, Object> changes) {
        Map<String, Object> cleaned = new LinkedHashMap<>();
        if (changes == null) {
            return cleaned;
        }
        List<FieldErrorItem> errors = new ArrayList<>();
        for (Map.Entry<String, Object> entry : changes.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            String field = "changes." + key;
            if (!ALLOWED_KEYS.contains(key)) {
                errors.add(new FieldErrorItem(field, "모르는 항목입니다."));
            } else if (value == null) {
                continue;
            } else if (!isNonNegativeInteger(value)) {
                errors.add(new FieldErrorItem(field, "0 이상의 정수를 입력해 주세요."));
            } else if (MONTH_KEYS.contains(key) && ((Number) value).longValue() > MAX_MONTHS) {
                errors.add(new FieldErrorItem(field, "0~" + MAX_MONTHS + " 사이로 입력해 주세요."));
            } else {
                cleaned.put(key, ((Number) value).longValue());
            }
        }
        // 저장된 피처값에는 사용률만 있어 한쪽만으로는 다시 계산할 수 없다 (ML-04와 같은 규칙)
        if ((changes.get(CARD_LIMIT) == null) != (changes.get(CARD_SPEND) == null)) {
            errors.add(new FieldErrorItem("changes." + CARD_LIMIT, "카드 한도와 월 카드 사용액은 함께 보내야 합니다."));
        }
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.", errors);
        }
        return cleaned;
    }

    // JSON 정수(Integer·Long·BigInteger)이고 0 이상인지. 소수(12.5, 12.0)와 문자열은 정수가 아니다.
    private static boolean isNonNegativeInteger(Object value) {
        if (value instanceof java.math.BigInteger big) {
            // long 범위를 넘는 큰 수는 금액으로 의미가 없어 막는다
            return big.signum() >= 0 && big.bitLength() < Long.SIZE;
        }
        return (value instanceof Integer || value instanceof Long) && ((Number) value).longValue() >= 0;
    }

    /** ML-04 실패 → 화면 오류 (SIM-02 규칙). 422 등 4xx는 400, 409는 409, 그 밖(503·연결 실패·5xx)은 503. */
    static ApiException toApiException(SimulationFailedException e) {
        if (e.getStatus() == 409) {
            return new ApiException(HttpStatus.CONFLICT, "VERSION_MISMATCH",
                    "저장된 평가의 모델이 바뀌었습니다. 점수를 다시 산출한 뒤 이용해 주세요.");
        }
        if (e.getStatus() >= 400 && e.getStatus() < 500) {
            return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.", e.getFieldErrors());
        }
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MODEL_NOT_READY", MODEL_NOT_READY_MESSAGE);
    }

    private Map<String, Object> readSnapshot(AssessmentRow base) {
        if (base.getFeatureSnapshot() == null) {
            throw new IllegalStateException("SCORED 평가에 피처값이 없습니다. requestId=" + base.getRequestId());
        }
        try {
            return objectMapper.readValue(base.getFeatureSnapshot(), new TypeReference<Map<String, Object>>() { });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("저장된 피처값을 읽지 못했습니다. requestId=" + base.getRequestId(), e);
        }
    }

    // 감점 요인 이름은 그 평가의 피처 세트(DIM_FEATURE)에서 찾는다
    private Map<String, String> featureNames(AssessmentRow base) {
        Map<String, String> names = new HashMap<>();
        for (FeatureRow row : assessmentMapper.selectModelFeatures(base.getFeatureSetVersion(), base.getModelVersion())) {
            names.put(row.getFeatureCode(), row.getFeatureName());
        }
        return names;
    }

    // ML-04 응답 → SIM-02 응답 (requestId·shap은 버린다)
    @SuppressWarnings("unchecked")
    private static CreditCareSimulationResponse toResponse(Map<String, Object> result, Map<String, String> names) {
        Map<String, Object> delta = (Map<String, Object>) result.getOrDefault("delta", Map.of());
        List<ReductionFactor> factors = new ArrayList<>();
        Object rawFactors = result.get("topReductionFactors");
        if (rawFactors instanceof List<?> list) {
            for (Object item : list) {
                Map<String, Object> f = (Map<String, Object>) item;
                String code = (String) f.get("featureCode");
                factors.add(new ReductionFactor(toInt(f.get("rank")), code, names.get(code), toDouble(f.get("featureValue")),
                        toInt(f.get("shapScore")), toInt(f.get("recoverScore"))));
            }
        }
        return new CreditCareSimulationResponse((String) result.get("modelVersion"), (String) result.get("cutoffVersion"),
                summary(result.get("before")), summary(result.get("after")),
                new Delta(toInt(delta.get("total")), toInt(delta.get("financialEffect")), toInt(delta.get("alternativeEffect"))),
                factors);
    }

    @SuppressWarnings("unchecked")
    private static ScoreSummary summary(Object raw) {
        Map<String, Object> m = raw instanceof Map ? (Map<String, Object>) raw : Map.of();
        return new ScoreSummary(toInt(m.get("score")), (String) m.get("gradeBandCode"), toDouble(m.get("defaultProb")));
    }

    private static Integer toInt(Object value) {
        return value instanceof Number n ? (int) Math.round(n.doubleValue()) : null;
    }

    private static Long toLong(Object value) {
        return value instanceof Number n ? Math.round(n.doubleValue()) : null;
    }

    private static Double toDouble(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    private static Map<String, String> orderedMap(String... keyValues) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put(keyValues[i], keyValues[i + 1]);
        }
        return map;
    }
}
