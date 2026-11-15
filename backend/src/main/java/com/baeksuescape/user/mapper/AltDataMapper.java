package com.baeksuescape.user.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.user.dto.DataInputRows.BillRow;
import com.baeksuescape.user.dto.DataInputRows.EasypayRow;
import com.baeksuescape.user.dto.DataInputRows.InsuranceRow;

// FP-85 N-05-6 대안 데이터 불러오기(INP-03)·N-05-9 동의 철회(INP-06). 불러온 행은 SOURCE_CODE='IMPORTED'와 CONSENT_ID를 갖는다(W3).
@Mapper
public interface AltDataMapper {

    // ── 통신비(USER_TELECOM_PAYMENT) ──
    int deleteImportedTelecom(@Param("userId") long userId);

    int insertTelecom(BillRow row);

    List<BillRow> selectTelecomByConsent(@Param("consentId") long consentId);

    // ── 공과금(USER_UTILITY_PAYMENT) ──
    int deleteImportedUtility(@Param("userId") long userId);

    int insertUtility(BillRow row);

    List<BillRow> selectUtilityByConsent(@Param("consentId") long consentId);

    // ── 간편결제(USER_EASYPAY_USAGE) ──
    int deleteImportedEasypay(@Param("userId") long userId);

    int insertEasypay(EasypayRow row);

    List<EasypayRow> selectEasypayByConsent(@Param("consentId") long consentId);

    // ── 국민연금·건강보험(USER_SOCIAL_INSURANCE_PAYMENT) ──
    int deleteImportedInsurance(@Param("userId") long userId, @Param("insuranceTypeCode") String insuranceTypeCode);

    int insertInsurance(InsuranceRow row);

    List<InsuranceRow> selectInsuranceByConsent(@Param("consentId") long consentId);

    // ── N-05-9 동의 철회: 그 동의로 불러온 행을 모든 대안 데이터 표에서 지운다(W1) ──
    int deleteTelecomByConsent(@Param("consentId") long consentId);

    int deleteUtilityByConsent(@Param("consentId") long consentId);

    int deleteEasypayByConsent(@Param("consentId") long consentId);

    int deleteInsuranceByConsent(@Param("consentId") long consentId);

    int deleteLoanByConsent(@Param("consentId") long consentId);

    int deleteCreditProfileByConsent(@Param("consentId") long consentId);

    // BORROW 모드 후보 — 같은 직군의 더미 회원(USER_ID 순).
    List<Long> selectDummyUserIds(@Param("workerTypeCode") String workerTypeCode);
}
