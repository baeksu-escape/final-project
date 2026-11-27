package com.baeksuescape.notification.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.notification.dto.NotificationItemResponse;
import com.baeksuescape.notification.dto.NotificationListResponse;
import com.baeksuescape.notification.service.NotificationService;
import com.baeksuescape.user.mapper.UserAccountMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.mock;

/** FP-284·D-23 알림 API의 인증 회원 식별과 응답 계약을 확인한다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationControllerTest {
    private static final String PATH = "/api/members/me/notifications";

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtTokenProvider tokenProvider;
    @MockBean private NotificationService notificationService;
    @MockBean private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUp() {
        org.mockito.BDDMockito.given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    @Test
    @DisplayName("로그인 회원 토큰의 ID로 목록을 조회하고 계약 필드를 반환한다")
    void list_contract() throws Exception {
        given(notificationService.list(7L)).willReturn(new NotificationListResponse(2,
                List.of(new NotificationItemResponse(31, "WELCOME", "환영", "시작해 보세요", "/home", false,
                        LocalDateTime.of(2026, 11, 27, 10, 0)))));
        mockMvc.perform(get(PATH).header(HttpHeaders.AUTHORIZATION, bearer(7, "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(2))
                .andExpect(jsonPath("$.items[0].notificationId").value(31))
                .andExpect(jsonPath("$.items[0].typeCode").value("WELCOME"))
                .andExpect(jsonPath("$.items[0].read").value(false))
                .andExpect(jsonPath("$.items[0].linkUrl").value("/home"));
        verify(notificationService).list(7L);
    }

    @Test
    @DisplayName("본인 읽음 API는 200을 반환한다")
    void markRead_contract() throws Exception {
        mockMvc.perform(patch(PATH + "/31/read").header(HttpHeaders.AUTHORIZATION, bearer(7, "ROLE_USER")))
                .andExpect(status().isOk());
        verify(notificationService).markRead(7L, 31L);
    }

    @Test
    @DisplayName("전체 읽음 API는 처리 건수를 반환한다")
    void markAllRead_contract() throws Exception {
        given(notificationService.markAllRead(7L)).willReturn(3);
        mockMvc.perform(patch(PATH + "/read-all").header(HttpHeaders.AUTHORIZATION, bearer(7, "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.updatedCount").value(3));
    }

    @Test
    @DisplayName("토큰이 없으면 401이고 알림 서비스를 부르지 않는다")
    void noToken_unauthorized() throws Exception {
        mockMvc.perform(get(PATH)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("관리자는 회원 알림 API에서 403이다")
    void admin_forbidden() throws Exception {
        mockMvc.perform(get(PATH).header(HttpHeaders.AUTHORIZATION, bearer(1, "ROLE_ADMIN")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verifyNoInteractions(notificationService);
    }

    private String bearer(long userId, String role) {
        return "Bearer " + tokenProvider.issue(userId, role);
    }
}