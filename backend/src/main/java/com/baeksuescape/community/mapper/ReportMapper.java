package com.baeksuescape.community.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.community.dto.NewReport;
import com.baeksuescape.community.dto.ReportRow;

// FP-191 N-33 신고 접수·N-34 관리자 신고 처리 (CONTENT_REPORT, DDL v0.3.2). targetType은 POST 또는 COMMENT.
@Mapper
public interface ReportMapper {

    // N-33-1 같은 사용자가 같은 대상을 신고한 적이 있는지(상태와 상관없이)
    int countByReporterAndTarget(@Param("reporterUserId") long reporterUserId, @Param("targetType") String targetType,
            @Param("targetId") long targetId);

    // N-33-1 하루 신고 횟수: since(오늘 0시) 이후 이 사용자의 신고 수
    int countByReporterSince(@Param("reporterUserId") long reporterUserId, @Param("since") LocalDateTime since);

    // 신고 저장(상태 RECEIVED). 저장하면 report.reportId에 새 번호가 채워진다.
    int insertReport(NewReport report);

    // N-33-2 한 대상의 미처리 신고(RECEIVED·IN_REVIEW) 수
    int countOpenByTarget(@Param("targetType") String targetType, @Param("targetId") long targetId);

    // N-34-1 미처리 신고가 있는 대상 수
    int countOpenTargets();

    // N-34-1 필터에 맞는 신고 전체(최근순). 값이 null인 필터는 쓰지 않는다. toAt은 그 시각 미만.
    List<ReportRow> selectReports(@Param("statusCode") String statusCode, @Param("reasonCode") String reasonCode,
            @Param("fromAt") LocalDateTime fromAt, @Param("toAt") LocalDateTime toAt);

    // 신고 한 건. 없으면 null
    ReportRow selectReport(@Param("reportId") long reportId);

    // N-34-2 한 대상의 신고 전체(최근순)
    List<ReportRow> selectReportsByTarget(@Param("targetType") String targetType, @Param("targetId") long targetId);

    // N-34-3 한 대상의 미처리 신고를 모두 처리 완료·반려로 닫는다. 닫은 건수를 돌려준다.
    int closeOpenReports(@Param("targetType") String targetType, @Param("targetId") long targetId, @Param("statusCode") String statusCode,
            @Param("resultCode") String resultCode, @Param("handlerUserId") long handlerUserId, @Param("memo") String memo,
            @Param("now") LocalDateTime now);

    // D-23 FP-301 사용 안 함(2차 개발 뒤 정리). 단일 신고 조회 메서드 이름은 유지한다.
    long selectReporterUserId(@Param("reportId") long reportId);

    // D-23 FP-301 처리 대상의 미처리 신고자 회원 ID를 중복 없이 조회한다.
    List<Long> selectOpenReporterUserIds(@Param("targetType") String targetType, @Param("targetId") long targetId);

    // N-34-3 처리할 신고 번호와 알림을 받을 신고자 번호를 함께 조회한다.
    List<PendingReport> selectPendingReports(@Param("targetType") String targetType, @Param("targetId") long targetId);

    // N-34-3 조회한 신고 한 건이 아직 미처리일 때만 닫는다.
    int closeOpenReport(@Param("reportId") long reportId, @Param("statusCode") String statusCode,
            @Param("resultCode") String resultCode, @Param("handlerUserId") long handlerUserId,
            @Param("memo") String memo, @Param("now") LocalDateTime now);

    // N-34-3 신고 처리와 알림에 같은 조회 결과를 사용한다.
    record PendingReport(long reportId, Long reporterUserId) {}
}
