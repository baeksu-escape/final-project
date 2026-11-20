package com.baeksuescape.help.dto;

import java.util.List;

/**
 * N-30-1 HELP-01 용어 사전 응답 — 용어 이름 순서의 목록. 사전이 비어 있으면 빈 목록이다.
 */
public record GlossaryResponse(List<Term> terms) {

    /** 용어 1개: 용어, 쉬운 말, 뜻 풀이(없으면 null) */
    public record Term(String term, String easyText, String explanation) {
    }
}
