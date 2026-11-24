package com.baeksuescape.community.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.community.dto.CommentRow;
import com.baeksuescape.community.dto.PostRow;

// FP-191 N-06 신용 라운지 글·댓글·글 기록(BOARD_POST, BOARD_COMMENT, BOARD_POST_LOG, DDL v0.3.2).
@Mapper
public interface BoardMapper {

    // N-06-1 목록: 삭제 글을 빼고 최신순. likePattern은 '%검색어%'(특수문자는 \로 막은 값)이고 null이면 전체.
    List<PostRow> selectPosts(@Param("likePattern") String likePattern, @Param("offset") int offset, @Param("limit") int limit);

    int countPosts(@Param("likePattern") String likePattern);

    // 글 한 개(상태와 상관없이). 없으면 null
    PostRow selectPost(@Param("postId") long postId);

    // 글 저장. 저장하면 row.postId에 새 번호가 채워진다.
    int insertPost(PostRow row);

    // 보이는 글만 고친다. 그 사이 숨겨졌으면 0
    int updatePostContent(@Param("postId") long postId, @Param("title") String title, @Param("content") String content,
            @Param("now") LocalDateTime now);

    // 상태가 fromStatus일 때만 바꾼다. 그 사이 다른 처리로 바뀌었으면 0
    int updatePostStatus(@Param("postId") long postId, @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus,
            @Param("now") LocalDateTime now);

    // 글 기록 한 줄. actorUserId·beforeStatus·reportId는 없으면 null
    int insertPostLog(@Param("postId") long postId, @Param("actionCode") String actionCode, @Param("actorTypeCode") String actorTypeCode,
            @Param("actorUserId") Long actorUserId, @Param("beforeStatus") String beforeStatus, @Param("afterStatus") String afterStatus,
            @Param("reportId") Long reportId, @Param("now") LocalDateTime now);

    // N-06-3 한 글의 댓글: 삭제 댓글을 빼고 오래된 순
    List<CommentRow> selectComments(@Param("postId") long postId);

    // COMM-09 내가 쓴 댓글: 삭제 댓글·삭제된 글의 댓글을 빼고 최신순. 글이 숨김이면 postTitle은 null
    List<CommentRow> selectMyComments(@Param("userId") long userId, @Param("offset") int offset, @Param("limit") int limit);

    int countMyComments(@Param("userId") long userId);

    // 댓글 한 개(상태와 상관없이). 없으면 null
    CommentRow selectComment(@Param("commentId") long commentId);

    // 댓글 저장. 저장하면 row.commentId에 새 번호가 채워진다.
    int insertComment(CommentRow row);

    // 상태가 fromStatus일 때만 바꾼다. 그 사이 다른 처리로 바뀌었으면 0
    int updateCommentStatus(@Param("commentId") long commentId, @Param("fromStatus") String fromStatus,
            @Param("toStatus") String toStatus, @Param("now") LocalDateTime now);
}
