package com.baeksuescape.notification.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.notification.service.NotificationService;
import com.baeksuescape.notification.service.NotificationStreamService;
import com.baeksuescape.user.mapper.UserAccountMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** FP-284·D-23 알림 SSE 스트림 API가 로그인 회원의 연결을 text/event-stream으로 여는지 확인한다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationStreamControllerTest {
    private static final String PATH = "/api/members/me/notifications/stream";

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider tokenProvider;
    @MockBean private NotificationService notificationService;
    @MockBean private NotificationStreamService streamService;
    @MockBean private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUp() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    @Test
    @DisplayName("로그인 회원 토큰으로 스트림을 열면 text/event-stream으로 응답하고 그 회원의 연결을 등록한다")
    void stream_opensEventStream() throws Exception {
        SseEmitter emitter = new SseEmitter();
        emitter.send(SseEmitter.event().name("connected").data("ok"));
        given(streamService.register(7L)).willReturn(emitter);

        mockMvc.perform(get(PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7, "ROLE_USER"))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM));
        verify(streamService).register(7L);
    }

    @Test
    @DisplayName("토큰이 없으면 401, 관리자는 403이고 연결을 만들지 않는다")
    void stream_requiresUserRole() throws Exception {
        mockMvc.perform(get(PATH).accept(MediaType.TEXT_EVENT_STREAM)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1, "ROLE_ADMIN"))
                .accept(MediaType.TEXT_EVENT_STREAM)).andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(streamService);
    }
}
