package com.baeksuescape.help.dto;

/**
 * N-32-2 HELP-03 자유 질문 응답 — AI 답, 오늘 남은 질문 횟수, 하루 횟수(APP_SETTING CHATBOT_DAILY_LIMIT).
 */
public record ChatbotQuestionResponse(String answer, int remainingCount, int dailyLimit) {
}
