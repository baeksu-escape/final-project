package com.baeksuescape.community.service;

import static com.baeksuescape.community.service.CommunityCodes.ACTION_DELETE;
import static com.baeksuescape.community.service.CommunityCodes.ACTION_HIDE;
import static com.baeksuescape.community.service.CommunityCodes.ACTION_RESTORE;
import static com.baeksuescape.community.service.CommunityCodes.ACTOR_ADMIN;
import static com.baeksuescape.community.service.CommunityCodes.DELETED;
import static com.baeksuescape.community.service.CommunityCodes.HIDDEN;
import static com.baeksuescape.community.service.CommunityCodes.REASONS;
import static com.baeksuescape.community.service.CommunityCodes.REPORT_DONE;
import static com.baeksuescape.community.service.CommunityCodes.REPORT_IN_REVIEW;
import static com.baeksuescape.community.service.CommunityCodes.REPORT_RECEIVED;
import static com.baeksuescape.community.service.CommunityCodes.REPORT_REJECTED;
import static com.baeksuescape.community.service.CommunityCodes.RESULT_DELETE;
import static com.baeksuescape.community.service.CommunityCodes.RESULT_KEEP_HIDDEN;
import static com.baeksuescape.community.service.CommunityCodes.RESULT_REJECT;
import static com.baeksuescape.community.service.CommunityCodes.VISIBLE;
import static com.baeksuescape.community.service.CommunityCodes.WITHDRAWN_NAME;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.service.AppSettingService;
import com.baeksuescape.admin.service.EditableSettings;
import com.baeksuescape.community.dto.ContentTarget;
import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.dto.ReportRow;
import com.baeksuescape.community.mapper.ReportMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.util.PiiMasking;

// FP-193 N-34 신고 접수 게시판(관리자) — 같은 대상의 신고를 묶은 목록(N-34-1), 상세(N-34-2), 처리 결과 저장(N-34-3).
// 처리는 대상 단위다: 신고 한 건을 골라 처리하면 그 글·댓글의 미처리 신고가 모두 같은 결과로 닫힌다.
@Service
public class AdminReportService {

    private final ReportMapper reportMapper;
    private final ContentStatusService contentStatus;
    private final AppSettingService settings;
    private final Clock clock;

    public AdminReportService(ReportMapper reportMapper, ContentStatusService contentStatus, AppSettingService settings, Clock clock) {
        this.reportMapper = reportMapper;
        this.contentStatus = contentStatus;
        this.settings = settings;
        this.clock = clock;
    }

    // N-34-1 신고 목록 — 필터(상태·사유·기간, 모두 선택)에 맞는 신고를 대상별로 묶는다. 숨김 대상이 먼저, 그다음 최근 신고순.
    public ReportDtos.ReportList list(String statusCode, String reasonCode, LocalDate from, LocalDate to) {
        LocalDateTime fromAt = from == null ? null : from.atStartOfDay();
        LocalDateTime toAt = to == null ? null : to.plusDays(1).atStartOfDay();
        Map<String, List<ReportRow>> groups = new LinkedHashMap<>();
        for (ReportRow row : reportMapper.selectReports(blankToNull(statusCode), blankToNull(reasonCode), fromAt, toAt)) {
            groups.computeIfAbsent(row.getTargetTypeCode() + ":" + row.targetId(), key -> new ArrayList<>()).add(row);
        }
        List<ReportDtos.ReportGroup> items = groups.values().stream()
                .map(AdminReportService::toGroup)
                .sorted(Comparator.comparing((ReportDtos.ReportGroup group) -> !HIDDEN.equals(group.targetStatus()))
                        .thenComparing(ReportDtos.ReportGroup::lastReportedAt, Comparator.reverseOrder()))
                .toList();
        int autoHideCount = settings.intValue(EditableSettings.REPORT_AUTO_HIDE_COUNT, ReportService.DEFAULT_AUTO_HIDE_COUNT);
        return new ReportDtos.ReportList(reportMapper.countOpenTargets(), autoHideCount, items);
    }

    // N-34-2 신고 상세 — 대상 원문·작성자 닉네임, 사유별 건수, 그 대상의 신고 전체(신고자 닉네임은 가린다)
    public ReportDtos.ReportDetail detail(long reportId) {
        ReportRow report = requireReport(reportId);
        ContentTarget target = requireTarget(report);
        List<ReportRow> rows = reportMapper.selectReportsByTarget(target.targetType(), target.targetId());
        List<ReportDtos.ReportLine> lines = rows.stream()
                .map(row -> new ReportDtos.ReportLine(row.getReportId(), maskReporter(row), row.getReasonCode(), row.getDetailText(),
                        row.getStatusCode(), row.getResultCode(), row.getHandlerMemo(), row.getReportedAt(), row.getHandledAt()))
                .toList();
        return new ReportDtos.ReportDetail(reportId, target.targetType(), target.targetId(), target.parentPostId(), target.statusCode(),
                target.title(), target.content(), target.nickname(), rows.size(), reasonCounts(rows), lines);
    }

    // N-34-3 처리 결과 저장 — 숨김 유지·삭제는 대상에 반영하고, 반려는 숨김을 푼다. 처리자·시각·메모를 남긴다.
    // 알림(신고자·작성자)은 D-25에 따라 만들지 않는다.
    @Transactional
    public ReportDtos.ReportProcessed process(long adminUserId, long reportId, ReportDtos.ReportProcess request) {
        ReportRow report = requireReport(reportId);
        ContentTarget target = requireTarget(report);
        String type = target.targetType();
        long id = target.targetId();
        if (reportMapper.countOpenByTarget(type, id) == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_HANDLED", "이미 처리된 신고입니다.");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        String result = request.resultCode();
        String before = target.statusCode();
        String after = before;
        if (RESULT_KEEP_HIDDEN.equals(result) && VISIBLE.equals(before)) {
            after = HIDDEN;
            changeOrFail(type, id, before, after, ACTION_HIDE, adminUserId, reportId, now);
        } else if (RESULT_DELETE.equals(result) && !DELETED.equals(before)) {
            after = DELETED;
            changeOrFail(type, id, before, after, ACTION_DELETE, adminUserId, reportId, now);
        } else if (RESULT_REJECT.equals(result) && HIDDEN.equals(before)) {
            after = VISIBLE;
            changeOrFail(type, id, before, after, ACTION_RESTORE, adminUserId, reportId, now);
        }

        String reportStatus = RESULT_REJECT.equals(result) ? REPORT_REJECTED : REPORT_DONE;
        int handled = reportMapper.closeOpenReports(type, id, reportStatus, result, adminUserId, blankToNull(request.memo()), now);
        return new ReportDtos.ReportProcessed(result, after, handled);
    }

    // 같은 대상의 신고 묶음 하나. rows는 최근순이라 첫 줄이 가장 최근 신고다.
    private static ReportDtos.ReportGroup toGroup(List<ReportRow> rows) {
        ReportRow latest = rows.get(0);
        return new ReportDtos.ReportGroup(latest.getReportId(), latest.getTargetTypeCode(), latest.targetId(), latest.getParentPostId(),
                latest.getTargetText(), latest.getTargetStatusCode(), rows.size(), reasonCounts(rows), groupStatus(rows),
                latest.getReportedAt());
    }

    // 묶음의 상태: 미처리 신고가 하나라도 있으면 검토 중·접수, 없으면 가장 최근 신고의 상태
    private static String groupStatus(List<ReportRow> rows) {
        if (rows.stream().anyMatch(row -> REPORT_IN_REVIEW.equals(row.getStatusCode()))) return REPORT_IN_REVIEW;
        if (rows.stream().anyMatch(row -> REPORT_RECEIVED.equals(row.getStatusCode()))) return REPORT_RECEIVED;
        return rows.get(0).getStatusCode();
    }

    // 사유 5개를 같은 순서로, 0건까지 센다.
    private static Map<String, Integer> reasonCounts(List<ReportRow> rows) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        REASONS.forEach(reason -> counts.put(reason, 0));
        rows.forEach(row -> counts.merge(row.getReasonCode(), 1, Integer::sum));
        return counts;
    }

    // 신고자는 가린 닉네임으로 보여 준다(N-34-2). 탈퇴 회원은 '탈퇴한 회원'
    private static String maskReporter(ReportRow row) {
        return "Y".equals(row.getReporterWithdrawn()) ? WITHDRAWN_NAME : PiiMasking.name(row.getReporterNickname());
    }

    private void changeOrFail(String type, long id, String before, String after, String action, long adminUserId, long reportId,
            LocalDateTime now) {
        if (!contentStatus.change(type, id, before, after, action, ACTOR_ADMIN, adminUserId, reportId, now)) {
            throw new ApiException(HttpStatus.CONFLICT, "STATUS_CHANGED", "대상 상태가 바뀌었습니다. 새로고침한 뒤 다시 처리해 주세요.");
        }
    }

    private ReportRow requireReport(long reportId) {
        ReportRow report = reportMapper.selectReport(reportId);
        if (report == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "신고를 찾을 수 없습니다.");
        }
        return report;
    }

    private ContentTarget requireTarget(ReportRow report) {
        ContentTarget target = contentStatus.find(report.getTargetTypeCode(), report.targetId());
        if (target == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TARGET_NOT_FOUND", "신고 대상을 찾을 수 없습니다.");
        }
        return target;
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
