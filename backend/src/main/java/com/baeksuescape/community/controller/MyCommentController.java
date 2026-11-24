package com.baeksuescape.community.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.community.dto.BoardDtos;
import com.baeksuescape.community.service.BoardService;
import com.baeksuescape.global.security.AuthUser;

// FP-191 N-06 신용 라운지 [내가 쓴 댓글] 탭 API (COMM-09). 내 데이터라 /api/members/me/** 아래에 두며, 보안 설정이 ROLE_USER만 부르게 막는다.
@RestController
@RequestMapping("/api/members/me/comments")
public class MyCommentController {

    private final BoardService boardService;

    public MyCommentController(BoardService boardService) {
        this.boardService = boardService;
    }

    // COMM-09 내가 쓴 댓글 목록 (page는 1부터, 기본 10개). 회원은 토큰에서만 꺼낸다.
    @GetMapping
    public BoardDtos.MyCommentPage list(@AuthenticationPrincipal AuthUser user, @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return boardService.myComments(user.userId(), page, size);
    }
}
