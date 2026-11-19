package com.baeksuescape.loan.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;
import com.baeksuescape.loan.dto.LoanDtos;
import com.baeksuescape.loan.service.LoanFavoriteService;

// N-37-3 대출 상품 즐겨찾기 API (API 정의서 2-7 LOAN-03~05). /api/members/me/** 라 USER 권한이고, 대상은 토큰의 회원이다.
@RestController
@RequestMapping("/api/members/me/favorite-loan-products")
public class LoanFavoriteController {

    private final LoanFavoriteService loanFavoriteService;

    public LoanFavoriteController(LoanFavoriteService loanFavoriteService) {
        this.loanFavoriteService = loanFavoriteService;
    }

    // LOAN-03 N-04-5 내 즐겨찾기 상품 코드 목록 { items: ["LP001", ...] }
    @GetMapping
    public LoanDtos.FavoriteList list(@AuthenticationPrincipal AuthUser user) {
        return loanFavoriteService.list(user.userId());
    }

    // LOAN-04 N-37-3 즐겨찾기 추가 (이미 있어도 200, 본문 {})
    @PutMapping("/{productCode}")
    public Map<String, Object> add(@AuthenticationPrincipal AuthUser user, @PathVariable String productCode) {
        loanFavoriteService.add(user.userId(), productCode);
        return Map.of();
    }

    // LOAN-05 N-37-3 즐겨찾기 해제 (없어도 200, 본문 {})
    @DeleteMapping("/{productCode}")
    public Map<String, Object> remove(@AuthenticationPrincipal AuthUser user, @PathVariable String productCode) {
        loanFavoriteService.remove(user.userId(), productCode);
        return Map.of();
    }
}
