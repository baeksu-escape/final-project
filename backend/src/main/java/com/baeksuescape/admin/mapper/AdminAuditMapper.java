package com.baeksuescape.admin.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.admin.dto.AdminRows;
import com.baeksuescape.user.dto.DataInputRows.CreditRow;

// FP-80 N-35 회원 정보 열람(ADM-08)과 N-28 로그 조회(ADM-09·10). SQL은 resources/mapper/admin/AdminAuditMapper.xml.
// 감사 로그·시스템 로그는 수정·삭제 금지라 INSERT·SELECT만 둔다.
@Mapper
public interface AdminAuditMapper {

    // N-35-2 열람 기록. 데이터를 읽기 전에 먼저 저장한다.
    int insertAccessAudit(@Param("viewerUserId") long viewerUserId, @Param("targetUserId") long targetUserId, @Param("reason") String reason,
            @Param("resource") String resource, @Param("clientIp") String clientIp, @Param("now") LocalDateTime now);

    // ADM-08 회원의 가장 최근 평가. 없으면 null.
    AdminRows.AssessmentData selectLatestAssessment(@Param("userId") long userId);

    // ADM-08 회원의 가장 최근 카드·신용 행(BASE_DATE 기준). 없으면 null.
    CreditRow selectLatestCreditProfile(@Param("userId") long userId);

    // ADM-08 대안 데이터 종류별 불러온 개월 수.
    AdminRows.AltMonths selectAltMonths(@Param("userId") long userId);

    // ADM-09 열람 감사 로그(최신순)
    List<AdminRows.AccessLogData> selectAccessLogs(@Param("offset") int offset, @Param("size") int size);

    long countAccessLogs();

    // ADM-10 시스템 로그(최신순). type이 null이면 전부.
    List<AdminRows.SystemLogData> selectSystemLogs(@Param("type") String type, @Param("offset") int offset, @Param("size") int size);

    long countSystemLogs(@Param("type") String type);
}
