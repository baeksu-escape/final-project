package com.baeksuescape.community.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.community.dto.BoardDtos;
import com.baeksuescape.community.dto.CommentRow;
import com.baeksuescape.community.dto.PostRow;
import com.baeksuescape.community.mapper.BoardMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-192 N-06 신용 라운지 글·댓글 규칙 — 목록·상세(N-06-1), 작성(N-06-2), 댓글(N-06-3), 내 글 수정·삭제(N-06-5·6). DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BoardServiceTest {

    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-15T01:00:00Z"), ZoneId.of("Asia/Seoul"));
    static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 15, 10, 0);
    static final long ME = 7L;
    static final long OTHER = 8L;

    @Mock
    private BoardMapper boardMapper;

    private BoardService service;

    @BeforeEach
    void setUp() {
        service = new BoardService(boardMapper, new ContentStatusService(boardMapper), CLOCK);
    }

    static PostRow post(long postId, long userId, String status) {
        PostRow row = new PostRow();
        row.setPostId(postId);
        row.setUserId(userId);
        row.setTitle("제목" + postId);
        row.setContent("내용" + postId);
        row.setStatusCode(status);
        row.setNickname("닉네임");
        row.setCreatedAt(NOW);
        return row;
    }

    private void assertError(Runnable call, int status, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus().value()).isEqualTo(status);
            assertThat(e.getCode()).isEqualTo(code);
        });
    }

    @Test
    void 목록은_10개씩_나누고_숨김_글은_제목을_비운다() {
        given(boardMapper.countPosts(null)).willReturn(12);
        given(boardMapper.selectPosts(null, 10, 10)).willReturn(List.of(post(2, ME, "VISIBLE"), post(1, OTHER, "HIDDEN_BY_REPORT")));

        BoardDtos.PostPage page = service.list(ME, 2, 0, "  ");

        assertThat(page.page()).isEqualTo(2);
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.totalCount()).isEqualTo(12);
        assertThat(page.items().get(0).title()).isEqualTo("제목2");
        assertThat(page.items().get(0).mine()).isTrue();
        assertThat(page.items().get(1).title()).isNull();
        assertThat(page.items().get(1).hidden()).isTrue();
        assertThat(page.items().get(1).mine()).isFalse();
    }

    @Test
    void 검색어의_퍼센트와_밑줄은_글자_그대로_찾는다() {
        assertThat(BoardService.toLikePattern(" 10%_적금 ")).isEqualTo("%10\\%\\_적금%");
        assertThat(BoardService.toLikePattern("")).isNull();
        assertThat(BoardService.toLikePattern(null)).isNull();
    }

    @Test
    void 없거나_삭제된_글은_404() {
        given(boardMapper.selectPost(5L)).willReturn(post(5, OTHER, "DELETED"));
        assertError(() -> service.detail(ME, 5L), 404, "POST_NOT_FOUND");
        assertError(() -> service.detail(ME, 99L), 404, "POST_NOT_FOUND");
    }

    @Test
    void 숨김_글과_숨김_댓글은_제목과_내용을_비운다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "HIDDEN_BY_REPORT"));
        CommentRow hiddenComment = new CommentRow();
        hiddenComment.setCommentId(3L);
        hiddenComment.setUserId(ME);
        hiddenComment.setContent("숨긴 댓글");
        hiddenComment.setStatusCode("HIDDEN_BY_REPORT");
        given(boardMapper.selectComments(1L)).willReturn(List.of(hiddenComment));

        BoardDtos.PostDetail detail = service.detail(ME, 1L);

        assertThat(detail.hidden()).isTrue();
        assertThat(detail.title()).isNull();
        assertThat(detail.content()).isNull();
        assertThat(detail.comments().get(0).content()).isNull();
        assertThat(detail.comments().get(0).mine()).isTrue();
    }

    @Test
    void 글을_쓰면_저장하고_CREATE_기록을_남긴다() {
        willAnswer(invocation -> {
            invocation.<PostRow>getArgument(0).setPostId(11L);
            return 1;
        }).given(boardMapper).insertPost(any());

        BoardDtos.PostCreated created = service.create(ME, new BoardDtos.PostWrite("  첫 글  ", "\n 안녕하세요 \n"));

        assertThat(created.postId()).isEqualTo(11L);
        // 제목·댓글처럼 본문도 앞뒤 공백을 지우고 저장한다
        verify(boardMapper).insertPost(argThat(row -> "첫 글".equals(row.getTitle()) && "안녕하세요".equals(row.getContent())));
        verify(boardMapper).insertPostLog(11L, "CREATE", "USER", ME, null, "VISIBLE", null, NOW);
    }

    @Test
    void 남의_글은_수정하거나_삭제할_수_없다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "VISIBLE"));
        assertError(() -> service.update(ME, 1L, new BoardDtos.PostWrite("t", "c")), 403, "NOT_OWNER");
        assertError(() -> service.delete(ME, 1L), 403, "NOT_OWNER");
        verify(boardMapper, never()).updatePostContent(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 내_글을_수정하면_UPDATE_기록을_남긴다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "VISIBLE"));
        given(boardMapper.updatePostContent(1L, "새 제목", "새 내용", NOW)).willReturn(1);

        service.update(ME, 1L, new BoardDtos.PostWrite(" 새 제목 ", "새 내용"));

        verify(boardMapper).insertPostLog(1L, "UPDATE", "USER", ME, "VISIBLE", "VISIBLE", null, NOW);
    }

    @Test
    void 신고로_숨겨진_글은_수정할_수_없다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "HIDDEN_BY_REPORT"));
        assertError(() -> service.update(ME, 1L, new BoardDtos.PostWrite("t", "c")), 409, "POST_HIDDEN");
        verify(boardMapper, never()).updatePostContent(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 신고로_숨겨진_글도_작성자는_삭제할_수_있다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "HIDDEN_BY_REPORT"));
        given(boardMapper.updatePostStatus(1L, "HIDDEN_BY_REPORT", "DELETED", NOW)).willReturn(1);

        service.delete(ME, 1L);

        verify(boardMapper).insertPostLog(1L, "DELETE", "USER", ME, "HIDDEN_BY_REPORT", "DELETED", null, NOW);
    }

    @Test
    void 숨겨진_글에는_댓글을_달_수_없다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "HIDDEN_BY_REPORT"));
        assertError(() -> service.addComment(ME, 1L, new BoardDtos.CommentWrite("댓글")), 409, "POST_HIDDEN");
        verify(boardMapper, never()).insertComment(any());
    }

    @Test
    void 댓글을_달면_작성자와_시각을_저장한다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "VISIBLE"));
        willAnswer(invocation -> {
            CommentRow row = invocation.getArgument(0);
            assertThat(row.getUserId()).isEqualTo(ME);
            assertThat(row.getContent()).isEqualTo("좋은 정보네요");
            assertThat(row.getCreatedAt()).isEqualTo(NOW);
            row.setCommentId(21L);
            return 1;
        }).given(boardMapper).insertComment(any());

        assertThat(service.addComment(ME, 1L, new BoardDtos.CommentWrite(" 좋은 정보네요 ")).commentId()).isEqualTo(21L);
        verify(boardMapper, never()).insertPostLog(anyLong(), anyString(), anyString(), any(), any(), anyString(), isNull(), eq(NOW));
    }
}
