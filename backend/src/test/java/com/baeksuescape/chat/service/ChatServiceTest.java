package com.baeksuescape.chat.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.LongStream;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;

import com.baeksuescape.chat.dto.ChatDtos;
import com.baeksuescape.chat.dto.ChatMessageRow;
import com.baeksuescape.chat.dto.ChatMessageSavedEvent;
import com.baeksuescape.chat.dto.ChatRoomRow;
import com.baeksuescape.chat.mapper.ChatMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-287 N-07 채팅 규칙 — 첫 메시지의 방 생성, 저장 순서, 메시지 묶음 나누기, 관리자 답장 제한.
class ChatServiceTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-28T01:00:00Z"), SEOUL);
    private static final LocalDateTime NOW = LocalDateTime.now(CLOCK);

    private final ChatMapper mapper = mock(ChatMapper.class);
    private final ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
    private final ChatService service = new ChatService(mapper, publisher, CLOCK);

    private static ChatRoomRow room(long roomId, long userId, String status) {
        ChatRoomRow row = new ChatRoomRow();
        row.setRoomId(roomId);
        row.setUserId(userId);
        row.setOwnerStatusCode(status);
        return row;
    }

    private static List<ChatMessageRow> messages(LongStream ids) {
        return ids.mapToObj(id -> {
            ChatMessageRow row = new ChatMessageRow();
            row.setMessageId(id);
            row.setSenderTypeCode(ChatService.SENDER_USER);
            row.setContent("m" + id);
            return row;
        }).toList();
    }

    @Test
    void 문의한_적이_없으면_방_번호_없이_빈_목록() {
        ChatDtos.MessagePage page = service.myMessages(7L, null, null);

        assertNull(page.roomId());
        assertTrue(page.messages().isEmpty());
        assertFalse(page.hasMore());
    }

    @Test
    void 첫_메시지는_방을_만들고_방을_잠근_뒤_저장하고_이벤트를_낸다() {
        given(mapper.insertRoom(any())).willAnswer(invocation -> {
            invocation.<ChatRoomRow>getArgument(0).setRoomId(3L);
            return 1;
        });

        ChatDtos.Message saved = service.sendAsUser(7L, "  안녕하세요 \n");

        assertEquals("안녕하세요", saved.content());
        assertEquals(ChatService.SENDER_USER, saved.senderType());
        assertEquals(NOW, saved.createdAt());
        InOrder order = inOrder(mapper);
        order.verify(mapper).insertRoom(any());
        order.verify(mapper).touchRoom(3L, NOW);
        ArgumentCaptor<ChatMessageRow> captor = ArgumentCaptor.forClass(ChatMessageRow.class);
        order.verify(mapper).insertMessage(captor.capture());
        assertEquals(7L, captor.getValue().getSenderUserId());
        verify(publisher).publishEvent(new ChatMessageSavedEvent(3L, 7L));
    }

    @Test
    void 방이_이미_있으면_새로_만들지_않는다() {
        given(mapper.selectRoomByUserId(7L)).willReturn(room(3L, 7L, "ACTIVE"));

        service.sendAsUser(7L, "추가 문의");

        verify(mapper, never()).insertRoom(any());
        verify(mapper).touchRoom(3L, NOW);
    }

    @Test
    void 동시에_방이_만들어졌으면_먼저_만든_방을_쓴다() {
        given(mapper.selectRoomByUserId(7L)).willReturn(null, room(3L, 7L, "ACTIVE"));
        given(mapper.insertRoom(any())).willThrow(new DuplicateKeyException("UK"));

        service.sendAsUser(7L, "안녕하세요");

        verify(mapper).touchRoom(3L, NOW);
        verify(publisher).publishEvent(new ChatMessageSavedEvent(3L, 7L));
    }

    @Test
    void 이전_메시지는_최신_50개를_오래된_것부터_주고_더_있음을_알린다() {
        given(mapper.selectRoomByUserId(7L)).willReturn(room(3L, 7L, "ACTIVE"));
        // 최신 것부터 51개(100 → 50)
        given(mapper.selectMessagesBefore(3L, null, 51)).willReturn(messages(LongStream.rangeClosed(50, 100).map(i -> 150 - i)));

        ChatDtos.MessagePage page = service.myMessages(7L, null, null);

        assertEquals(50, page.messages().size());
        assertEquals(51L, page.messages().get(0).messageId());
        assertEquals(100L, page.messages().get(49).messageId());
        assertTrue(page.hasMore());
    }

    @Test
    void afterId가_있으면_새_메시지를_그_순서대로_준다() {
        given(mapper.selectRoom(3L)).willReturn(room(3L, 7L, "ACTIVE"));
        given(mapper.selectMessagesAfter(3L, 10L, 51)).willReturn(messages(LongStream.rangeClosed(11, 12)));

        ChatDtos.MessagePage page = service.roomMessages(3L, 10L, null);

        assertEquals(List.of(11L, 12L), page.messages().stream().map(ChatDtos.Message::messageId).toList());
        assertFalse(page.hasMore());
    }

    @Test
    void 관리자_답장은_관리자_번호로_저장하고_방_주인에게_알린다() {
        given(mapper.selectRoom(3L)).willReturn(room(3L, 7L, "ACTIVE"));

        ChatDtos.Message saved = service.sendAsAdmin(1L, 3L, "답변드립니다");

        assertEquals(ChatService.SENDER_ADMIN, saved.senderType());
        ArgumentCaptor<ChatMessageRow> captor = ArgumentCaptor.forClass(ChatMessageRow.class);
        verify(mapper).insertMessage(captor.capture());
        assertEquals(1L, captor.getValue().getSenderUserId());
        verify(publisher).publishEvent(new ChatMessageSavedEvent(3L, 7L));
    }

    @Test
    void 탈퇴한_회원에게는_답장할_수_없다() {
        given(mapper.selectRoom(3L)).willReturn(room(3L, 7L, "WITHDRAWN"));

        ApiException e = assertThrows(ApiException.class, () -> service.sendAsAdmin(1L, 3L, "답변"));

        assertEquals("MEMBER_WITHDRAWN", e.getCode());
        verify(mapper, never()).insertMessage(any());
        verifyNoInteractions(publisher);
    }

    @Test
    void 없는_방은_404() {
        ApiException e = assertThrows(ApiException.class, () -> service.markReadAsAdmin(99L, 1L));

        assertEquals("CHAT_ROOM_NOT_FOUND", e.getCode());
        verify(mapper, never()).updateAdminRead(anyLong(), anyLong());
    }

    @Test
    void 방이_없는_회원의_읽음_처리는_아무것도_하지_않는다() {
        service.markReadAsUser(7L, 10L);

        verify(mapper, never()).updateUserRead(anyLong(), anyLong());
    }

    @Test
    void 문의_목록의_쪽과_크기는_범위_안으로_맞춘다() {
        ChatDtos.RoomPage page = service.rooms(0, 500);

        assertEquals(1, page.page());
        assertEquals(50, page.size());
        verify(mapper).selectRooms(0, 50);
    }
}
