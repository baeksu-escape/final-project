package com.baeksuescape.community.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-191 N-33-1 새 신고 한 행(CONTENT_REPORT 저장용). 저장하면 reportId에 새 번호가 채워진다.
@Getter
@Setter
public class NewReport {

    private Long reportId;
    private String targetTypeCode;
    private Long postId;
    private Long commentId;
    private Long reporterUserId;
    private String reasonCode;
    private String detailText;
    private LocalDateTime reportedAt;
}
