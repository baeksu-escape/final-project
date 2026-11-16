package com.baeksuescape.assessment.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.assessment.client.PredictionClient;
import com.baeksuescape.assessment.client.PredictionClient.PredictionFailedException;
import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FactorRow;
import com.baeksuescape.assessment.dto.ScoreDtos;
import com.baeksuescape.assessment.mapper.AssessmentMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.user.dto.DataInputDtos;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.DataInputUsers;
import com.baeksuescape.user.service.FinancialInputService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

// FP-142 RPT-01 N-12-2 기존·대안 점수·3등급 계산·저장 — B팀 명세서 2장 판정 흐름을 그대로 따른다.
//   requestId 확인 → 같은 요청이면 처음 결과 → 직군(409) → 입력·동의 완료(409 INPUT_INCOMPLETE, O-13)
//   → 입력 최신성(APP_SETTING.INPUT_MAX_AGE_MONTHS, 넘으면 NOT_SCORABLE STALE_INPUT 저장)
//   → FastAPI ML-03(실패하면 1번 다시, 그래도 실패면 NOT_SCORABLE MODEL_ERROR 저장) → ASSESSMENT 1행 + ASSESSMENT_FACTOR를 한 트랜잭션으로 저장.
@Service
public class ScoreCalculationService {

    private static final Logger log = LoggerFactory.getLogger(ScoreCalculationService.class);

    static final Pattern REQUEST_ID = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
    static final String SCORED = "SCORED";
    static final String NOT_SCORABLE = "NOT_SCORABLE";
    static final String STALE_INPUT = "STALE_INPUT";
    static final String MODEL_ERROR = "MODEL_ERROR";
    static final String INPUT_MAX_AGE_KEY = "INPUT_MAX_AGE_MONTHS";
    // DB 설정이 없을 때만 쓰는 기본값 (DDL APP_SETTING 기준 데이터와 같은 3개월, 임시값·팀 결정 전)
    static final int DEFAULT_INPUT_MAX_AGE_MONTHS = 3;

    private final AssessmentMapper mapper;
    private final ScoreInputAssembler assembler;
    private final PredictionClient prediction;
    private final FinancialInputService financialInput;
    private final DataInputUsers users;
    private final ObjectMapper objectMapper;

    public ScoreCalculationService(AssessmentMapper mapper, ScoreInputAssembler assembler, PredictionClient prediction,
            FinancialInputService financialInput, DataInputUsers users, ObjectMapper objectMapper) {
        this.mapper = mapper;
        this.assembler = assembler;
        this.prediction = prediction;
        this.financialInput = financialInput;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ScoreDtos.ScoreResponse calculate(long userId, String requestId) {
        if (requestId == null || !REQUEST_ID.matcher(requestId).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.",
                    List.of(new FieldErrorItem("requestId", "요청 번호는 소문자 UUID여야 합니다.")));
        }
        users.lock(userId);   // 같은 회원이 버튼을 빠르게 두 번 눌러도 한 건만 만든다
        AssessmentRow existing = mapper.selectByRequestId(requestId);
        if (existing != null) {
            return sameRequest(existing, userId);
        }

        UserAccount user = users.requireUserWithJob(userId);
        DataInputDtos.FinancialInputResponse input = financialInput.load(userId);
        if (!isComplete(input.status()) || input.savedBaseMonths().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "INPUT_INCOMPLETE", "입력 완료 현황 6개 항목을 모두 채워 주세요.");
        }
        String baseMonth = input.savedBaseMonths().get(input.savedBaseMonths().size() - 1);
        // DB TIMESTAMP는 소수점 6자리라, 처음 응답과 다시 보냈을 때(DB에서 읽은 값)의 시각이 같도록 미리 맞춘다.
        LocalDateTime now = users.now().truncatedTo(ChronoUnit.MICROS);
        int age = user.getBirthYear() == null ? 0 : now.getYear() - user.getBirthYear();
        String modelVersion = mapper.selectActiveModelVersion();

        AssessmentRow row = baseRow(requestId, user, baseMonth, age, modelVersion, now);
        if (isStale(baseMonth, now)) {
            return save(notScorable(row, STALE_INPUT), List.of());
        }

        Map<String, Object> request = assembler.build(requestId, modelVersion, user, baseMonth, age);
        Map<String, Object> result;
        try {
            result = callWithOneRetry(request);
        } catch (PredictionFailedException e) {
            return save(notScorable(row, MODEL_ERROR), List.of());
        }
        return save(scored(row, result), factors(result));
    }

    // 같은 requestId — 같은 회원이면 처음 결과, 다른 회원이면 409.
    private ScoreDtos.ScoreResponse sameRequest(AssessmentRow existing, long userId) {
        if (!existing.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "REQUEST_ID_CONFLICT", "이미 쓰인 요청 번호입니다.");
        }
        return toResponse(existing);
    }

    // N-05-8 입력 완료 6항목(화면 completionItems.js와 같은 규칙) + 대안 데이터 5종 모두.
    static boolean isComplete(DataInputDtos.InputStatus status) {
        Map<String, Boolean> s = status.sections();
        boolean sections = Boolean.TRUE.equals(s.get("income")) && Boolean.TRUE.equals(s.get("workPeriod"))
                && Boolean.TRUE.equals(s.get("assets")) && Boolean.TRUE.equals(s.get("loans"))
                && Boolean.TRUE.equals(s.get("fixedExpense"));
        boolean altData = !status.altData().isEmpty() && status.altData().values().stream().allMatch(Boolean.TRUE::equals);
        return sections && altData;
    }

    // 기준월이 지금 달보다 설정한 개월 수를 넘게 오래됐는지 (DDL APP_SETTING R3).
    private boolean isStale(String baseMonth, LocalDateTime now) {
        long age = ChronoUnit.MONTHS.between(YearMonth.parse(baseMonth), YearMonth.from(now));
        return age > inputMaxAgeMonths();
    }

    private int inputMaxAgeMonths() {
        String value = mapper.selectSetting(INPUT_MAX_AGE_KEY);
        try {
            return value == null ? DEFAULT_INPUT_MAX_AGE_MONTHS : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return DEFAULT_INPUT_MAX_AGE_MONTHS;
        }
    }

    // 실패하면 같은 requestId로 1번만 다시 부른다(명세서 6장).
    private Map<String, Object> callWithOneRetry(Map<String, Object> request) {
        try {
            return prediction.score(request);
        } catch (PredictionFailedException first) {
            return prediction.score(request);
        }
    }

    private AssessmentRow baseRow(String requestId, UserAccount user, String baseMonth, int age, String modelVersion, LocalDateTime now) {
        AssessmentRow row = new AssessmentRow();
        row.setRequestId(requestId);
        row.setUserId(user.getUserId());
        row.setWorkerTypeCode(user.getWorkerTypeCode());
        row.setAgeBandCode(ageBandCode(age));
        row.setInputBaseMonth(baseMonth);
        row.setModelVersion(modelVersion);
        row.setAssessedAt(now);
        return row;
    }

    // 평가 시점 연령대 (DDL CK_ASM_AGE_BAND). 가입이 20세 이상이라 20 미만은 없다.
    static String ageBandCode(int age) {
        if (age < 30) {
            return "20S";
        }
        if (age < 40) {
            return "30S";
        }
        if (age < 50) {
            return "40S";
        }
        return "50_PLUS";
    }

    // 산출 불가 행 — 두 점수 모두 'N', 점수·등급·확률 NULL (DDL CK_ASM_TRAD_VALUES·CK_ASM_ALT_VALUES).
    private static AssessmentRow notScorable(AssessmentRow row, String reason) {
        row.setGradeStatusCode(NOT_SCORABLE);
        row.setNotScorableReasonCode(reason);
        row.setTradScorableYn("N");
        row.setAltScorableYn("N");
        return row;
    }

    @SuppressWarnings("unchecked")
    private AssessmentRow scored(AssessmentRow row, Map<String, Object> result) {
        Map<String, Object> trad = (Map<String, Object>) result.get("traditional");
        Map<String, Object> alt = (Map<String, Object>) result.get("alternative");
        Map<String, Object> shap = (Map<String, Object>) result.get("shap");
        row.setModelVersion((String) result.get("modelVersion"));
        row.setFeatureSetVersion((String) result.get("featureSetVersion"));
        row.setCutoffVersion((String) result.get("cutoffVersion"));
        row.setGradeStatusCode(SCORED);
        row.setTradScorableYn((String) trad.get("scorableYn"));
        if ("Y".equals(row.getTradScorableYn())) {
            row.setTradScore(toInt(trad.get("score")));
            row.setTradGradeBandCode((String) trad.get("gradeBandCode"));
            row.setTradDefaultProb(toDecimal(trad.get("defaultProb")));
        }
        row.setAltScorableYn("Y");
        row.setAltScore(toInt(alt.get("score")));
        row.setAltGradeBandCode((String) alt.get("gradeBandCode"));
        row.setAltDefaultProb(toDecimal(alt.get("defaultProb")));
        row.setShapBaseScore(toInt(shap.get("baseScore")));
        row.setFeatureSnapshot(toJson(result.get("featureSnapshot")));
        return row;
    }

    @SuppressWarnings("unchecked")
    private static List<FactorRow> factors(Map<String, Object> result) {
        String featureSetVersion = (String) result.get("featureSetVersion");
        List<Map<String, Object>> items = (List<Map<String, Object>>) ((Map<String, Object>) result.get("shap")).get("factors");
        return items.stream().map(item -> {
            FactorRow factor = new FactorRow();
            factor.setFeatureSetVersion(featureSetVersion);
            factor.setFeatureRank(toInt(item.get("rank")));
            factor.setFeatureCode((String) item.get("featureCode"));
            factor.setFeatureValue((String) item.get("featureValue"));
            factor.setShapValue(toDecimal(item.get("shapValue")));
            factor.setShapScore(toInt(item.get("shapScore")));
            return factor;
        }).toList();
    }

    // 평가 1행 + 요인 여러 행. 메서드 전체가 한 트랜잭션이라 중간에 실패하면 모두 되돌아간다.
    private ScoreDtos.ScoreResponse save(AssessmentRow row, List<FactorRow> factors) {
        try {
            mapper.insertAssessment(row);
        } catch (DuplicateKeyException e) {
            // 동시에 같은 requestId가 들어온 경우 — 먼저 저장된 결과를 돌려준다(DDL B3 UK_ASM_REQUEST_ID).
            return sameRequest(mapper.selectByRequestId(row.getRequestId()), row.getUserId());
        }
        for (FactorRow factor : factors) {
            factor.setAssessmentId(row.getAssessmentId());
            mapper.insertFactor(factor);
        }
        log.info("assessment saved requestId={} status={} reason={}", row.getRequestId(), row.getGradeStatusCode(),
                row.getNotScorableReasonCode());
        return toResponse(row);
    }

    ScoreDtos.ScoreResponse toResponse(AssessmentRow row) {
        boolean scored = SCORED.equals(row.getGradeStatusCode());
        ScoreDtos.AlternativeResult alternative = scored ? new ScoreDtos.AlternativeResult(row.getAltScore(), row.getAltGradeBandCode()) : null;
        ScoreDtos.TraditionalResult traditional = new ScoreDtos.TraditionalResult(row.getTradScorableYn(), row.getTradScore(),
                row.getTradGradeBandCode());
        return new ScoreDtos.ScoreResponse(users.toOffset(row.getAssessedAt()), row.getRequestId(), row.getGradeStatusCode(),
                row.getNotScorableReasonCode(), alternative, traditional);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new PredictionFailedException("featureSnapshot");
        }
    }

    private static Integer toInt(Object value) {
        return value == null ? null : ((Number) value).intValue();
    }

    private static BigDecimal toDecimal(Object value) {
        return value == null ? null : new BigDecimal(value.toString());
    }
}
