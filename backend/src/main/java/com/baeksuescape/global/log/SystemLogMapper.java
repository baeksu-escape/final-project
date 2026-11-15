package com.baeksuescape.global.log;

import java.time.LocalDateTime;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// FP-80 N-28-1 시스템 로그 1건 저장(SYSTEM_LOG). SQL은 resources/mapper/admin/SystemLogMapper.xml. 수정·삭제 문은 두지 않는다(DDL W6).
@Mapper
public interface SystemLogMapper {

    int insertLog(@Param("type") String type, @Param("source") String source, @Param("message") String message,
            @Param("actorUserId") Long actorUserId, @Param("now") LocalDateTime now);
}
