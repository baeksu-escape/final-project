package com.baeksuescape.admin.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;

import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.AuthUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// FP-80 /api/admin/** — 비밀번호를 바꿔야 하는 관리자(PASSWORD_CHANGE_REQUIRED_YN='Y')는 403 PASSWORD_CHANGE_REQUIRED.
// 보통은 ACCESS 토큰 자체를 받지 못한다. 다른 관리자가 임시 비밀번호를 다시 발급해 이미 받은 토큰이 남아 있는 경우를 막는다.
public class PasswordChangeRequiredInterceptor implements HandlerInterceptor {

    static final String CODE = "PASSWORD_CHANGE_REQUIRED";

    private final AdminAccountMapper adminMapper;

    public PasswordChangeRequiredInterceptor(AdminAccountMapper adminMapper) {
        this.adminMapper = adminMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthUser user
                && "Y".equals(adminMapper.selectPasswordChangeRequired(user.userId()))) {
            throw new ApiException(HttpStatus.FORBIDDEN, CODE, "비밀번호를 바꾼 뒤 다시 로그인해 주세요.");
        }
        return true;
    }
}
