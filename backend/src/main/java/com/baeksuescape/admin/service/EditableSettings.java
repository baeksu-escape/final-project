package com.baeksuescape.admin.service;

import java.util.List;

// FP-191 ADM-14 관리자가 화면에서 바꿀 수 있는 설정(APP_SETTING) 목록. 여기에 없는 키는 조회·변경 API로 다룰 수 없다.
// 다른 기능의 설정을 화면에서 바꾸게 하려면 RULES에 한 줄(키, 최솟값, 최댓값)을 추가한다. 값은 모두 정수다.
public final class EditableSettings {

    private EditableSettings() {
    }

    // 설정 키 하나와 허용 범위(양 끝 포함), DB 값을 못 읽을 때 서버가 실제로 쓰는 기본값
    public record Rule(String settingKey, int min, int max, int defaultValue) {
    }

    // N-33-2·N-34-1 신고 자동 숨김 기준(건), 관리자가 3~10건으로 바꾼다(D-10)
    public static final String REPORT_AUTO_HIDE_COUNT = "REPORT_AUTO_HIDE_COUNT";
    // N-33-1 하루 신고 횟수. 서버가 읽기만 하고 화면에서는 바꾸지 않아 RULES에 없다.
    public static final String REPORT_DAILY_LIMIT = "REPORT_DAILY_LIMIT";

    public static final List<Rule> RULES = List.of(
            new Rule(REPORT_AUTO_HIDE_COUNT, 3, 10, 5));

    // 키로 규칙을 찾는다. 바꿀 수 없는 키면 null
    public static Rule find(String settingKey) {
        return RULES.stream().filter(rule -> rule.settingKey().equals(settingKey)).findFirst().orElse(null);
    }
}
