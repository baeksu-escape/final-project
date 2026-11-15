package com.baeksuescape.admin.controller;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.baeksuescape.admin.mapper.AdminAccountMapper;

// FP-80 관리자 API에만 거는 MVC 설정 — 비밀번호 변경이 필요한 관리자를 /api/admin/**에서 막는다.
@Configuration
public class AdminWebConfig implements WebMvcConfigurer {

    private final AdminAccountMapper adminMapper;

    public AdminWebConfig(AdminAccountMapper adminMapper) {
        this.adminMapper = adminMapper;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new PasswordChangeRequiredInterceptor(adminMapper)).addPathPatterns("/api/admin/**");
    }
}
