package com.baeksuescape.assessment.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.assessment.dto.GroupComparisonDtos.GroupComparisonResponse;
import com.baeksuescape.assessment.service.GroupComparisonService;
import com.baeksuescape.global.security.AuthUser;

/**
 * FP-164 N-26-5~7 사용자 비교 분석(ADM-04). 내 위치가 들어 있어 Q-8 규칙대로 /api/members/me/** 아래에 둔다(DIAG-01 peer-benchmark와 같음).
 * 로그인 확인은 보안 설정이 먼저 한다(ROLE_USER만, 토큰 없음 401·관리자 403). 회원은 토큰에서만 꺼낸다. 조회만 있다.
 */
@RestController
@RequestMapping("/api/members/me")
public class GroupComparisonController {

    private final GroupComparisonService service;

    public GroupComparisonController(GroupComparisonService service) {
        this.service = service;
    }

    @GetMapping("/group-comparison")
    public GroupComparisonResponse groupComparison(@AuthenticationPrincipal AuthUser user) {
        return service.compare(user.userId());
    }
}
