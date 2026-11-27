package com.baeksuescape.chat.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.chat.dto.ChatDtos;
import com.baeksuescape.chat.service.ChatService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-287 N-07 채팅 API 계약 — 경로·권한·상태 코드·JSON 키가 API 정의서 CHAT-01~09와 같은지 본다.
// 서비스는 mock으로 대신하고, 보안 필터·입력 검증·오류 처리는 실제로 탄다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChatApiContractTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private ChatService chatService;
    // /api/admin/** 인터셉터가 '비밀번호 변경 필요' 여부를 이 매퍼로 본다. mock 기본값(null)이라 통과한다.
    @MockBean
    private AdminAccountMapper adminAccountMapper;

    private static final LocalDateTime AT = LocalDateTime.of(2026, 11, 28, 10, 0);

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"));
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN"));
    }

    // ---- 권한 ----

    @Test
    void 로그인하지_않으면_401() throws Exception {
        mvc.perform(get("/api/members/me/chat/messages")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/chat/rooms")).andExpect(status().isUnauthorized());
        verifyNoInteractions(chatService);
    }

    @Test
    void 회원과_관리자는_서로의_채팅_API를_부를_수_없다() throws Exception {
        mvc.perform(asUser(get("/api/admin/chat/rooms"))).andExpect(status().isForbidden());
        mvc.perform(asAdmin(get("/api/members/me/chat/messages"))).andExpect(status().isForbidden());
        verifyNoInteractions(chatService);
    }

    @Test
    void 잠긴_계정은_대화를_읽을_수_없다() throws Exception {
        given(userAccountMapper.selectAccountStatus(7L)).willReturn("LOCKED");

        mvc.perform(asUser(get("/api/members/me/chat/messages"))).andExpect(status().isUnauthorized());
        verifyNoInteractions(chatService);
    }

    // ---- CHAT-01~04 회원 ----

    @Test
    void 내_대화는_토큰의_회원_번호로_조회한다() throws Exception {
        given(chatService.myMessages(7L, 5L, null)).willReturn(new ChatDtos.MessagePage(3L,
                List.of(new ChatDtos.Message(6L, "ADMIN", "답변", AT)), false));

        mvc.perform(asUser(get("/api/members/me/chat/messages").param("afterId", "5")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value(3))
                .andExpect(jsonPath("$.messages[0].messageId").value(6))
                .andExpect(jsonPath("$.messages[0].senderType").value("ADMIN"))
                .andExpect(jsonPath("$.messages[0].content").value("답변"))
                .andExpect(jsonPath("$.messages[0].createdAt").exists())
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void 메시지_보내기() throws Exception {
        given(chatService.sendAsUser(7L, "문의")).willReturn(new ChatDtos.Message(6L, "USER", "문의", AT));

        mvc.perform(asUser(json(post("/api/members/me/chat/messages"), "{\"content\":\"문의\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageId").value(6));
    }

    @Test
    void 빈_메시지와_500자_초과는_400() throws Exception {
        mvc.perform(asUser(json(post("/api/members/me/chat/messages"), "{\"content\":\"   \"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("content"));
        mvc.perform(asUser(json(post("/api/members/me/chat/messages"), "{\"content\":\"" + "가".repeat(501) + "\"}")))
                .andExpect(status().isBadRequest());
        mvc.perform(asUser(json(post("/api/members/me/chat/read"), "{}"))).andExpect(status().isBadRequest());
        verifyNoInteractions(chatService);
    }

    @Test
    void 읽음_처리와_안_읽은_수() throws Exception {
        given(chatService.userUnreadCount(7L)).willReturn(new ChatDtos.UnreadCount(2));

        mvc.perform(asUser(json(post("/api/members/me/chat/read"), "{\"lastMessageId\":6}"))).andExpect(status().isOk());
        verify(chatService).markReadAsUser(7L, 6L);
        mvc.perform(asUser(get("/api/members/me/chat/unread-count")))
                .andExpect(jsonPath("$.unreadCount").value(2));
    }

    // ---- CHAT-05~09 관리자 ----

    @Test
    void 문의_목록() throws Exception {
        given(chatService.rooms(1, 20)).willReturn(new ChatDtos.RoomPage(
                List.of(new ChatDtos.RoomSummary(3L, "닉네임", "마지막 글", AT, 1)), 1, 20, 1));

        mvc.perform(asAdmin(get("/api/admin/chat/rooms")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].roomId").value(3))
                .andExpect(jsonPath("$.items[0].nickname").value("닉네임"))
                .andExpect(jsonPath("$.items[0].lastMessage").value("마지막 글"))
                .andExpect(jsonPath("$.items[0].unreadCount").value(1))
                .andExpect(jsonPath("$.totalCount").value(1));
    }

    @Test
    void 답장과_읽음_처리() throws Exception {
        given(chatService.sendAsAdmin(1L, 3L, "답변")).willReturn(new ChatDtos.Message(8L, "ADMIN", "답변", AT));
        given(chatService.adminUnreadCount()).willReturn(new ChatDtos.UnreadCount(4));

        mvc.perform(asAdmin(json(post("/api/admin/chat/rooms/3/messages"), "{\"content\":\"답변\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageId").value(8));
        mvc.perform(asAdmin(json(post("/api/admin/chat/rooms/3/read"), "{\"lastMessageId\":8}"))).andExpect(status().isOk());
        verify(chatService).markReadAsAdmin(3L, 8L);
        mvc.perform(asAdmin(get("/api/admin/chat/unread-count"))).andExpect(jsonPath("$.unreadCount").value(4));
    }

    @Test
    void 없는_문의는_404() throws Exception {
        willThrow(new ApiException(HttpStatus.NOT_FOUND, "CHAT_ROOM_NOT_FOUND", "문의를 찾을 수 없습니다."))
                .given(chatService).roomMessages(99L, null, null);

        mvc.perform(asAdmin(get("/api/admin/chat/rooms/99/messages")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CHAT_ROOM_NOT_FOUND"));
    }
}
