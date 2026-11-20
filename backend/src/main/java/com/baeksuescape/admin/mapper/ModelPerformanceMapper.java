package com.baeksuescape.admin.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.admin.dto.ModelPerformanceRows.EvalSampleRow;
import com.baeksuescape.admin.dto.ModelPerformanceRows.SeedMeanAucRow;

// N-25 모형 성능 비교 읽기 — 지금 쓰는 모델(MODEL_REGISTRY ACTIVE)의 평가 표본과 5개 시드 평균 AUC.
@Mapper
public interface ModelPerformanceMapper {

    // ACTIVE 모델 버전 1건. 없으면 null
    String selectActiveModelVersion();

    // 모델 버전·집단의 평가 표본(TRAIN·VALID). 직군 표시 순서대로 준다.
    List<EvalSampleRow> selectEvalSamples(@Param("modelVersion") String modelVersion, @Param("groupCode") String groupCode);

    // 라벨(DELINQ|NONFIN)의 5개 시드 평균 AUC. 값이 들어간 행이 없으면 null
    SeedMeanAucRow selectSeedMeanAuc(@Param("modelVersion") String modelVersion, @Param("label") String label);
}
