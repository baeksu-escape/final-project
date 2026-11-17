package com.baeksuescape.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.admin.dto.AppSettingRow;
import com.baeksuescape.admin.dto.SettingDtos;
import com.baeksuescape.admin.mapper.AppSettingMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-191 ADM-14 설정 — 허용 목록에 있는 키만, 정해진 범위 안에서만 바꾼다(신고 자동 숨김 기준 3~10건, N-34-1).
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AppSettingServiceTest {

    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-15T01:00:00Z"), ZoneId.of("Asia/Seoul"));

    @Mock
    private AppSettingMapper settingMapper;

    private AppSettingService service;

    @BeforeEach
    void setUp() {
        service = new AppSettingService(settingMapper, CLOCK);
        given(settingMapper.selectByKey("REPORT_AUTO_HIDE_COUNT")).willReturn(row("REPORT_AUTO_HIDE_COUNT", "5"));
        given(settingMapper.updateValue(anyString(), anyString(), anyLong(), any())).willReturn(1);
    }

    private static AppSettingRow row(String key, String value) {
        AppSettingRow row = new AppSettingRow();
        row.setSettingKey(key);
        row.setSettingValue(value);
        row.setDescription("신고 자동 숨김 기준 건수 (3~10)");
        return row;
    }

    @Test
    void 조회는_화면에서_바꿀_수_있는_설정만_준다() {
        SettingDtos.SettingList list = service.list();

        assertThat(list.settings()).hasSize(1);
        SettingDtos.SettingView view = list.settings().get(0);
        assertThat(view.settingKey()).isEqualTo("REPORT_AUTO_HIDE_COUNT");
        assertThat(view.value()).isEqualTo(5);
        assertThat(view.min()).isEqualTo(3);
        assertThat(view.max()).isEqualTo(10);
    }

    @Test
    void 신고_자동_숨김_기준은_3에서_10건_사이로만_바꿀_수_있다() {
        for (int bad : new int[] { 2, 11 }) {
            assertThatThrownBy(() -> service.update(1L, new SettingDtos.SettingUpdate("REPORT_AUTO_HIDE_COUNT", bad)))
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.getStatus().value()).isEqualTo(400);
                        assertThat(e.getCode()).isEqualTo("INVALID_INPUT");
                        assertThat(e.getFieldErrors().get(0).field()).isEqualTo("value");
                    });
        }

        service.update(1L, new SettingDtos.SettingUpdate("REPORT_AUTO_HIDE_COUNT", 7));
        verify(settingMapper).updateValue("REPORT_AUTO_HIDE_COUNT", "7", 1L, LocalDateTime.of(2026, 11, 15, 10, 0));
    }

    @Test
    void 허용_목록에_없는_설정은_바꿀_수_없다() {
        assertThatThrownBy(() -> service.update(1L, new SettingDtos.SettingUpdate("CHATBOT_DAILY_LIMIT", 5)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("UNKNOWN_SETTING"));
        assertThatThrownBy(() -> service.update(1L, new SettingDtos.SettingUpdate("REPORT_DAILY_LIMIT", 5)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("UNKNOWN_SETTING"));
        verify(settingMapper, never()).updateValue(anyString(), anyString(), anyLong(), any());
    }

    @Test
    void 값이_없거나_숫자가_아니면_기본값을_쓴다() {
        given(settingMapper.selectByKey("REPORT_DAILY_LIMIT")).willReturn(row("REPORT_DAILY_LIMIT", "세 번"));
        assertThat(service.intValue("REPORT_DAILY_LIMIT", 3)).isEqualTo(3);
        assertThat(service.intValue("NO_SUCH_KEY", 4)).isEqualTo(4);
        assertThat(service.intValue("REPORT_AUTO_HIDE_COUNT", 9)).isEqualTo(5);
    }

    @Test
    void 화면_조회도_값을_못_읽으면_서버가_실제로_쓰는_기본값_5를_보여_준다() {
        given(settingMapper.selectByKey("REPORT_AUTO_HIDE_COUNT")).willReturn(row("REPORT_AUTO_HIDE_COUNT", "다섯"));
        assertThat(service.list().settings().get(0).value()).isEqualTo(5);
    }
}
