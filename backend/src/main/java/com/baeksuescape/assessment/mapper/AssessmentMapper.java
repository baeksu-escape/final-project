package com.baeksuescape.assessment.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.assessment.dto.AssessmentRows.AssessmentRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FactorRow;
import com.baeksuescape.assessment.dto.AssessmentRows.FeatureRow;
import com.baeksuescape.assessment.dto.AssessmentRows.GradeBandRow;
import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.EasypayRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;

// FP-142 N-12-2·N-14·N-04-6 평가 저장·조회 SQL (mapper/assessment/AssessmentMapper.xml).
@Mapper
public interface AssessmentMapper {

    // ── 점수 산출(RPT-01) ──

    // 같은 requestId 재요청·다른 회원 충돌 확인 (UK_ASM_REQUEST_ID)
    AssessmentRow selectByRequestId(@Param("requestId") String requestId);

    // 지금 ACTIVE인 모델 버전 (NOT_SCORABLE 행도 MODEL_VERSION이 필수)
    String selectActiveModelVersion();

    // APP_SETTING 값 (INPUT_MAX_AGE_MONTHS 등). 없으면 null
    String selectSetting(@Param("settingKey") String settingKey);

    // 직군별 필요한 소득 개월 수 (DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS: 12/12/1)
    Integer selectRequiredIncomeMonths(@Param("workerTypeCode") String workerTypeCode);

    // 동의로 불러온 대안 데이터(철회·만료 시 행이 지워지므로 IMPORTED만 읽으면 지금 유효한 데이터다)
    List<BillRow> selectImportedTelecom(@Param("userId") long userId);

    List<BillRow> selectImportedUtility(@Param("userId") long userId);

    List<EasypayRow> selectImportedEasypay(@Param("userId") long userId);

    List<InsuranceRow> selectImportedInsurance(@Param("userId") long userId);

    // 평가 1행 저장 — 저장 후 row.assessmentId가 채워진다
    int insertAssessment(AssessmentRow row);

    // SHAP 요인 1행 저장 (피처 수만큼 부른다)
    int insertFactor(FactorRow row);

    // ── 리포트·진단 내역(RPT-02·03, MEM-06) ──

    AssessmentRow selectLatest(@Param("userId") long userId);

    AssessmentRow selectByUserAndRequestId(@Param("userId") long userId, @Param("requestId") String requestId);

    // 진단 내역 — 최신순
    List<AssessmentRow> selectHistory(@Param("userId") long userId);

    // 요인 + DIM_FEATURE 이름 (rank 순)
    List<FactorRow> selectFactors(@Param("assessmentId") long assessmentId);

    List<GradeBandRow> selectGradeBands(@Param("cutoffVersion") String cutoffVersion);

    // N-12-6 그 평가의 피처 사전 전체(DISPLAY_ORDER 순). 피처 세트가 없으면(NOT_SCORABLE) 모델 버전의 피처 세트를 쓴다.
    List<FeatureRow> selectModelFeatures(@Param("featureSetVersion") String featureSetVersion,
            @Param("modelVersion") String modelVersion);
}
