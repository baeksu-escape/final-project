package com.baeksuescape.notification.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.notification.dto.NotificationRow;

/** FP-284·D-23 회원 알림의 최신 목록, 읽음 상태, 생성 기록을 다룬다. */
@Mapper
public interface NotificationMapper {
    List<NotificationRow> selectLatest(@Param("userId") long userId, @Param("limit") int limit);
    long countUnread(@Param("userId") long userId);
    NotificationRow selectOwned(@Param("userId") long userId, @Param("notificationId") long notificationId);
    int markRead(@Param("userId") long userId, @Param("notificationId") long notificationId,
            @Param("now") LocalDateTime now);
    int markAllRead(@Param("userId") long userId, @Param("now") LocalDateTime now);
    int insert(NotificationRow row);
}