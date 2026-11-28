package com.baeksuescape.notification.advice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.verifyNoInteractions;

import java.io.IOException;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockAsyncContext;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.core.MethodParameter;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import jakarta.servlet.AsyncEvent;

import com.baeksuescape.global.exception.GlobalExceptionHandler;
import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.notification.controller.NotificationController;
import com.baeksuescape.notification.service.NotificationService;
import com.baeksuescape.notification.service.NotificationStreamService;

class NotificationDisconnectExceptionHandlerTest {
    private final GlobalExceptionHandler globalHandler = mock(GlobalExceptionHandler.class);
    private final NotificationDisconnectExceptionHandler handler = new NotificationDisconnectExceptionHandler(globalHandler);

    @Test
    @DisplayName("끊긴 알림 스트림 예외는 응답을 쓰지 않고 종료한다")
    void streamDisconnect_doesNotWriteResponse() {
        MockHttpServletRequest request = request("/api/members/me/notifications/stream");
        MockHttpServletResponse response = new MockHttpServletResponse();

        Object result = handler.handleDisconnect(new AsyncRequestNotUsableException("connection closed"), request);

        assertThat(result).isNull();
        assertThat(response.getContentAsByteArray()).isEmpty();
        assertThat(response.getContentType()).isNull();
        verifyNoInteractions(globalHandler);
    }

    // D-23 FP-284 연결 중단 응답 처리 중에도 스트림 전용 예외 처리가 적용되는지 확인한다.
    @Test
    @DisplayName("MVC 예외 처리에서도 끊긴 스트림에 본문을 쓰지 않는다")
    void streamDisconnect_throughMvcLeavesResponseEmpty() throws Exception {
        NotificationStreamService streamService = mock(NotificationStreamService.class);
        org.mockito.BDDMockito.given(streamService.register(7L, null)).willAnswer(invocation -> {
            throw new AsyncRequestNotUsableException("connection closed");
        });
        mockMvc(streamService).perform(get("/api/members/me/notifications/stream").header(HttpHeaders.AUTHORIZATION, "Bearer token"))
                .andExpect(content().string(""));
        verifyNoInteractions(globalHandler);
    }

    // D-23 컨테이너의 정상 타임아웃을 실행하면 기존 SSE 응답이 오류 없이 닫혀야 한다.
    @Test
    void streamTimeout_throughMvcCompletesNormally() throws Exception {
        NotificationStreamService streamService = new NotificationStreamService();
        MockMvc mockMvc = mockMvc(streamService);
        var opened = mockMvc.perform(get("/api/members/me/notifications/stream")
                .header(HttpHeaders.AUTHORIZATION, "Bearer token")).andReturn();
        MockAsyncContext context = (MockAsyncContext) opened.getRequest().getAsyncContext();
        for (var listener : context.getListeners()) {
            listener.onTimeout(new AsyncEvent(context, opened.getRequest(), opened.getResponse()));
        }

        assertThat(opened.getAsyncResult(1000)).isNull();
        mockMvc.perform(asyncDispatch(opened))
                .andExpect(status().isOk())
                .andExpect(content().string("event:connected\ndata:ok\n\n"));
        verifyNoInteractions(globalHandler);
    }

    // D-23 스트림 종료 시험에서는 인증 주체만 고정하고 MVC의 비동기 응답 처리를 그대로 사용한다.
    private MockMvc mockMvc(NotificationStreamService streamService) {
        NotificationController controller = new NotificationController(mock(NotificationService.class), streamService,
                mock(JwtTokenProvider.class));
        return MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(handler)
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    @Override public boolean supportsParameter(MethodParameter parameter) {
                        return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
                    }
                    @Override public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                            NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                        return new AuthUser(7L, "ROLE_USER");
                    }
                }).build();

    }
    @Test
    @DisplayName("스트림 경로의 연결 중단 IOException도 응답을 쓰지 않는다")
    void streamIOException_doesNotWriteResponse() {
        Object result = handler.handleDisconnect(new IOException("client disconnected"),
                request("/api/members/me/notifications/stream"));
        assertThat(result).isNull();
        verifyNoInteractions(globalHandler);
    }

    @Test
    @DisplayName("일반 알림 경로 예외는 공통 처리기에 넘긴다")
    void notificationApiError_delegatesToGlobalHandler() {
        handler.handleDisconnect(new IOException("io failure"), request("/api/members/me/notifications"));
        org.mockito.Mockito.verify(globalHandler).handleUnexpected(org.mockito.ArgumentMatchers.any(IOException.class),
                org.mockito.ArgumentMatchers.any());
    }

    private MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(path);
        return request;
    }
}
