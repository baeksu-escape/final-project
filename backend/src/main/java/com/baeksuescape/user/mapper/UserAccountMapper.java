package com.baeksuescape.user.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// FP-87 인증 필터가 쓰는 APP_USER 조회. SQL은 resources/mapper/user/UserAccountMapper.xml에 있다.
@Mapper
public interface UserAccountMapper {

    // 계정 상태(ACTIVE·LOCKED·WITHDRAWN)를 돌려준다. 회원이 없으면 null.
    String selectAccountStatus(@Param("userId") long userId);
}
