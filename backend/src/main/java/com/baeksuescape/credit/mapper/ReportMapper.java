package com.baeksuescape.credit.mapper;

import com.baeksuescape.credit.dto.ReportAssessment;
import com.baeksuescape.credit.dto.ReportResponse;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// N-12-1·N-14-1 로그인 회원의 서비스 평가만 읽는 매퍼다. 모든 평가 조회에 회원 범위를 적용한다.
@Mapper
public interface ReportMapper {
    ReportAssessment findLatest(@Param("userId") Long userId);
    ReportAssessment findByRequestId(@Param("userId") Long userId, @Param("requestId") String requestId);
    List<ReportResponse.GradeBand> findGradeBands(@Param("userId") Long userId, @Param("assessmentId") Long assessmentId);
    List<ReportResponse.Factor> findFactors(@Param("userId") Long userId, @Param("assessmentId") Long assessmentId);
}
