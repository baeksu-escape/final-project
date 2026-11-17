package com.baeksuescape.community.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-191 N-34 관리자 화면용 신고 한 행 — CONTENT_REPORT에 대상 글·댓글의 요약과 상태, 신고자 닉네임을 붙였다.
// targetText: 글이면 제목, 댓글이면 내용 앞 50자. reporterWithdrawn: 신고자가 탈퇴했으면 'Y'.
@Getter
@Setter
public class ReportRow {

    private Long reportId;
    private String targetTypeCode;
    private Long postId;
    private Long commentId;
    private Long parentPostId;
    private String reasonCode;
    private String detailText;
    private String statusCode;
    private String resultCode;
    private String handlerMemo;
    private LocalDateTime reportedAt;
    private LocalDateTime handledAt;
    private String reporterNickname;
    private String reporterWithdrawn;
    private String targetText;
    private String targetStatusCode;

    // 신고 대상 번호(글이면 글 번호, 댓글이면 댓글 번호)
    public long targetId() {
        return "POST".equals(targetTypeCode) ? postId : commentId;
    }
}
