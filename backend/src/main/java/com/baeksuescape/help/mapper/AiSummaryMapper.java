package com.baeksuescape.help.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * N-31-2 RPT-04 AI 요약 저장 매퍼 (FP-181). ASSESSMENT.AI_SUMMARY 한 열만 다룬다(평가 조회는 범영 님 ReportService를 그대로 쓴다).
 */
@Mapper
public interface AiSummaryMapper {

    /** 내 평가에 요약이 아직 없을 때만 저장한다. 이미 있으면 0(덮어쓰지 않음) */
    int updateAiSummaryIfEmpty(@Param("userId") long userId, @Param("requestId") String requestId, @Param("aiSummary") String aiSummary);

    /** 내 평가에 저장된 요약. 없으면 null */
    String selectAiSummary(@Param("userId") long userId, @Param("requestId") String requestId);
}
