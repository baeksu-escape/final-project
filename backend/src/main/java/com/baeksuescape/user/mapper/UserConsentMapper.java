package com.baeksuescape.user.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.user.dto.DataInputRows.ConsentRow;

// FP-87 N-02-2 가입 동의 저장(USER_CONSENT).
// FP-85 N-05-9 대안 데이터 정보 제공 동의(ALT_DATA_PROVISION) 조회·추가·철회·불러오기 기록(INP-03~06).
@Mapper
public interface UserConsentMapper {

    // 가입 동의 한 행. agreedAt은 동의했을 때만 값이 있다. now는 CREATED_AT.
    int insertSignupConsent(@Param("userId") long userId, @Param("consentTypeCode") String consentTypeCode,
            @Param("requiredYn") String requiredYn, @Param("agreedYn") String agreedYn, @Param("agreedAt") LocalDateTime agreedAt,
            @Param("now") LocalDateTime now);

    // 회원의 대안 데이터 동의 전부(철회·만료 이력 포함, 만든 순서).
    List<ConsentRow> selectAltConsents(@Param("userId") long userId);

    // 회원 본인의 대안 데이터 동의 하나. 다른 회원의 동의면 null.
    ConsentRow selectAltConsent(@Param("userId") long userId, @Param("consentId") long consentId);

    // 새 동의 한 행 — consentId에 만들어진 번호가 들어간다.
    int insertAltConsent(ConsentRow row);

    // [연결 해제] — 아직 철회하지 않은 동의만 WITHDRAWN_AT을 채운다.
    int withdraw(@Param("consentId") long consentId, @Param("now") LocalDateTime now);

    // 불러오기에 성공한(0건 포함) 동의에 가상 기관 동의 ID를 남긴다. 완료 현황이 이 값으로 '불러옴'을 판단한다.
    int markImported(@Param("consentId") long consentId, @Param("externalConsentId") String externalConsentId);
}
