package com.baeksuescape.user.mapper;

import java.time.LocalDateTime;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// FP-87 N-02-2 가입 동의 저장(USER_CONSENT). 대안 데이터 동의(ALT_DATA_PROVISION)는 데이터 입력 작업에서 다룬다.
@Mapper
public interface UserConsentMapper {

    // 가입 동의 한 행. agreedAt은 동의했을 때만 값이 있다. now는 CREATED_AT.
    int insertSignupConsent(@Param("userId") long userId, @Param("consentTypeCode") String consentTypeCode,
            @Param("requiredYn") String requiredYn, @Param("agreedYn") String agreedYn, @Param("agreedAt") LocalDateTime agreedAt,
            @Param("now") LocalDateTime now);
}
