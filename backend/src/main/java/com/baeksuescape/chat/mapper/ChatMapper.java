package com.baeksuescape.chat.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.chat.dto.ChatMessageRow;
import com.baeksuescape.chat.dto.ChatRoomRow;
import com.baeksuescape.chat.dto.ChatRoomSummaryRow;

// FP-287 N-07 1:1 채팅(CHAT_ROOM, CHAT_MESSAGE).
@Mapper
public interface ChatMapper {

    // 회원의 채팅방. 아직 없으면 null
    ChatRoomRow selectRoomByUserId(@Param("userId") long userId);

    // 방 번호로 찾는다. 없으면 null
    ChatRoomRow selectRoom(@Param("roomId") long roomId);

    // 방 저장. 저장하면 row.roomId에 새 번호가 채워진다. 회원당 하나라 이미 있으면 DuplicateKeyException
    int insertRoom(ChatRoomRow row);

    // 마지막 메시지 시각을 바꾼다. 트랜잭션이 끝날 때까지 이 방 행이 잠겨 같은 방의 저장이 차례대로 이뤄진다.
    int touchRoom(@Param("roomId") long roomId, @Param("now") LocalDateTime now);

    // 메시지 저장. 저장하면 row.messageId에 새 번호가 채워진다.
    int insertMessage(ChatMessageRow row);

    // afterId보다 새 메시지를 오래된 것부터 limit개
    List<ChatMessageRow> selectMessagesAfter(@Param("roomId") long roomId, @Param("afterId") long afterId, @Param("limit") int limit);

    // beforeId보다 이전(null이면 전체) 메시지를 최신 것부터 limit개
    List<ChatMessageRow> selectMessagesBefore(@Param("roomId") long roomId, @Param("beforeId") Long beforeId, @Param("limit") int limit);

    // 회원이 읽은 위치. 이 방에 있는 번호까지만, 앞으로만 옮긴다.
    int updateUserRead(@Param("roomId") long roomId, @Param("lastMessageId") long lastMessageId);

    // 관리자들이 함께 쓰는 읽은 위치. 규칙은 updateUserRead와 같다.
    int updateAdminRead(@Param("roomId") long roomId, @Param("lastMessageId") long lastMessageId);

    // 회원이 아직 읽지 않은 관리자 메시지 수
    int countUserUnread(@Param("userId") long userId);

    // 관리자가 아직 읽지 않은 회원 메시지 수(모든 방)
    int countAdminUnread();

    int countRooms();

    // N-07-3 문의 목록: 마지막 메시지가 최근인 방부터
    List<ChatRoomSummaryRow> selectRooms(@Param("offset") int offset, @Param("limit") int limit);
}
