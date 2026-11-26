package com.baeksuescape.help.service;

import com.baeksuescape.admin.service.AppSettingService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.help.client.OpenAiClient;
import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.dto.ChatbotPresetResponse.Preset;
import com.baeksuescape.help.dto.ChatbotQuestionResponse;
import com.baeksuescape.help.mapper.ChatbotMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * N-32 용어 도우미(챗봇) 서비스 (FP-181).
 * N-32-1 질문 버튼은 등록된 답을 보여 줄 뿐이라 AI를 부르지 않고 횟수를 줄이지 않는다.
 * N-32-2 자유 질문은 사용자가 쓴 질문 글만 OpenAI에 넘기고(D-21), 하루 횟수(APP_SETTING CHATBOT_DAILY_LIMIT, 기본 10)에서 성공한 호출만 뺀다.
 */
@Service
@RequiredArgsConstructor
public class ChatbotService {

    public static final String CHATBOT_DAILY_LIMIT = "CHATBOT_DAILY_LIMIT";
    public static final int DEFAULT_DAILY_LIMIT = 10;
    // 답 길이 상한(토큰) — 3~5문장이면 충분하고 비용도 막는다
    static final int ANSWER_MAX_TOKENS = 400;

    static final String SYSTEM_PROMPT = String.join("\n",
            "너는 금융 초보자를 돕는 '용어 도우미'다.",
            "사용자가 묻는 금융 용어나 금융 개념을 쉬운 한국어 3~5문장으로 설명한다. 어려운 말은 풀어서 쓰고 예를 하나 들어도 된다.",
            "개인 재무 상담, 특정 상품 추천, 투자 권유는 하지 않는다. 그런 질문이면 일반적인 뜻만 설명하고 전문가와 상의하라고 안내한다.",
            "금융과 관계없는 질문이면 금융 용어만 설명할 수 있다고 짧게 답한다.",
            "모르는 내용은 지어내지 말고 모른다고 말한다.",
            "화면에 글자 그대로 보이므로 굵게(**), 제목(#), 목록 기호 같은 마크다운을 쓰지 않고 평범한 문장으로만 쓴다.");

    private final ChatbotMapper chatbotMapper;
    private final OpenAiClient openAiClient;
    private final AppSettingService settings;
    private final Clock clock;

    /** N-32-1 질문 버튼 전체(표시 순서대로)와 오늘 남은 자유 질문 횟수 */
    public ChatbotPresetResponse findPresets(long userId) {
        int dailyLimit = dailyLimit();
        int used = chatbotMapper.countSuccessSince(userId, startOfToday());
        return new ChatbotPresetResponse(chatbotMapper.selectPresets().stream()
                .map(row -> new Preset(row.getPresetId(), row.getQuestionText(), row.getAnswerText()))
                .toList(), Math.max(0, dailyLimit - used), dailyLimit);
    }

    /**
     * N-32-2 HELP-03 자유 질문. 오류: 키 없음 503 AI_UNAVAILABLE(기록 없음), 오늘 횟수를 다 씀 429 DAILY_LIMIT_EXCEEDED,
     * AI 실패 502 AI_FAILED(실패로 기록하고 횟수는 줄지 않음).
     */
    public ChatbotQuestionResponse ask(long userId, String question) {
        if (!openAiClient.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, OpenAiClient.AI_UNAVAILABLE, "AI 기능이 아직 준비되지 않았습니다.");
        }
        int dailyLimit = dailyLimit();
        LocalDateTime now = LocalDateTime.now(clock);
        int used = chatbotMapper.countSuccessSince(userId, now.toLocalDate().atStartOfDay());
        if (used >= dailyLimit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "DAILY_LIMIT_EXCEEDED",
                    "자유 질문은 하루 " + dailyLimit + "번까지 할 수 있습니다. 내일 다시 이용해 주세요.");
        }
        String answer;
        try {
            answer = openAiClient.complete(SYSTEM_PROMPT, question.trim(), ANSWER_MAX_TOKENS);
        } catch (ApiException e) {
            if (OpenAiClient.AI_FAILED.equals(e.getCode())) {
                chatbotMapper.insertQuestionLog(userId, now, "N");
            }
            throw e;
        }
        chatbotMapper.insertQuestionLog(userId, now, "Y");
        return new ChatbotQuestionResponse(answer, Math.max(0, dailyLimit - (used + 1)), dailyLimit);
    }

    private int dailyLimit() {
        return settings.intValue(CHATBOT_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
    }

    private LocalDateTime startOfToday() {
        return LocalDate.now(clock).atStartOfDay();
    }
}
