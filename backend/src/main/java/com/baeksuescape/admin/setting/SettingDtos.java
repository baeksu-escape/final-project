package com.baeksuescape.admin.setting;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

// FP-191 ADM-14 설정 조회·변경 요청·응답. min·max는 화면 입력 칸의 범위로 쓴다.
public final class SettingDtos {

    private SettingDtos() {
    }

    public record SettingView(String settingKey, int value, String description, int min, int max) {
    }

    public record SettingList(List<SettingView> settings) {
    }

    public record SettingUpdate(
            @NotBlank(message = "설정을 골라 주세요.") String settingKey,
            @NotNull(message = "값을 입력해 주세요.") Integer value) {
    }
}
