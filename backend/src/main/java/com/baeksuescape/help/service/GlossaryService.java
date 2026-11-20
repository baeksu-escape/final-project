package com.baeksuescape.help.service;

import com.baeksuescape.help.dto.GlossaryResponse;
import com.baeksuescape.help.dto.GlossaryResponse.Term;
import com.baeksuescape.help.mapper.GlossaryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * N-30-1 금융 용어 사전 서비스 (FP-180). 저장된 용어를 화면용 모양으로 바꾼다.
 * 사전이 비어 있어도 오류가 아니다. 화면은 사전에 없는 말을 원래 말 그대로 보여 준다.
 */
@Service
@RequiredArgsConstructor
public class GlossaryService {

    private final GlossaryMapper glossaryMapper;

    /** 용어 사전 전체 (용어 이름 순서) */
    public GlossaryResponse findAll() {
        return new GlossaryResponse(glossaryMapper.selectAllTerms().stream()
                .map(row -> new Term(row.getTerm(), row.getEasyText(), row.getExplanation()))
                .toList());
    }
}
