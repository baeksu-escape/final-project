package com.baeksuescape.community.dto;

// FP-191 신고·처리 대상(글 또는 댓글) 하나. 댓글이면 title은 null이고 parentPostId에 원래 글 번호가 들어 있다.
public record ContentTarget(String targetType, long targetId, Long ownerUserId, String statusCode, Long parentPostId, String title,
        String content, String nickname) {
}
