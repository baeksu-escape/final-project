package com.baeksuescape.notification.advice;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import com.baeksuescape.global.exception.ErrorResponse;
import com.baeksuescape.global.exception.GlobalExceptionHandler;
import com.baeksuescape.notification.controller.NotificationController;

import jakarta.servlet.http.HttpServletRequest;

/** FP-284·D-23 알림 스트림 연결 종료 예외만 먼저 처리하고, 다른 알림 API 오류는 공통 처리기에 맡긴다. */
@RestControllerAdvice(assignableTypes = NotificationController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class NotificationDisconnectExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(NotificationDisconnectExceptionHandler.class);
    private static final String STREAM_PATH = "/api/members/me/notifications/stream";

    private final GlobalExceptionHandler globalExceptionHandler;

    public NotificationDisconnectExceptionHandler(GlobalExceptionHandler globalExceptionHandler) {
        this.globalExceptionHandler = globalExceptionHandler;
    }

    // FP-284·D-23 끊긴 스트림에는 오류 응답을 쓰지 않고, 스트림 밖 오류는 기존 공통 JSON 처리로 전달한다.
    @ExceptionHandler({AsyncRequestNotUsableException.class, IOException.class})
    public Object handleDisconnect(Exception exception, HttpServletRequest request) {
        if (!request.getRequestURI().endsWith(STREAM_PATH)) {
            return globalExceptionHandler.handleUnexpected(exception, request);
        }
        log.debug("알림 SSE 연결이 종료되어 응답 작성을 중단합니다.");
        return null;
    }
}