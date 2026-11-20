package com.baeksuescape.help.mapper;

import com.baeksuescape.help.dto.GlossaryTermRow;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;

/**
 * N-30-1 금융 용어 사전(GLOSSARY_TERM) 조회 매퍼 (FP-180).
 */
@Mapper
public interface GlossaryMapper {

    /** 용어 사전 전체. 용어 이름 순서 */
    List<GlossaryTermRow> selectAllTerms();
}
