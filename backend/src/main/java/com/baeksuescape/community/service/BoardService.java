package com.baeksuescape.community.service;

import static com.baeksuescape.community.service.CommunityCodes.ACTION_CREATE;
import static com.baeksuescape.community.service.CommunityCodes.ACTION_DELETE;
import static com.baeksuescape.community.service.CommunityCodes.ACTION_UPDATE;
import static com.baeksuescape.community.service.CommunityCodes.ACTOR_USER;
import static com.baeksuescape.community.service.CommunityCodes.COMMENT;
import static com.baeksuescape.community.service.CommunityCodes.DELETED;
import static com.baeksuescape.community.service.CommunityCodes.HIDDEN;
import static com.baeksuescape.community.service.CommunityCodes.POST;
import static com.baeksuescape.community.service.CommunityCodes.VISIBLE;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.community.dto.BoardDtos;
import com.baeksuescape.community.dto.CommentRow;
import com.baeksuescape.community.dto.PostRow;
import com.baeksuescape.community.mapper.BoardMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-192 N-06 신용 라운지 글·댓글 — 목록·상세(N-06-1), 글 작성(N-06-2), 댓글(N-06-3), 내 글 수정·삭제(N-06-5·6, 11/15 추가).
// 내가 쓴 댓글 목록과 내 댓글 수정·삭제(N-06, FP-279·280). 숨김 글·댓글은 제목·내용을 비워서 보내고, 삭제 글은 목록·상세에서 뺀다.
// 신고로 숨겨진 글·댓글은 작성자도 고치거나 지울 수 없고 관리자만 처리한다(11/25 결정).
@Service
public class BoardService {

    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 50;
    // COMM-01 filter·sort 값. 이 값이 아니면 조건 없이 최신순으로 본다.
    public static final String FILTER_MINE = "mine";
    public static final String SORT_COMMENTS = "comments";

    private final BoardMapper boardMapper;
    private final ContentStatusService contentStatus;
    private final Clock clock;

    public BoardService(BoardMapper boardMapper, ContentStatusService contentStatus, Clock clock) {
        this.boardMapper = boardMapper;
        this.contentStatus = contentStatus;
        this.clock = clock;
    }

    // N-06-1 글 목록 한 쪽(최신순, 기본 10개). 검색어는 보이는 글의 제목·내용에서 찾는다.
    // filter=mine이면 내 글만, sort=comments면 전체 글에서 댓글 많은 순(같으면 최신순)으로 준다(FP-279).
    public BoardDtos.PostPage list(long userId, int page, int size, String keyword, String filter, String sort) {
        int safePage = Math.max(page, 1);
        int safeSize = safeSize(size);
        String likePattern = toLikePattern(keyword);
        Long ownerUserId = FILTER_MINE.equals(filter) ? userId : null;
        boolean byComments = SORT_COMMENTS.equals(sort);
        int total = boardMapper.countPosts(likePattern, ownerUserId, byComments);
        List<BoardDtos.PostSummary> items = boardMapper
                .selectPosts(likePattern, ownerUserId, byComments, (safePage - 1) * safeSize, safeSize).stream()
                .map(row -> {
                    boolean hidden = HIDDEN.equals(row.getStatusCode());
                    return new BoardDtos.PostSummary(row.getPostId(), hidden ? null : row.getTitle(), row.getNickname(),
                            row.getCommentCount(), row.getCreatedAt(), hidden, isMine(row.getUserId(), userId));
                })
                .toList();
        return new BoardDtos.PostPage(items, safePage, safeSize, total);
    }

    // N-06-1 글 상세 + 댓글. 없거나 삭제된 글은 404
    public BoardDtos.PostDetail detail(long userId, long postId) {
        PostRow post = requireLivePost(postId);
        boolean hidden = HIDDEN.equals(post.getStatusCode());
        return new BoardDtos.PostDetail(post.getPostId(), hidden ? null : post.getTitle(), hidden ? null : post.getContent(),
                post.getNickname(), post.getCreatedAt(), post.getUpdatedAt(), hidden, isMine(post.getUserId(), userId),
                commentViews(userId, postId));
    }

    // N-06-3 댓글 목록(오래된 순)
    public BoardDtos.CommentList comments(long userId, long postId) {
        requireLivePost(postId);
        return new BoardDtos.CommentList(commentViews(userId, postId));
    }

    // COMM-09 내가 쓴 댓글 한 쪽(최신순, 쪽 규칙은 글 목록과 같음). 삭제 댓글·삭제된 글의 댓글은 빼고, 숨김 댓글은 내용을 비운다.
    public BoardDtos.MyCommentPage myComments(long userId, int page, int size) {
        int safePage = Math.max(page, 1);
        int safeSize = safeSize(size);
        int total = boardMapper.countMyComments(userId);
        List<BoardDtos.MyComment> items = boardMapper.selectMyComments(userId, (safePage - 1) * safeSize, safeSize).stream()
                .map(row -> {
                    boolean hidden = HIDDEN.equals(row.getStatusCode());
                    return new BoardDtos.MyComment(row.getCommentId(), row.getPostId(), row.getPostTitle(),
                            hidden ? null : row.getContent(), row.getNickname(), row.getCreatedAt(), hidden);
                })
                .toList();
        return new BoardDtos.MyCommentPage(items, safePage, safeSize, total);
    }

    // N-06-2 글 작성 — 저장하고 글 기록(CREATE)을 남긴다.
    @Transactional
    public BoardDtos.PostCreated create(long userId, BoardDtos.PostWrite request) {
        LocalDateTime now = LocalDateTime.now(clock);
        PostRow row = new PostRow();
        row.setUserId(userId);
        row.setTitle(request.title().trim());
        row.setContent(request.content().trim());
        row.setCreatedAt(now);
        boardMapper.insertPost(row);
        boardMapper.insertPostLog(row.getPostId(), ACTION_CREATE, ACTOR_USER, userId, null, VISIBLE, null, now);
        return new BoardDtos.PostCreated(row.getPostId());
    }

    // N-06-5 내 글 수정 — 보이는 글만 고칠 수 있다(숨겨진 글은 수정 불가, C조 11/12 확정).
    @Transactional
    public void update(long userId, long postId, BoardDtos.PostWrite request) {
        PostRow post = requireLivePost(postId);
        requireOwner(post.getUserId(), userId, "글");
        LocalDateTime now = LocalDateTime.now(clock);
        if (!VISIBLE.equals(post.getStatusCode())
                || boardMapper.updatePostContent(postId, request.title().trim(), request.content().trim(), now) == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "POST_HIDDEN", "신고로 숨김 처리된 글은 수정할 수 없습니다.");
        }
        boardMapper.insertPostLog(postId, ACTION_UPDATE, ACTOR_USER, userId, VISIBLE, VISIBLE, null, now);
    }

    // N-06-6 내 글 삭제 — 행은 지우지 않고 상태만 DELETED로 바꾼다. 숨겨진 글은 지울 수 없다(11/25 결정, FP-280).
    @Transactional
    public void delete(long userId, long postId) {
        PostRow post = requireLivePost(postId);
        requireOwner(post.getUserId(), userId, "글");
        if (!VISIBLE.equals(post.getStatusCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "POST_HIDDEN", "신고로 숨김 처리된 글은 삭제할 수 없습니다.");
        }
        boolean changed = contentStatus.change(POST, postId, VISIBLE, DELETED, ACTION_DELETE, ACTOR_USER, userId, null,
                LocalDateTime.now(clock));
        if (!changed) {
            throw new ApiException(HttpStatus.CONFLICT, "STATUS_CHANGED", "글 상태가 바뀌었습니다. 새로고침한 뒤 다시 시도해 주세요.");
        }
    }

    // N-06-3 댓글 작성. 숨겨진 글에는 댓글을 달 수 없다.
    @Transactional
    public BoardDtos.CommentCreated addComment(long userId, long postId, BoardDtos.CommentWrite request) {
        PostRow post = requireLivePost(postId);
        if (!VISIBLE.equals(post.getStatusCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "POST_HIDDEN", "신고로 숨김 처리된 글에는 댓글을 달 수 없습니다.");
        }
        CommentRow row = new CommentRow();
        row.setPostId(postId);
        row.setUserId(userId);
        row.setContent(request.content().trim());
        row.setCreatedAt(LocalDateTime.now(clock));
        boardMapper.insertComment(row);
        return new BoardDtos.CommentCreated(row.getCommentId());
    }

    // N-06 내 댓글 수정(COMM-10, FP-280) — 보이는 내 댓글만 고칠 수 있다.
    @Transactional
    public void updateComment(long userId, long postId, long commentId, BoardDtos.CommentWrite request) {
        requireEditableComment(userId, postId, commentId);
        if (boardMapper.updateCommentContent(commentId, request.content().trim(), LocalDateTime.now(clock)) == 0) {
            throw commentChanged();
        }
    }

    // N-06 내 댓글 삭제(COMM-11, FP-280) — 행은 지우지 않고 상태만 DELETED로 바꾼다.
    @Transactional
    public void deleteComment(long userId, long postId, long commentId) {
        requireEditableComment(userId, postId, commentId);
        boolean changed = contentStatus.change(COMMENT, commentId, VISIBLE, DELETED, ACTION_DELETE, ACTOR_USER, userId, null,
                LocalDateTime.now(clock));
        if (!changed) {
            throw commentChanged();
        }
    }

    // 검색어를 LIKE 조건으로 바꾼다. %·_·\는 글자 그대로 찾도록 \를 붙인다(XML의 ESCAPE '\'). 빈 검색어는 null
    static String toLikePattern(String keyword) {
        if (keyword == null || keyword.isBlank()) return null;
        String escaped = keyword.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    // 한 쪽 개수 — 1~50이 아니면 기본 10개
    private static int safeSize(int size) {
        return size < 1 || size > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : size;
    }

    private List<BoardDtos.Comment> commentViews(long userId, long postId) {
        return boardMapper.selectComments(postId).stream()
                .map(row -> {
                    boolean hidden = HIDDEN.equals(row.getStatusCode());
                    return new BoardDtos.Comment(row.getCommentId(), hidden ? null : row.getContent(), row.getNickname(),
                            row.getCreatedAt(), hidden, isMine(row.getUserId(), userId));
                })
                .toList();
    }

    private PostRow requireLivePost(long postId) {
        PostRow post = boardMapper.selectPost(postId);
        if (post == null || DELETED.equals(post.getStatusCode())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "글을 찾을 수 없습니다.");
        }
        return post;
    }

    // 고치거나 지울 수 있는 내 댓글인지 확인한다. 그 글의 댓글이 아니면 없는 댓글로 보고, 글이나 댓글이 숨겨져 있으면 막는다.
    private void requireEditableComment(long userId, long postId, long commentId) {
        PostRow post = requireLivePost(postId);
        CommentRow comment = boardMapper.selectComment(commentId);
        if (comment == null || !Objects.equals(comment.getPostId(), postId) || DELETED.equals(comment.getStatusCode())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.");
        }
        requireOwner(comment.getUserId(), userId, "댓글");
        if (!VISIBLE.equals(post.getStatusCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "POST_HIDDEN", "신고로 숨김 처리된 글의 댓글은 고치거나 지울 수 없습니다.");
        }
        if (!VISIBLE.equals(comment.getStatusCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "COMMENT_HIDDEN", "신고로 숨김 처리된 댓글은 고치거나 지울 수 없습니다.");
        }
    }

    private static ApiException commentChanged() {
        return new ApiException(HttpStatus.CONFLICT, "STATUS_CHANGED", "댓글 상태가 바뀌었습니다. 새로고침한 뒤 다시 시도해 주세요.");
    }

    // 작성자 본인이 아니면 403. kind는 오류 문구에 쓸 '글' 또는 '댓글'
    private static void requireOwner(Long ownerUserId, long userId, String kind) {
        if (!isMine(ownerUserId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_OWNER", "내가 쓴 " + kind + "만 고치거나 지울 수 있습니다.");
        }
    }

    private static boolean isMine(Long ownerUserId, long userId) {
        return Objects.equals(ownerUserId, userId);
    }
}
