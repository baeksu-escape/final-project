package com.baeksuescape.admin.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.admin.dto.AdminDtos;
import com.baeksuescape.admin.service.AdminAccountService;
import com.baeksuescape.admin.service.AdminMemberService;
import com.baeksuescape.global.security.AuthUser;

import jakarta.servlet.http.HttpServletRequest;

// FP-80 N-27 계정·권한 관리(ADM-05·06·07)와 N-35 회원 정보 열람(ADM-08). 모두 ROLE_ADMIN + ACCESS 토큰.
@RestController
@RequestMapping("/api/admin")
public class AdminAccountController {

    private final AdminAccountService accounts;
    private final AdminMemberService members;

    public AdminAccountController(AdminAccountService accounts, AdminMemberService members) {
        this.accounts = accounts;
        this.members = members;
    }

    // ADM-05 N-27-1 계정 목록·검색 → { items, page, size, totalCount }. FP-273 직군 조건 workerType(선택) 추가.
    @GetMapping("/users")
    public AdminDtos.PageResponse<AdminDtos.UserRow> users(@RequestParam(required = false) String q, @RequestParam(required = false) String role,
            @RequestParam(required = false) String status, @RequestParam(required = false) String workerType,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return accounts.list(q, role, status, workerType, page, size);
    }

    // ADM-06 N-27-3 잠금·해제 { locked, reason } → 바뀐 행
    @PatchMapping("/users/{userId}/lock")
    public AdminDtos.UserRow lock(@AuthenticationPrincipal AuthUser admin, @PathVariable long userId,
            @RequestBody(required = false) AdminDtos.LockRequest request) {
        return accounts.lock(admin.userId(), userId, request);
    }

    // ADM-07 N-27-4 관리자 추가 { loginId, name, workEmail } + X-Step-Up-Token → { userId, loginId, temporaryPassword }
    @PostMapping("/admins")
    public AdminDtos.TemporaryPassword addAdmin(@AuthenticationPrincipal AuthUser admin, @RequestBody(required = false) AdminDtos.NewAdmin request,
            @RequestHeader(value = AdminMeController.STEP_UP_HEADER, required = false) String stepUpToken) {
        return accounts.addAdmin(admin.userId(), request, stepUpToken);
    }

    // 🟡 임시 비밀번호 재발급 + X-Step-Up-Token → { userId, loginId, temporaryPassword }
    @PostMapping("/admins/{userId}/temporary-password")
    public AdminDtos.TemporaryPassword temporaryPassword(@AuthenticationPrincipal AuthUser admin, @PathVariable long userId,
            @RequestHeader(value = AdminMeController.STEP_UP_HEADER, required = false) String stepUpToken) {
        return accounts.reissueTemporaryPassword(admin.userId(), userId, stepUpToken);
    }

    // ADM-08 N-35 열람 사유 { reason } → 감사 로그 저장 후 회원 상세(가린 값)
    @PostMapping("/users/{userId}/credit-data")
    public AdminDtos.CreditData creditData(@AuthenticationPrincipal AuthUser admin, @PathVariable long userId,
            @RequestBody(required = false) AdminDtos.CreditDataRequest request, HttpServletRequest httpRequest) {
        return members.creditData(admin.userId(), userId, request, httpRequest.getRemoteAddr());
    }
}
