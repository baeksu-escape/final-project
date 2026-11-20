package com.baeksuescape.help.controller;

import com.baeksuescape.help.dto.GlossaryResponse;
import com.baeksuescape.help.service.GlossaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * N-30 쉬운 금융사전 REST 컨트롤러 (FP-180). 로그인한 사용자만 부른다(보안 설정: 그 밖의 /api/** = 로그인 필요).
 */
@RestController
@RequestMapping("/api/glossary")
@RequiredArgsConstructor
public class GlossaryController {

    private final GlossaryService glossaryService;

    /** N-30-1 HELP-01 용어 사전 조회 — 툴팁(N-30-2)·챗봇(N-32)이 쓰는 용어·쉬운 말·뜻 풀이 목록. */
    @GetMapping
    public ResponseEntity<GlossaryResponse> getGlossary() {
        return ResponseEntity.ok(glossaryService.findAll());
    }
}
