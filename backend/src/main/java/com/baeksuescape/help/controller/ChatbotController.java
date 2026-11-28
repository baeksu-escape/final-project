package com.baeksuescape.help.controller;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.dto.ChatbotQuestionRequest;
import com.baeksuescape.help.dto.ChatbotQuestionResponse;
import com.baeksuescape.help.service.ChatbotService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * N-32 금융 용어 검색·질문 챗봇(용어 도우미) REST 컨트롤러 (FP-181). 로그인한 사용자만 부른다(보안 설정: 그 밖의 /api/** = 로그인 필요).
 */
@RestController
@RequestMapping("/api/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService chatbotService;

    /** N-32-1 HELP-02 질문 버튼 4개와 등록된 답, 오늘 남은 자유 질문 횟수 — 창을 열 때 한 번 받아 두면 된다. 횟수 차감 없음. */
    @GetMapping("/presets")
    public ResponseEntity<ChatbotPresetResponse> getPresets(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(chatbotService.findPresets(user.userId()));
    }

    /** N-32-2 HELP-03 자유 질문(하루 10회). 질문 글만 AI에 넘기고 저장하지 않는다. */
    @PostMapping("/questions")
    public ResponseEntity<ChatbotQuestionResponse> ask(@AuthenticationPrincipal AuthUser user,
            @Valid @RequestBody ChatbotQuestionRequest request) {
        return ResponseEntity.ok(chatbotService.ask(user.userId(), request.question()));
    }
}
