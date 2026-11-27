package com.baeksuescape.chat.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.chat.dto.ChatDtos;
import com.baeksuescape.chat.service.ChatService;
import com.baeksuescape.global.security.AuthUser;

import jakarta.validation.Valid;

// FP-287 N-07 회원의 1:1 문의 API(CHAT-01~04). 일반 회원만 부르고, 방은 토큰의 USER_ID로 정해져 남의 대화는 볼 수 없다.
@RestController
@RequestMapping("/api/members/me/chat")
public class MemberChatController {

    private final ChatService chatService;

    public MemberChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    // CHAT-01 N-07-2 내 대화 보기. afterId: 그 뒤의 새 메시지, beforeId: 그 앞의 이전 메시지
    @GetMapping("/messages")
    public ChatDtos.MessagePage messages(@AuthenticationPrincipal AuthUser user,
            @RequestParam(required = false) Long afterId, @RequestParam(required = false) Long beforeId) {
        return chatService.myMessages(user.userId(), afterId, beforeId);
    }

    // CHAT-02 N-07-1 문의 보내기
    @PostMapping("/messages")
    public ChatDtos.Message send(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ChatDtos.MessageWrite request) {
        return chatService.sendAsUser(user.userId(), request.content());
    }

    // CHAT-03 N-07-5 읽음 처리
    @PostMapping("/read")
    public Map<String, Object> read(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ChatDtos.ReadMark request) {
        chatService.markReadAsUser(user.userId(), request.lastMessageId());
        return Map.of();
    }

    // CHAT-04 N-07-5 안 읽은 답장 수
    @GetMapping("/unread-count")
    public ChatDtos.UnreadCount unreadCount(@AuthenticationPrincipal AuthUser user) {
        return chatService.userUnreadCount(user.userId());
    }
}
