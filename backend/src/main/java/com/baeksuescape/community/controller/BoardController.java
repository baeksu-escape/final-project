package com.baeksuescape.community.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.community.dto.BoardDtos;
import com.baeksuescape.community.service.BoardService;
import com.baeksuescape.global.security.AuthUser;

import jakarta.validation.Valid;

// FP-192 N-06 신용 라운지 글·댓글 API (API 정의서 v0.2 COMM-01~06). 로그인한 사용자만 부르고, 작성자는 토큰의 USER_ID다.
@RestController
@RequestMapping("/api/board/posts")
public class BoardController {

    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    // COMM-01 N-06-1 글 목록 (page는 1부터, 기본 10개, keyword는 제목·내용 검색)
    @GetMapping
    public BoardDtos.PostPage list(@AuthenticationPrincipal AuthUser user, @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size, @RequestParam(required = false) String keyword) {
        return boardService.list(user.userId(), page, size, keyword);
    }

    // COMM-02 N-06-1 글 상세 + 댓글
    @GetMapping("/{postId}")
    public BoardDtos.PostDetail detail(@AuthenticationPrincipal AuthUser user, @PathVariable long postId) {
        return boardService.detail(user.userId(), postId);
    }

    // COMM-03 N-06-2 글 작성
    @PostMapping
    public BoardDtos.PostCreated create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody BoardDtos.PostWrite request) {
        return boardService.create(user.userId(), request);
    }

    // COMM-04 N-06-5 내 글 수정
    @PutMapping("/{postId}")
    public Map<String, Object> update(@AuthenticationPrincipal AuthUser user, @PathVariable long postId,
            @Valid @RequestBody BoardDtos.PostWrite request) {
        boardService.update(user.userId(), postId, request);
        return Map.of();
    }

    // COMM-05 N-06-6 내 글 삭제
    @DeleteMapping("/{postId}")
    public Map<String, Object> delete(@AuthenticationPrincipal AuthUser user, @PathVariable long postId) {
        boardService.delete(user.userId(), postId);
        return Map.of();
    }

    // COMM-06 N-06-3 댓글 조회
    @GetMapping("/{postId}/comments")
    public BoardDtos.CommentList comments(@AuthenticationPrincipal AuthUser user, @PathVariable long postId) {
        return boardService.comments(user.userId(), postId);
    }

    // COMM-06 N-06-3 댓글 작성
    @PostMapping("/{postId}/comments")
    public BoardDtos.CommentCreated addComment(@AuthenticationPrincipal AuthUser user, @PathVariable long postId,
            @Valid @RequestBody BoardDtos.CommentWrite request) {
        return boardService.addComment(user.userId(), postId, request);
    }
}
