package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.simulation.GradeBandRow;
import com.baeksuescape.finance.dto.simulation.ScoreBandOfferRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * N-18-7 점수대별 참고 금리·한도와 등급 조회 매퍼 (FP-170).
 */
@Mapper
public interface ScoreBandOfferMapper {

    /** 점수가 들어가는 점수대의 참고 금리·한도. 없으면 null */
    ScoreBandOfferRow selectOfferByScore(@Param("score") int score);

    /** 현재 사용 중(ACTIVE)인 등급 구간에서 점수에 맞는 등급. 없으면 null */
    GradeBandRow selectActiveGradeBand(@Param("score") int score);
}
