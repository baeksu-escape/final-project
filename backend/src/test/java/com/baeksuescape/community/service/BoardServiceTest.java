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
import org.junit.jupiter.api.DisplayName;
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
        row.setCategoryCode("LOAN");
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
        given(boardMapper.countPosts(null, null, false, null)).willReturn(12);
        given(boardMapper.selectPosts(null, null, false, null, 10, 10))
                .willReturn(List.of(post(2, ME, "VISIBLE"), post(1, OTHER, "HIDDEN_BY_REPORT")));

        BoardDtos.PostPage page = service.list(ME, 2, 0, "  ", null, null, null);

        assertThat(page.page()).isEqualTo(2);
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.totalCount()).isEqualTo(12);
        assertThat(page.items().get(0).title()).isEqualTo("제목2");
        assertThat(page.items().get(0).mine()).isTrue();
        assertThat(page.items().get(0).categoryCode()).isEqualTo("LOAN");
        assertThat(page.items().get(1).title()).isNull();
        assertThat(page.items().get(1).categoryCode()).isNull();
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
        assertThat(detail.categoryCode()).isNull();
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

        BoardDtos.PostCreated created = service.create(ME, new BoardDtos.PostWrite("  첫 글  ", "\n 안녕하세요 \n", "LOAN"));

        assertThat(created.postId()).isEqualTo(11L);
        // 제목·댓글처럼 본문도 앞뒤 공백을 지우고 저장한다
        verify(boardMapper).insertPost(argThat(row -> "첫 글".equals(row.getTitle()) && "안녕하세요".equals(row.getContent())
                && "LOAN".equals(row.getCategoryCode())));
        verify(boardMapper).insertPostLog(11L, "CREATE", "USER", ME, null, "VISIBLE", null, NOW);
    }

    @Test
    void 카테고리를_고르지_않으면_작성은_자유로_수정은_기존_값으로_둔다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "VISIBLE"));
        given(boardMapper.updatePostContent(1L, "LOAN", "t", "c", NOW)).willReturn(1);
        willAnswer(invocation -> {
            invocation.<PostRow>getArgument(0).setPostId(11L);
            return 1;
        }).given(boardMapper).insertPost(any());

        service.create(ME, new BoardDtos.PostWrite("t", "c", null));
        service.update(ME, 1L, new BoardDtos.PostWrite("t", "c", null));

        verify(boardMapper).insertPost(argThat(row -> "FREE".equals(row.getCategoryCode())));
        verify(boardMapper).updatePostContent(1L, "LOAN", "t", "c", NOW);
    }

    @Test
    void 카테고리를_고르면_목록과_개수를_같은_조건으로_읽는다() {
        given(boardMapper.countPosts("%적금%", null, false, "LOAN")).willReturn(1);
        given(boardMapper.selectPosts("%적금%", null, false, "LOAN", 0, 10)).willReturn(List.of(post(1, OTHER, "VISIBLE")));

        BoardDtos.PostPage page = service.list(ME, 1, 10, "적금", null, null, "LOAN");

        assertThat(page.totalCount()).isEqualTo(1);
        assertThat(page.items()).hasSize(1);
    }

    @Test
    void 내가_쓴_댓글은_검색어와_카테고리를_목록과_개수에_함께_쓴다() {
        given(boardMapper.countMyComments(ME, "%10\\%%", "LOAN")).willReturn(1);
        given(boardMapper.selectMyComments(ME, "%10\\%%", "LOAN", 0, 10)).willReturn(List.of(myComment(1, "VISIBLE", "제목3")));

        BoardDtos.MyCommentPage page = service.myComments(ME, 1, 10, " 10% ", "LOAN");

        assertThat(page.totalCount()).isEqualTo(1);
        assertThat(page.items()).hasSize(1);
    }

    @Test
    void 남의_글은_수정하거나_삭제할_수_없다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "VISIBLE"));
        assertError(() -> service.update(ME, 1L, new BoardDtos.PostWrite("t", "c", null)), 403, "NOT_OWNER");
        assertError(() -> service.delete(ME, 1L), 403, "NOT_OWNER");
        verify(boardMapper, never()).updatePostContent(anyLong(), any(), anyString(), anyString(), any());
    }

    @Test
    void 내_글을_수정하면_UPDATE_기록을_남긴다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "VISIBLE"));
        given(boardMapper.updatePostContent(1L, "CARD", "새 제목", "새 내용", NOW)).willReturn(1);

        service.update(ME, 1L, new BoardDtos.PostWrite(" 새 제목 ", "새 내용", "CARD"));

        verify(boardMapper).insertPostLog(1L, "UPDATE", "USER", ME, "VISIBLE", "VISIBLE", null, NOW);
    }

    @Test
    void 신고로_숨겨진_글은_수정할_수_없다() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "HIDDEN_BY_REPORT"));
        assertError(() -> service.update(ME, 1L, new BoardDtos.PostWrite("t", "c", null)), 409, "POST_HIDDEN");
        verify(boardMapper, never()).updatePostContent(anyLong(), any(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("내 글을 지우면 상태를 DELETED로 바꾸고 DELETE 기록을 남긴다")
    void deletePost_ok() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "VISIBLE"));
        given(boardMapper.updatePostStatus(1L, "VISIBLE", "DELETED", NOW)).willReturn(1);

        service.delete(ME, 1L);

        verify(boardMapper).insertPostLog(1L, "DELETE", "USER", ME, "VISIBLE", "DELETED", null, NOW);
    }

    @Test
    @DisplayName("신고로 숨겨진 글은 작성자도 지울 수 없다(409 POST_HIDDEN, 11/25 결정)")
    void deletePost_hidden_conflict() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "HIDDEN_BY_REPORT"));

        assertError(() -> service.delete(ME, 1L), 409, "POST_HIDDEN");
        verify(boardMapper, never()).updatePostStatus(anyLong(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("지우는 사이 글이 숨겨졌으면 409 STATUS_CHANGED이고 기록을 남기지 않는다")
    void deletePost_changedMeanwhile_conflict() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, ME, "VISIBLE"));
        given(boardMapper.updatePostStatus(1L, "VISIBLE", "DELETED", NOW)).willReturn(0);

        assertError(() -> service.delete(ME, 1L), 409, "STATUS_CHANGED");
        verify(boardMapper, never()).insertPostLog(anyLong(), anyString(), anyString(), any(), any(), anyString(), any(), any());
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

    @Test
    @DisplayName("filter=mine은 내 글만, sort=comments는 댓글 많은 순으로 읽고 개수도 같은 조건으로 센다")
    void list_filterAndSort() {
        given(boardMapper.countPosts(null, ME, false, null)).willReturn(3);
        given(boardMapper.selectPosts(null, ME, false, null, 0, 10)).willReturn(List.of(post(1, ME, "VISIBLE")));
        given(boardMapper.countPosts("%적금%", null, true, null)).willReturn(5);
        given(boardMapper.selectPosts("%적금%", null, true, null, 0, 10)).willReturn(List.of(post(2, OTHER, "VISIBLE")));

        BoardDtos.PostPage mine = service.list(ME, 1, 10, null, "mine", null, null);
        BoardDtos.PostPage popular = service.list(ME, 1, 10, "적금", null, "comments", null);

        assertThat(mine.totalCount()).isEqualTo(3);
        assertThat(mine.items().get(0).mine()).isTrue();
        assertThat(popular.totalCount()).isEqualTo(5);
        assertThat(popular.items().get(0).postId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("정해진 값이 아닌 filter·sort는 무시하고 전체 글을 최신순으로 읽는다")
    void list_unknownFilterAndSort_ignored() {
        given(boardMapper.countPosts(null, null, false, null)).willReturn(1);
        given(boardMapper.selectPosts(null, null, false, null, 0, 10)).willReturn(List.of(post(1, OTHER, "VISIBLE")));

        assertThat(service.list(ME, 1, 10, null, "other", "views", " ").items()).hasSize(1);
    }

    // 1번 글(postStatus)과 21번 댓글을 준비한다.
    private void givenComment(String postStatus, long commentUserId, long commentPostId, String commentStatus) {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, postStatus));
        CommentRow row = new CommentRow();
        row.setCommentId(21L);
        row.setPostId(commentPostId);
        row.setUserId(commentUserId);
        row.setContent("댓글");
        row.setStatusCode(commentStatus);
        given(boardMapper.selectComment(21L)).willReturn(row);
    }

    // 댓글 수정·삭제가 같은 오류로 막히고 DB를 바꾸지 않는지 본다.
    private void assertCommentBlocked(int status, String code) {
        assertError(() -> service.updateComment(ME, 1L, 21L, new BoardDtos.CommentWrite("새 댓글")), status, code);
        assertError(() -> service.deleteComment(ME, 1L, 21L), status, code);
        verify(boardMapper, never()).updateCommentContent(anyLong(), anyString(), any());
        verify(boardMapper, never()).updateCommentStatus(anyLong(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("내 댓글을 고치면 앞뒤 공백을 지우고 저장한다")
    void updateComment_ok() {
        givenComment("VISIBLE", ME, 1L, "VISIBLE");
        given(boardMapper.updateCommentContent(21L, "새 댓글", NOW)).willReturn(1);

        service.updateComment(ME, 1L, 21L, new BoardDtos.CommentWrite(" 새 댓글 "));

        verify(boardMapper).updateCommentContent(21L, "새 댓글", NOW);
    }

    @Test
    @DisplayName("내 댓글을 지우면 상태만 DELETED로 바꾼다")
    void deleteComment_ok() {
        givenComment("VISIBLE", ME, 1L, "VISIBLE");
        given(boardMapper.updateCommentStatus(21L, "VISIBLE", "DELETED", NOW)).willReturn(1);

        service.deleteComment(ME, 1L, 21L);

        verify(boardMapper).updateCommentStatus(21L, "VISIBLE", "DELETED", NOW);
    }

    @Test
    @DisplayName("지워진 글의 댓글은 404 POST_NOT_FOUND다")
    void comment_postDeleted_notFound() {
        givenComment("DELETED", ME, 1L, "VISIBLE");
        assertCommentBlocked(404, "POST_NOT_FOUND");
    }

    @Test
    @DisplayName("없는 댓글은 404 COMMENT_NOT_FOUND다")
    void comment_notFound() {
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "VISIBLE"));
        assertCommentBlocked(404, "COMMENT_NOT_FOUND");
    }

    @Test
    @DisplayName("지워진 댓글은 404 COMMENT_NOT_FOUND다")
    void comment_deleted_notFound() {
        givenComment("VISIBLE", ME, 1L, "DELETED");
        assertCommentBlocked(404, "COMMENT_NOT_FOUND");
    }

    @Test
    @DisplayName("다른 글에 달린 댓글이면 404 COMMENT_NOT_FOUND다")
    void comment_ofOtherPost_notFound() {
        givenComment("VISIBLE", ME, 2L, "VISIBLE");
        assertCommentBlocked(404, "COMMENT_NOT_FOUND");
    }

    @Test
    @DisplayName("남의 댓글은 고치거나 지울 수 없다(403 NOT_OWNER)")
    void comment_notOwner_forbidden() {
        givenComment("VISIBLE", OTHER, 1L, "VISIBLE");
        assertCommentBlocked(403, "NOT_OWNER");
    }

    @Test
    @DisplayName("신고로 숨겨진 댓글은 본인도 고치거나 지울 수 없다(409 COMMENT_HIDDEN)")
    void comment_hidden_conflict() {
        givenComment("VISIBLE", ME, 1L, "HIDDEN_BY_REPORT");
        assertCommentBlocked(409, "COMMENT_HIDDEN");
    }

    @Test
    @DisplayName("숨겨진 글에 달린 내 댓글도 고치거나 지울 수 없다(409 POST_HIDDEN)")
    void comment_ofHiddenPost_conflict() {
        givenComment("HIDDEN_BY_REPORT", ME, 1L, "VISIBLE");
        assertCommentBlocked(409, "POST_HIDDEN");
    }

    @Test
    @DisplayName("고치거나 지우는 사이 댓글이 숨겨졌으면 409 STATUS_CHANGED다")
    void comment_changedMeanwhile_conflict() {
        givenComment("VISIBLE", ME, 1L, "VISIBLE");
        given(boardMapper.updateCommentContent(21L, "새 댓글", NOW)).willReturn(0);
        given(boardMapper.updateCommentStatus(21L, "VISIBLE", "DELETED", NOW)).willReturn(0);

        assertError(() -> service.updateComment(ME, 1L, 21L, new BoardDtos.CommentWrite("새 댓글")), 409, "STATUS_CHANGED");
        assertError(() -> service.deleteComment(ME, 1L, 21L), 409, "STATUS_CHANGED");
    }

    // COMM-09 내가 쓴 댓글 한 행
    private static CommentRow myComment(long commentId, String status, String postTitle) {
        CommentRow row = new CommentRow();
        row.setCommentId(commentId);
        row.setPostId(3L);
        row.setUserId(ME);
        row.setContent("댓글" + commentId);
        row.setStatusCode(status);
        row.setNickname("닉네임");
        row.setCreatedAt(NOW);
        row.setPostTitle(postTitle);
        row.setPostNickname("글쓴이");
        row.setCategoryCode("LOAN");
        return row;
    }

    @Test
    void 내가_쓴_댓글은_쪽을_나누고_숨김_댓글은_내용을_비운다() {
        given(boardMapper.countMyComments(ME, null, null)).willReturn(12);
        given(boardMapper.selectMyComments(ME, null, null, 10, 10))
                .willReturn(List.of(myComment(2, "VISIBLE", null), myComment(1, "HIDDEN_BY_REPORT", "제목3")));

        BoardDtos.MyCommentPage page = service.myComments(ME, 2, 10, null, null);

        assertThat(page.page()).isEqualTo(2);
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.totalCount()).isEqualTo(12);
        assertThat(page.items().get(0)).isEqualTo(new BoardDtos.MyComment(2L, 3L, "LOAN", null, "글쓴이", "댓글2", NOW, false));
        assertThat(page.items().get(1)).isEqualTo(new BoardDtos.MyComment(1L, 3L, "LOAN", "제목3", "글쓴이", null, NOW, true));
    }

    @Test
    void 내가_쓴_댓글은_쪽_값이_이상하면_첫_쪽_10개로_본다() {
        given(boardMapper.selectMyComments(ME, null, null, 0, 10)).willReturn(List.of(myComment(1, "VISIBLE", "제목3")));

        BoardDtos.MyCommentPage page = service.myComments(ME, 0, 51, " ", " ");

        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.items()).hasSize(1);
    }
}
