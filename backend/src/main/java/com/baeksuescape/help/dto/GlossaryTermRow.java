package com.baeksuescape.help.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * N-30-1 GLOSSARY_TERM 조회 결과 한 행 — 금융 용어와 쉬운 말, 뜻 풀이.
 */
@Getter
@Setter
@NoArgsConstructor
public class GlossaryTermRow {
    private Long termId;
    /** 화면에 나오는 금융 용어 */
    private String term;
    /** 바꿔 보여 줄 쉬운 말 (N-30-2) */
    private String easyText;
    /** 툴팁·용어 도우미에 보일 뜻 풀이. 없을 수 있다 */
    private String explanation;
}
