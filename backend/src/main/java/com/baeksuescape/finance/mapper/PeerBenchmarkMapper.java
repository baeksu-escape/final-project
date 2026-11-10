package com.baeksuescape.finance.mapper;

import com.baeksuescape.finance.dto.PeerBenchmarkResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

// N-15-2 공공통계 동년배 기준값 매퍼 인터페이스 — FACT_HFS_STAT 및 FACT_INDUSTRY_AGE_INCOME 조회
@Mapper
public interface PeerBenchmarkMapper {

    // 특정 연령대의 가계금융복지조사 통계 기준값을 조회한다.
    PeerBenchmarkResponse findByAgeGroup(@Param("statYear") int statYear, @Param("ageGroup") String ageGroup);

    // 전체 연령대의 가계금융복지조사 통계 목록을 조회한다.
    List<PeerBenchmarkResponse> findAllByYear(@Param("statYear") int statYear);

    // 특정 직군 및 연령대의 평균 통계를 조회한다.
    PeerBenchmarkResponse findByJobTypeAndAgeGroup(
            @Param("statYear") int statYear,
            @Param("jobType") String jobType,
            @Param("ageGroup") String ageGroup
    );
}

