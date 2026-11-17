package com.baeksuescape.admin.dto;

import lombok.Getter;
import lombok.Setter;

// FP-191 APP_SETTING 한 행(설정 키·값·설명). 값은 문자열로 저장돼 있다.
@Getter
@Setter
public class AppSettingRow {

    private String settingKey;
    private String settingValue;
    private String description;
}
