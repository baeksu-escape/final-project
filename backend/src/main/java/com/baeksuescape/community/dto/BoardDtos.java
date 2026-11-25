package com.baeksuescape.community.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.baeksuescape.community.service.CommunityCodes;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// FP-191 N-06 신용 라운지 글·댓글 API 요청·응답(API 정의서 v0.2 COMM-01~06).
// 숨김 글·댓글(hidden=true)은 제목·내용을 null로 보낸다. 화면은 "신고로 숨김 처리된 글입니다"를 보여 준다(N-33-2).
public final class BoardDtos {

    private BoardDtos() {
    }

    // COMM-01 목록 한 줄. categoryCode: 글 카테고리(숨김 글은 null), mine: 내가 쓴 글인지
    public record PostSummary(Long postId, String categoryCode, String title, String nickname, int commentCount, LocalDateTime createdAt,
            boolean hidden, boolean mine) {
    }

    // COMM-01 목록 한 쪽. page는 1부터, totalCount는 검색 결과 전체 글 수
    public record PostPage(List<PostSummary> items, int page, int size, int totalCount) {
    }

    // COMM-02·06 댓글 한 개
    public record Comment(Long commentId, String content, String nickname, LocalDateTime createdAt, boolean hidden, boolean mine) {
    }

    public record CommentList(List<Comment> comments) {
    }

    // COMM-09 내가 쓴 댓글 한 줄. postNickname은 그 글을 쓴 회원이다. 숨김 댓글은 content가, 숨김 글의 댓글은 categoryCode·postTitle·postNickname이 null이다.
    public record MyComment(Long commentId, Long postId, String categoryCode, String postTitle, String postNickname, String content,
            LocalDateTime createdAt, boolean hidden) {
    }

    // COMM-09 내가 쓴 댓글 한 쪽. totalCount는 검색 결과 전체 댓글 수
    public record MyCommentPage(List<MyComment> items, int page, int size, int totalCount) {
    }

    // COMM-02 글 상세 + 댓글 목록. updatedAt은 수정한 적이 없으면 null
    public record PostDetail(Long postId, String categoryCode, String title, String content, String nickname, LocalDateTime createdAt,
            LocalDateTime updatedAt, boolean hidden, boolean mine, List<Comment> comments) {
    }

    // COMM-03 글 작성·COMM-04 글 수정. categoryCode는 선택 — 없으면 작성은 자유, 수정은 기존 카테고리를 그대로 둔다.
    public record PostWrite(
            @NotBlank(message = "제목을 입력해 주세요.") @Size(max = 200, message = "제목은 200자까지 쓸 수 있습니다.") String title,
            @NotBlank(message = "내용을 입력해 주세요.") @Size(max = 1300, message = "내용은 1300자까지 쓸 수 있습니다.") String content,
            @Pattern(regexp = CommunityCodes.CATEGORY_PATTERN, message = "카테고리 값이 올바르지 않습니다.") String categoryCode) {
    }

    public record PostCreated(Long postId) {
    }

    // COMM-06 댓글 작성·COMM-10 댓글 수정
    public record CommentWrite(
            @NotBlank(message = "댓글을 입력해 주세요.") @Size(max = 1000, message = "댓글은 1000자까지 쓸 수 있습니다.") String content) {
    }

    public record CommentCreated(Long commentId) {
    }
}
