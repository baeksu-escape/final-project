package com.baeksuescape.community.service;

import static com.baeksuescape.community.service.CommunityCodes.COMMENT;
import static com.baeksuescape.community.service.CommunityCodes.POST;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.baeksuescape.community.dto.CommentRow;
import com.baeksuescape.community.dto.ContentTarget;
import com.baeksuescape.community.dto.PostRow;
import com.baeksuescape.community.mapper.BoardMapper;

// FP-191 글·댓글 공통 처리 — 신고 대상 찾기와 상태 바꾸기. 글 삭제(작성자), 자동 숨김(N-33-2), 관리자 처리(N-34-3)가 함께 쓴다.
@Service
public class ContentStatusService {

    private final BoardMapper boardMapper;

    public ContentStatusService(BoardMapper boardMapper) {
        this.boardMapper = boardMapper;
    }

    // 글(POST) 또는 댓글(COMMENT) 하나를 같은 모양으로 찾는다. 없으면 null
    public ContentTarget find(String targetType, long targetId) {
        if (POST.equals(targetType)) {
            PostRow post = boardMapper.selectPost(targetId);
            if (post == null) return null;
            return new ContentTarget(POST, targetId, post.getUserId(), post.getStatusCode(), null, post.getTitle(), post.getContent(),
                    post.getNickname());
        }
        if (COMMENT.equals(targetType)) {
            CommentRow comment = boardMapper.selectComment(targetId);
            if (comment == null) return null;
            return new ContentTarget(COMMENT, targetId, comment.getUserId(), comment.getStatusCode(), comment.getPostId(), null,
                    comment.getContent(), comment.getNickname());
        }
        return null;
    }

    // 상태를 fromStatus → toStatus로 바꾸고, 글이면 BOARD_POST_LOG에 한 줄 남긴다(댓글은 기록 표가 없다).
    // 그 사이 다른 처리로 상태가 이미 바뀌었으면 아무것도 하지 않고 false를 돌려준다.
    public boolean change(String targetType, long targetId, String fromStatus, String toStatus, String actionCode, String actorTypeCode,
            Long actorUserId, Long reportId, LocalDateTime now) {
        if (POST.equals(targetType)) {
            if (boardMapper.updatePostStatus(targetId, fromStatus, toStatus, now) == 0) return false;
            boardMapper.insertPostLog(targetId, actionCode, actorTypeCode, actorUserId, fromStatus, toStatus, reportId, now);
            return true;
        }
        return boardMapper.updateCommentStatus(targetId, fromStatus, toStatus, now) == 1;
    }
}
