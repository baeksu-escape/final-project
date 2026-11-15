package com.baeksuescape.community.dto;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

// FP-191 BOARD_POST 한 행 + 작성자 닉네임·댓글 수(조회용). nickname은 탈퇴 회원이면 '탈퇴한 회원'으로 바뀌어 온다.
@Getter
@Setter
public class PostRow {

    private Long postId;
    private Long userId;
    private String title;
    private String content;
    private String statusCode;
    private String nickname;
    private int commentCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
