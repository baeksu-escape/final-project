package com.baeksuescape.global.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.baeksuescape.global.config.AvenueProperties;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-87 보안 설정 — 세션 없이 JWT로만 인증한다(N-01). 경로별 권한:
//   인증 없음: 로그인·가입·이메일 인증·아이디 찾기·비밀번호 재설정·소셜 로그인·관리자 2단계 인증, 다른 팀 임시 개방 경로(avenue.auth.temporary-open-paths)
//   /api/admin/** = ROLE_ADMIN, /api/members/me/**·/api/report/** = ROLE_USER, 그 밖의 /api/** = 로그인 필요
@Configuration
public class SecurityConfig {

    // 인증 없이 부르는 인증 API(POST). 경로는 프론트 authApi.js·authFeatureApi.js·socialLoginConfig.js와 API 정의서 v0.2 AUTH-01~11 기준.
    static final String[] PUBLIC_AUTH_POST_PATHS = {
            "/api/auth/login",
            "/api/auth/signup",
            "/api/auth/email/**",
            "/api/auth/find-id",
            "/api/auth/password/reset",
            "/api/auth/social/**",
            "/api/auth/admin/verify-code",
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AvenueProperties properties, JwtTokenProvider tokenProvider,
            UserAccountMapper userAccountMapper, JsonErrorWriter jsonErrorWriter) throws Exception {
        String[] temporaryOpenPaths = properties.getAuth().getTemporaryOpenPaths().toArray(String[]::new);
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(handling -> handling.authenticationEntryPoint(jsonErrorWriter).accessDeniedHandler(jsonErrorWriter))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    auth.requestMatchers(HttpMethod.POST, PUBLIC_AUTH_POST_PATHS).permitAll();
                    if (temporaryOpenPaths.length > 0) auth.requestMatchers(temporaryOpenPaths).permitAll();
                    auth.requestMatchers("/api/admin/**").hasRole("ADMIN");
                    auth.requestMatchers("/api/members/me/**", "/api/report/**").hasRole("USER");
                    auth.requestMatchers("/api/**").authenticated();
                    // API가 아닌 경로(오류 화면, 소셜 로그인 시작 주소 등)는 막지 않는다.
                    auth.anyRequest().permitAll();
                })
                .addFilterBefore(new JwtAuthenticationFilter(tokenProvider, userAccountMapper), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    // CORS: avenue.cors.allowed-origins에서 온 요청만 허용한다. 토큰은 Authorization 헤더로 보내므로 쿠키(credentials)는 쓰지 않는다.
    @Bean
    public CorsConfigurationSource corsConfigurationSource(AvenueProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(properties.getCors().getAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    // JWT만 쓰므로 Spring Boot 기본 사용자(임시 비밀번호를 로그에 찍는 계정)를 만들지 않는다. 로그인 확인은 작업 2의 로그인 서비스가 한다.
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("JWT 인증만 사용합니다");
        };
    }

    // 비밀번호 해시. 더미 시드의 시연 계정 해시($2a$, cost 10)와 호환된다.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
