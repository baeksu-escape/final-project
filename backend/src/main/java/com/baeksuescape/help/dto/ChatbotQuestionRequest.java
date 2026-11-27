package com.baeksuescape.help.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * N-32-2 HELP-03 자유 질문 요청. 이 글만 AI에 넘긴다(D-21). DB와 로그에는 저장하지 않는다.
 */
public record ChatbotQuestionRequest(
        @NotBlank(message = "질문을 입력해 주세요.") @Size(max = 200, message = "질문은 200자까지 쓸 수 있습니다.") String question) {
}
