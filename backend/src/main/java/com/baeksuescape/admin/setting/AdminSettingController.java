package com.baeksuescape.admin.setting;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.global.security.AuthUser;

import jakarta.validation.Valid;

// FP-191 ADM-14 설정 조회·변경 (API 정의서 v0.2). /api/admin/**라 관리자(ROLE_ADMIN)만 부른다.
// 지금 화면에서 바꿀 수 있는 설정은 신고 자동 숨김 기준(N-34-1) 하나다.
@RestController
@RequestMapping("/api/admin/settings")
public class AdminSettingController {

    private final AppSettingService settingService;

    public AdminSettingController(AppSettingService settingService) {
        this.settingService = settingService;
    }

    @GetMapping
    public SettingDtos.SettingList list() {
        return settingService.list();
    }

    @PutMapping
    public SettingDtos.SettingView update(@AuthenticationPrincipal AuthUser admin, @Valid @RequestBody SettingDtos.SettingUpdate request) {
        return settingService.update(admin.userId(), request);
    }
}
