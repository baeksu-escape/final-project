package com.baeksuescape.admin.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.user.dto.UserAccount;

// FP-80 N-27 계정·권한 관리(ADM-05·06·07)와 관리자 비밀번호(첫 로그인·임시 비밀번호·변경). SQL은 resources/mapper/admin/AdminAccountMapper.xml.
@Mapper
public interface AdminAccountMapper {

    // ADM-05 계정 목록. qLike는 '%검색어%'(LIKE 특수문자는 서비스가 \로 막는다), role·status가 null이면 거르지 않는다.
    // includeWithdrawn이 false면 탈퇴 계정을 뺀다(상태를 고르지 않았을 때의 기본).
    List<AdminRows.UserData> selectUsers(@Param("qLike") String qLike, @Param("role") String role, @Param("status") String status,
            @Param("includeWithdrawn") boolean includeWithdrawn, @Param("offset") int offset, @Param("size") int size);

    long countUsers(@Param("qLike") String qLike, @Param("role") String role, @Param("status") String status,
            @Param("includeWithdrawn") boolean includeWithdrawn);

    // 계정 한 줄(목록과 같은 모양). 없으면 null.
    AdminRows.UserData selectUser(@Param("userId") long userId);

    // ADM-06 잠금 — LOCKED, 사유, 잠근 시각. 탈퇴 계정은 바꾸지 않는다. 바뀐 행 수.
    int updateLocked(@Param("userId") long userId, @Param("reason") String reason, @Param("now") LocalDateTime now);

    // ADM-06 해제 — ACTIVE, 실패 횟수 0, 사유·잠근 시각 NULL. 탈퇴 계정은 바꾸지 않는다.
    int updateUnlocked(@Param("userId") long userId, @Param("now") LocalDateTime now);

    // ADM-07 관리자 계정 저장(ROLE_ADMIN, 출생연도·휴대폰 NULL, 비밀번호 변경 필요 'Y'). 저장한 USER_ID를 account.userId에 채운다.
    int insertAdmin(UserAccount account);

    // 임시 비밀번호 재발급 — 새 해시, 변경 필요 'Y', 잠겼으면 ACTIVE·실패 횟수 0. 관리자·탈퇴 아닌 계정만.
    int updateTemporaryPassword(@Param("userId") long userId, @Param("passwordHash") String passwordHash, @Param("now") LocalDateTime now);

    // 관리자 비밀번호 변경(첫 로그인 설정·내 비밀번호 변경) — 새 해시, 변경 필요 'N'.
    int updatePasswordChanged(@Param("userId") long userId, @Param("passwordHash") String passwordHash, @Param("now") LocalDateTime now);

    // PASSWORD_CHANGE_REQUIRED_YN. 계정이 없으면 null.
    String selectPasswordChangeRequired(@Param("userId") long userId);
}
