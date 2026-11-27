package com.baeksuescape.chat.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.chat.dto.ChatDtos;
import com.baeksuescape.chat.service.ChatService;
import com.baeksuescape.global.security.AuthUser;

import jakarta.validation.Valid;

// FP-287 N-07 관리자의 1:1 문의 API(CHAT-05~09). /api/admin/** 규칙으로 관리자만 부른다.
@RestController
@RequestMapping("/api/admin/chat")
public class AdminChatController {

    private final ChatService chatService;

    public AdminChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    // CHAT-05 N-07-3 문의 목록(page는 1부터, 기본 20개, 최근 메시지 순)
    @GetMapping("/rooms")
    public ChatDtos.RoomPage rooms(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size) {
        return chatService.rooms(page, size);
    }

    // CHAT-06 N-07-2 한 문의의 대화 보기
    @GetMapping("/rooms/{roomId}/messages")
    public ChatDtos.MessagePage messages(@PathVariable long roomId,
            @RequestParam(required = false) Long afterId, @RequestParam(required = false) Long beforeId) {
        return chatService.roomMessages(roomId, afterId, beforeId);
    }

    // CHAT-07 N-07-4 답장
    @PostMapping("/rooms/{roomId}/messages")
    public ChatDtos.Message send(@AuthenticationPrincipal AuthUser admin, @PathVariable long roomId,
            @Valid @RequestBody ChatDtos.MessageWrite request) {
        return chatService.sendAsAdmin(admin.userId(), roomId, request.content());
    }

    // CHAT-08 N-07-5 읽음 처리
    @PostMapping("/rooms/{roomId}/read")
    public Map<String, Object> read(@PathVariable long roomId, @Valid @RequestBody ChatDtos.ReadMark request) {
        chatService.markReadAsAdmin(roomId, request.lastMessageId());
        return Map.of();
    }

    // CHAT-09 N-07-5 안 읽은 문의 메시지 수
    @GetMapping("/unread-count")
    public ChatDtos.UnreadCount unreadCount() {
        return chatService.adminUnreadCount();
    }
}
