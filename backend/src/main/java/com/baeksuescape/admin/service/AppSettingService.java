package com.baeksuescape.admin.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.dto.AppSettingRow;
import com.baeksuescape.admin.dto.SettingDtos;
import com.baeksuescape.admin.mapper.AppSettingMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;
import com.baeksuescape.global.exception.GlobalExceptionHandler;

// FP-191 ADM-14 서비스 설정 — 관리자가 바꿀 수 있는 설정(EditableSettings)을 보여 주고 바꾼다. 다른 서비스는 intValue로 설정값을 읽는다.
@Service
public class AppSettingService {

    private final AppSettingMapper settingMapper;
    private final Clock clock;

    public AppSettingService(AppSettingMapper settingMapper, Clock clock) {
        this.settingMapper = settingMapper;
        this.clock = clock;
    }

    // 바꿀 수 있는 설정 전체(DB에 없는 키는 뺀다)
    public SettingDtos.SettingList list() {
        List<SettingDtos.SettingView> views = EditableSettings.RULES.stream()
                .map(this::view)
                .filter(view -> view != null)
                .toList();
        return new SettingDtos.SettingList(views);
    }

    // 설정 하나를 바꾼다. 목록에 없는 키는 400 UNKNOWN_SETTING, 범위 밖 값은 400 INVALID_INPUT
    @Transactional
    public SettingDtos.SettingView update(long adminUserId, SettingDtos.SettingUpdate request) {
        EditableSettings.Rule rule = EditableSettings.find(request.settingKey());
        if (rule == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNKNOWN_SETTING", "바꿀 수 없는 설정입니다.");
        }
        int value = request.value();
        if (value < rule.min() || value > rule.max()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GlobalExceptionHandler.INVALID_INPUT, "입력값을 확인해 주세요.",
                    List.of(new FieldErrorItem("value", rule.min() + "~" + rule.max() + " 사이로 입력해 주세요.")));
        }
        if (settingMapper.updateValue(rule.settingKey(), String.valueOf(value), adminUserId, LocalDateTime.now(clock)) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "SETTING_NOT_FOUND", "설정을 찾을 수 없습니다.");
        }
        return view(rule);
    }

    // 정수 설정값을 읽는다. 행이 없거나 숫자가 아니면 기본값을 쓴다.
    public int intValue(String settingKey, int defaultValue) {
        return parse(settingMapper.selectByKey(settingKey), defaultValue);
    }

    private SettingDtos.SettingView view(EditableSettings.Rule rule) {
        AppSettingRow row = settingMapper.selectByKey(rule.settingKey());
        if (row == null) return null;
        return new SettingDtos.SettingView(rule.settingKey(), parse(row, rule.defaultValue()), row.getDescription(), rule.min(), rule.max());
    }

    private static int parse(AppSettingRow row, int defaultValue) {
        if (row == null || row.getSettingValue() == null) return defaultValue;
        try {
            return Integer.parseInt(row.getSettingValue().trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
