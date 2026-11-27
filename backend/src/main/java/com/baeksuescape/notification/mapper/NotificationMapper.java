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
    // FP-300·D-23 조건별 최신 목록을 조회하며 limit에는 hasMore 확인을 위한 추가 한 건이 포함된다.
    List<NotificationRow> selectFiltered(@Param("userId") long userId, @Param("unreadOnly") boolean unreadOnly,
            @Param("typeCode") String typeCode, @Param("before") Long before, @Param("limit") int limit);
    long countUnread(@Param("userId") long userId);
    NotificationRow selectOwned(@Param("userId") long userId, @Param("notificationId") long notificationId);
    int markRead(@Param("userId") long userId, @Param("notificationId") long notificationId,
            @Param("now") LocalDateTime now);
    int markAllRead(@Param("userId") long userId, @Param("now") LocalDateTime now);
    int insert(NotificationRow row);
}