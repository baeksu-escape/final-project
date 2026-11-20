package com.baeksuescape.admin.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.admin.dto.AdminStatsRows;

// FP-161 N-26 관리자 직군·연령별 통계(ADM-03) 조회. 서비스 회원 평가만 쓰고 탈퇴 회원은 뺀다(D-26·D-28 담당자 결정 11/20).
@Mapper
public interface AdminStatsMapper {

    // 회원마다 가장 최근 SCORED 서비스 평가 1건(탈퇴 회원 제외)
    List<AdminStatsRows.MemberScore> selectLatestScoredMembers();

    // 가입 회원 수: 일반 회원(ROLE_USER) 중 탈퇴 제외
    long selectRegisteredMemberCount();

    // from 이후 저장된 서비스 SCORED 평가 수(탈퇴 회원 제외)
    long selectScoredCountSince(@Param("from") LocalDateTime from);
}
