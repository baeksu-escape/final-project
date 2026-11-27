package com.baeksuescape.chat.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.chat.dto.ChatDtos;
import com.baeksuescape.chat.dto.ChatMessageRow;
import com.baeksuescape.chat.dto.ChatMessageSavedEvent;
import com.baeksuescape.chat.dto.ChatRoomRow;
import com.baeksuescape.chat.mapper.ChatMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-287 N-07 1:1 채팅 — 회원당 방 하나이고 글자만 주고받는다. 어느 관리자든 답장할 수 있고 읽은 위치는 관리자끼리 함께 쓴다.
// 메시지 본문에는 개인정보가 섞일 수 있어 로그에 남기지 않는다.
@Service
public class ChatService {

    public static final String SENDER_USER = "USER";
    public static final String SENDER_ADMIN = "ADMIN";
    static final String WITHDRAWN = "WITHDRAWN";
    // 한 번에 주는 메시지 수
    static final int MESSAGE_PAGE_SIZE = 50;
    public static final int DEFAULT_ROOM_PAGE_SIZE = 20;
    static final int MAX_ROOM_PAGE_SIZE = 50;

    private final ChatMapper chatMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    public ChatService(ChatMapper chatMapper, ApplicationEventPublisher eventPublisher, Clock clock) {
        this.chatMapper = chatMapper;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
    }

    // N-07-2 회원의 대화 보기. 문의한 적이 없으면 방 번호 없이 빈 목록
    public ChatDtos.MessagePage myMessages(long userId, Long afterId, Long beforeId) {
        ChatRoomRow room = chatMapper.selectRoomByUserId(userId);
        if (room == null) return new ChatDtos.MessagePage(null, List.of(), false);
        return page(room.getRoomId(), afterId, beforeId);
    }

    // N-07-1 회원이 문의를 보낸다. 첫 메시지면 방을 만든다.
    @Transactional
    public ChatDtos.Message sendAsUser(long userId, String content) {
        LocalDateTime now = LocalDateTime.now(clock);
        ChatRoomRow room = chatMapper.selectRoomByUserId(userId);
        long roomId = room != null ? room.getRoomId() : createRoom(userId, now);
        return save(roomId, userId, userId, SENDER_USER, content, now);
    }

    // N-07-5 회원이 화면에 보인 곳까지 읽음 처리
    @Transactional
    public void markReadAsUser(long userId, long lastMessageId) {
        ChatRoomRow room = chatMapper.selectRoomByUserId(userId);
        if (room != null) chatMapper.updateUserRead(room.getRoomId(), lastMessageId);
    }

    // N-07-5 회원의 안 읽은 답장 수
    public ChatDtos.UnreadCount userUnreadCount(long userId) {
        return new ChatDtos.UnreadCount(chatMapper.countUserUnread(userId));
    }

    // N-07-3 관리자 문의 목록 한 쪽(최근 메시지 순)
    public ChatDtos.RoomPage rooms(int page, int size) {
        int safePage = Math.max(page, 1);
        int safeSize = size < 1 ? DEFAULT_ROOM_PAGE_SIZE : Math.min(size, MAX_ROOM_PAGE_SIZE);
        List<ChatDtos.RoomSummary> items = chatMapper.selectRooms((safePage - 1) * safeSize, safeSize).stream()
                .map(row -> new ChatDtos.RoomSummary(row.getRoomId(), row.getNickname(), row.getLastMessage(),
                        row.getLastMessageAt(), row.getUnreadCount()))
                .toList();
        return new ChatDtos.RoomPage(items, safePage, safeSize, chatMapper.countRooms());
    }

    // N-07-2 관리자가 한 방의 대화 보기
    public ChatDtos.MessagePage roomMessages(long roomId, Long afterId, Long beforeId) {
        requireRoom(roomId);
        return page(roomId, afterId, beforeId);
    }

    // N-07-4 관리자 답장. 탈퇴한 회원에게는 보낼 수 없다.
    @Transactional
    public ChatDtos.Message sendAsAdmin(long adminUserId, long roomId, String content) {
        ChatRoomRow room = requireRoom(roomId);
        if (WITHDRAWN.equals(room.getOwnerStatusCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_WITHDRAWN", "탈퇴한 회원에게는 답장할 수 없습니다.");
        }
        return save(roomId, room.getUserId(), adminUserId, SENDER_ADMIN, content, LocalDateTime.now(clock));
    }

    // N-07-5 관리자 읽음 처리
    @Transactional
    public void markReadAsAdmin(long roomId, long lastMessageId) {
        requireRoom(roomId);
        chatMapper.updateAdminRead(roomId, lastMessageId);
    }

    // N-07-5 관리자의 안 읽은 문의 메시지 수
    public ChatDtos.UnreadCount adminUnreadCount() {
        return new ChatDtos.UnreadCount(chatMapper.countAdminUnread());
    }

    // 방을 만든다. 같은 회원의 첫 메시지가 동시에 들어와 다른 요청이 먼저 만들었으면 그 방을 쓴다.
    private long createRoom(long userId, LocalDateTime now) {
        ChatRoomRow row = new ChatRoomRow();
        row.setUserId(userId);
        row.setCreatedAt(now);
        try {
            chatMapper.insertRoom(row);
            return row.getRoomId();
        } catch (DuplicateKeyException e) {
            return chatMapper.selectRoomByUserId(userId).getRoomId();
        }
    }

    // 방 행을 먼저 고쳐 잠근 뒤 메시지를 넣는다. 같은 방의 메시지 번호가 차례대로 커밋돼 afterId 조회에서 빠지지 않는다.
    private ChatDtos.Message save(long roomId, long ownerUserId, long senderUserId, String senderType, String content,
            LocalDateTime now) {
        chatMapper.touchRoom(roomId, now);
        ChatMessageRow row = new ChatMessageRow();
        row.setRoomId(roomId);
        row.setSenderUserId(senderUserId);
        row.setSenderTypeCode(senderType);
        row.setContent(content.strip());
        row.setCreatedAt(now);
        chatMapper.insertMessage(row);
        eventPublisher.publishEvent(new ChatMessageSavedEvent(roomId, ownerUserId));
        return toMessage(row);
    }

    // afterId가 있으면 그 뒤의 새 메시지, 없으면 최신(beforeId가 있으면 그 앞) 메시지를 오래된 것부터 준다.
    // 한 개를 더 읽어 남은 메시지가 있는지 확인한다.
    private ChatDtos.MessagePage page(long roomId, Long afterId, Long beforeId) {
        List<ChatMessageRow> rows = afterId != null
                ? chatMapper.selectMessagesAfter(roomId, afterId, MESSAGE_PAGE_SIZE + 1)
                : chatMapper.selectMessagesBefore(roomId, beforeId, MESSAGE_PAGE_SIZE + 1);
        boolean hasMore = rows.size() > MESSAGE_PAGE_SIZE;
        List<ChatMessageRow> kept = new ArrayList<>(hasMore ? rows.subList(0, MESSAGE_PAGE_SIZE) : rows);
        if (afterId == null) Collections.reverse(kept);
        return new ChatDtos.MessagePage(roomId, kept.stream().map(ChatService::toMessage).toList(), hasMore);
    }

    private ChatRoomRow requireRoom(long roomId) {
        ChatRoomRow room = chatMapper.selectRoom(roomId);
        if (room == null) throw new ApiException(HttpStatus.NOT_FOUND, "CHAT_ROOM_NOT_FOUND", "문의를 찾을 수 없습니다.");
        return room;
    }

    private static ChatDtos.Message toMessage(ChatMessageRow row) {
        return new ChatDtos.Message(row.getMessageId(), row.getSenderTypeCode(), row.getContent(), row.getCreatedAt());
    }
}
