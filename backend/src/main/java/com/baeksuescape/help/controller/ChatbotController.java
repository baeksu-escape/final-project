package com.baeksuescape.help.controller;

import com.baeksuescape.help.dto.ChatbotPresetResponse;
import com.baeksuescape.help.service.ChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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

    /** N-32-1 HELP-02 질문 버튼 4개와 등록된 답 조회 — 누를 때마다 다시 부를 필요 없이 한 번 받아 두면 된다. 횟수 차감 없음. */
    @GetMapping("/presets")
    public ResponseEntity<ChatbotPresetResponse> getPresets() {
        return ResponseEntity.ok(chatbotService.findPresets());
    }
}
