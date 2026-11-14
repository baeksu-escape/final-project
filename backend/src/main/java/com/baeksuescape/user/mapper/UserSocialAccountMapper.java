package com.baeksuescape.user.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// FP-87 N-01-6 간편 로그인 연결(USER_SOCIAL_ACCOUNT). PROVIDER_CODE는 GOOGLE·KAKAO·NAVER.
@Mapper
public interface UserSocialAccountMapper {

    // 제공자 사용자에 연결된 USER_ID. 없으면 null.
    Long selectUserId(@Param("providerCode") String providerCode, @Param("providerUserId") String providerUserId);

    // 이 계정이 같은 제공자에 이미 연결돼 있는지(UK_USA_USER_PROVIDER).
    int countByUserAndProvider(@Param("userId") long userId, @Param("providerCode") String providerCode);

    int insertLink(@Param("userId") long userId, @Param("providerCode") String providerCode, @Param("providerUserId") String providerUserId);
}
