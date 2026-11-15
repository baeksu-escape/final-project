package com.baeksuescape.admin.mapper;

import java.time.LocalDateTime;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.admin.dto.AppSettingRow;

// FP-191 서비스 설정(APP_SETTING, DDL v0.3.2) 읽기·쓰기.
@Mapper
public interface AppSettingMapper {

    // 설정 한 개. 없으면 null
    AppSettingRow selectByKey(@Param("settingKey") String settingKey);

    // 값과 바꾼 관리자·시각을 저장한다. 키가 없으면 0
    int updateValue(@Param("settingKey") String settingKey, @Param("settingValue") String settingValue, @Param("updatedBy") long updatedBy,
            @Param("now") LocalDateTime now);
}
