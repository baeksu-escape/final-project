package com.baeksuescape.global.security;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.baeksuescape.user.mapper.UserAccountMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// FP-87 JWT 인증 필터 — Authorization: Bearer 토큰이 유효하고 계정이 탈퇴 상태가 아니면 로그인한 사용자로 표시한다.
// 토큰이 없거나 틀려도 여기서 막지 않는다. 로그인이 필요한 경로라면 뒤에서 401이 된다. 잠긴 계정(LOCKED)은 로그인만 막고 여기서는 통과한다.
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";
    static final String WITHDRAWN = "WITHDRAWN";

    private final JwtTokenProvider tokenProvider;
    private final UserAccountMapper userAccountMapper;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, UserAccountMapper userAccountMapper) {
        this.tokenProvider = tokenProvider;
        this.userAccountMapper = userAccountMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)) {
            tokenProvider.parse(header.substring(BEARER.length()).trim())
                    .filter(this::isUsable)
                    .ifPresent(user -> SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority(user.role())))));
        }
        chain.doFilter(request, response);
    }

    // 요청마다 APP_USER의 계정 상태를 확인한다. 탈퇴했거나 계정이 없으면 토큰이 있어도 쓰지 않는다.
    private boolean isUsable(AuthUser user) {
        String status = userAccountMapper.selectAccountStatus(user.userId());
        return status != null && !WITHDRAWN.equals(status);
    }
}
