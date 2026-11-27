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
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.service.AuthErrors;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// FP-87 보안 필터 단계의 401·403을 공통 오류 모양 JSON으로 보낸다. 401 → UNAUTHORIZED(로그인 필요·토큰 만료·탈퇴 회원), 403 → FORBIDDEN(역할이 다름).
// FP-80 잠긴 계정의 토큰이면 401 code를 ACCOUNT_LOCKED로 보낸다(문구는 로그인 423과 같다).
// FP-258 관리자 토큰이면 401 ADMIN_ACCOUNT_LOCKED와 관리자 안내다(관리자는 비밀번호 찾기로 풀 수 없다). 프론트는 두 code 모두 다른 401처럼 로그아웃시킨다.
@Component
public class JsonErrorWriter implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public JsonErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e) throws IOException {
        if (Boolean.TRUE.equals(request.getAttribute(JwtAuthenticationFilter.ACCOUNT_LOCKED_ATTRIBUTE))) {
            ErrorResponse body = UserAccount.ROLE_ADMIN.equals(request.getAttribute(JwtAuthenticationFilter.LOCKED_ROLE_ATTRIBUTE))
                    ? ErrorResponse.of("ADMIN_ACCOUNT_LOCKED", AuthErrors.ADMIN_ACCOUNT_LOCKED_MESSAGE)
                    : ErrorResponse.of("ACCOUNT_LOCKED", AuthErrors.ACCOUNT_LOCKED_MESSAGE);
            write(response, HttpServletResponse.SC_UNAUTHORIZED, body);
            return;
        }
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
