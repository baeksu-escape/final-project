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

// FP-87 JWT 인증 필터 — Authorization: Bearer 토큰이 유효하고 계정이 사용 중(탈퇴·잠금이 아님)이면 로그인한 사용자로 표시한다.
// 토큰이 없거나 틀려도 여기서 막지 않는다. 로그인이 필요한 경로라면 뒤에서 401이 된다.
// FP-80 잠긴 계정(LOCKED)도 탈퇴 계정처럼 기존 토큰을 쓰지 못한다(일반 회원·관리자 같음). 이때 401 code는 ACCOUNT_LOCKED다.
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";
    static final String WITHDRAWN = "WITHDRAWN";
    static final String LOCKED = "LOCKED";
    // 잠긴 계정의 토큰이었음을 남기는 요청 속성. JsonErrorWriter가 읽어 401 code를 ACCOUNT_LOCKED로 바꾼다.
    static final String ACCOUNT_LOCKED_ATTRIBUTE = JwtAuthenticationFilter.class.getName() + ".ACCOUNT_LOCKED";

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
                    .filter(user -> isUsable(request, user))
                    .ifPresent(user -> SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority(user.role())))));
        }
        chain.doFilter(request, response);
    }

    // 요청마다 APP_USER의 계정 상태를 확인한다. 계정이 없거나 탈퇴·잠금 상태면 토큰이 있어도 쓰지 않는다.
    // 잠금이면 요청 속성을 남겨 401 응답에서 잠긴 계정임을 알린다.
    private boolean isUsable(HttpServletRequest request, AuthUser user) {
        String status = userAccountMapper.selectAccountStatus(user.userId());
        if (LOCKED.equals(status)) {
            request.setAttribute(ACCOUNT_LOCKED_ATTRIBUTE, Boolean.TRUE);
            return false;
        }
        return status != null && !WITHDRAWN.equals(status);
    }
}
