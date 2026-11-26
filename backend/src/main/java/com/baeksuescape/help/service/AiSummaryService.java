package com.baeksuescape.help.service;

import com.baeksuescape.assessment.dto.ReportDtos;
import com.baeksuescape.assessment.service.ReportService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.help.client.OpenAiClient;
import com.baeksuescape.help.dto.AiSummaryResponse;
import com.baeksuescape.help.mapper.AiSummaryMapper;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * N-31-2 RPT-04 AI 요약 생성·저장 (FP-181).
 * 평가 조회와 본인 확인은 범영 님 ReportService.byRequestId(RPT-03)를 그대로 쓴다(형식 오류 400, 남의 평가·없는 평가 404).
 * AI에는 점수·등급·점수 차이·영향 요인 이름과 작용한 정도(점수 단위)만 넘긴다. 피처 원래 값(featureValue)과 개인정보는 넘기지 않는다(AGENTS 5장).
 * 만든 요약은 ASSESSMENT.AI_SUMMARY에 저장하고, 다음부터는 AI를 부르지 않고 저장된 요약을 돌려준다.
 */
@Service
@RequiredArgsConstructor
public class AiSummaryService {

    // ASSESSMENT.GRADE_STATUS_CODE 산출 완료 값(ScoreCalculationService.SCORED와 같음, 그쪽은 패키지 안에서만 보여 따로 둔다)
    static final String SCORED = "SCORED";
    // ASSESSMENT.AI_SUMMARY VARCHAR2(1000 CHAR)
    static final int MAX_SUMMARY_LENGTH = 1000;
    static final int SUMMARY_MAX_TOKENS = 300;
    // 영향 요인은 상위 3개만 넘긴다(화면 N-14 상위 요인과 같은 순위)
    static final int TOP_FACTOR_COUNT = 3;

    static final String SYSTEM_PROMPT = String.join("\n",
            "너는 신용 평가 결과를 금융 초보자에게 쉽게 풀어 주는 도우미다.",
            "받은 숫자만 사용해 한국어 3문장 이내로 요약한다. 받지 않은 숫자나 사실을 지어내지 않는다.",
            "영향 요인은 점수에 '작용한 정도'로만 말하고, 그 요인 때문에 점수가 바뀌었다는 식의 원인 표현은 쓰지 않는다.",
            "대출 상품 추천이나 투자 권유는 하지 않는다.",
            "마지막 문장에 시연용 계산이라 실제 대출 심사 결과가 아니라는 점을 짧게 밝힌다.");

    // 등급 코드 → 화면과 같은 한글 이름(frontend common/config/grades.js GRADE_LABELS)
    private static final Map<String, String> GRADE_LABELS = Map.of("GOOD", "좋음", "STANDARD", "보통", "CAUTION", "주의");

    private final ReportService reportService;
    private final AiSummaryMapper aiSummaryMapper;
    private final OpenAiClient openAiClient;

    /**
     * 요약이 저장돼 있으면 그대로(generated false), 없으면 만들어 저장한 뒤 돌려준다(generated true).
     * 오류: 산출되지 않은 평가 409 NOT_SCORED, 키 없음 503 AI_UNAVAILABLE, AI 실패 502 AI_FAILED(저장 안 함).
     */
    public AiSummaryResponse summarize(long userId, String requestId) {
        ReportDtos.Report report = reportService.byRequestId(userId, requestId);
        if (StringUtils.hasText(report.aiSummary())) {
            return new AiSummaryResponse(requestId, report.aiSummary(), false);
        }
        if (!SCORED.equals(report.gradeStatusCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_SCORED", "점수가 산출된 평가만 요약할 수 있습니다.");
        }
        String summary = truncate(openAiClient.complete(SYSTEM_PROMPT, prompt(report), SUMMARY_MAX_TOKENS));
        if (aiSummaryMapper.updateAiSummaryIfEmpty(userId, requestId, summary) == 0) {
            // 다른 요청이 먼저 저장했다 — 저장된 요약을 돌려줘 화면마다 문장이 달라지지 않게 한다
            String saved = aiSummaryMapper.selectAiSummary(userId, requestId);
            if (StringUtils.hasText(saved)) {
                return new AiSummaryResponse(requestId, saved, false);
            }
        }
        return new AiSummaryResponse(requestId, summary, true);
    }

    /** AI에 넘길 글. 계산된 숫자와 라벨만 담는다(테스트에서 featureValue가 없는지 확인한다). */
    static String prompt(ReportDtos.Report report) {
        StringBuilder text = new StringBuilder();
        text.append("기존 신용 점수: ").append(score(report.traditional())).append('\n');
        text.append("대안 신용 점수(생활 데이터 포함): ").append(score(report.alternative())).append('\n');
        ReportDtos.Comparison comparison = report.comparison();
        if (comparison != null && comparison.scoreDiff() != null) {
            text.append("대안 − 기존 점수 차이: ").append(signed(comparison.scoreDiff())).append("점, 등급 바뀜: ")
                    .append(Boolean.TRUE.equals(comparison.gradeChanged()) ? "예" : "아니오").append('\n');
        }
        List<ReportDtos.Factor> factors = report.shap() == null || report.shap().factors() == null ? List.of()
                : report.shap().factors().stream()
                        .filter(factor -> factor.shapScore() != null && factor.featureName() != null)
                        .sorted(Comparator.comparing(ReportDtos.Factor::rank, Comparator.nullsLast(Comparator.naturalOrder())))
                        .limit(TOP_FACTOR_COUNT)
                        .toList();
        if (!factors.isEmpty()) {
            text.append("대안 점수에 크게 작용한 항목(점수 단위, +는 올리는 쪽 −는 내리는 쪽):\n");
            for (ReportDtos.Factor factor : factors) {
                text.append("- ").append(factor.featureName()).append(": ").append(signed(factor.shapScore())).append("점\n");
            }
        }
        return text.toString().trim();
    }

    private static String score(ReportDtos.ModelScore model) {
        if (model == null || !"Y".equals(model.scorableYn()) || model.score() == null) {
            return "산정 불가";
        }
        String grade = GRADE_LABELS.get(Objects.requireNonNullElse(model.gradeBandCode(), ""));
        return model.score() + "점" + (grade == null ? "" : " (등급 " + grade + ")");
    }

    private static String signed(int value) {
        return value > 0 ? "+" + value : value < 0 ? "−" + Math.abs(value) : "0";
    }

    private static String truncate(String summary) {
        return summary.length() <= MAX_SUMMARY_LENGTH ? summary : summary.substring(0, MAX_SUMMARY_LENGTH);
    }
}
