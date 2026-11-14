package com.baeksuescape.global.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.baeksuescape.global.exception.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// FP-87 보안 필터 단계의 401·403을 공통 오류 모양 JSON으로 보낸다. 401 → UNAUTHORIZED(로그인 필요·토큰 만료·탈퇴 회원), 403 → FORBIDDEN(역할이 다름).
@Component
public class JsonErrorWriter implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public JsonErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e) throws IOException {
        write(response, HttpServletResponse.SC_UNAUTHORIZED, ErrorResponse.of("UNAUTHORIZED", "로그인이 필요합니다."));
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException e) throws IOException {
        write(response, HttpServletResponse.SC_FORBIDDEN, ErrorResponse.of("FORBIDDEN", "접근 권한이 없습니다."));
    }

    private void write(HttpServletResponse response, int status, ErrorResponse body) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
