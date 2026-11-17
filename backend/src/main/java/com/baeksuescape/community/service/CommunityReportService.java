package com.baeksuescape.community.service;

import static com.baeksuescape.community.service.CommunityCodes.ACTION_HIDE;
import static com.baeksuescape.community.service.CommunityCodes.ACTOR_SYSTEM;
import static com.baeksuescape.community.service.CommunityCodes.DELETED;
import static com.baeksuescape.community.service.CommunityCodes.HIDDEN;
import static com.baeksuescape.community.service.CommunityCodes.POST;
import static com.baeksuescape.community.service.CommunityCodes.REASON_OTHER;
import static com.baeksuescape.community.service.CommunityCodes.VISIBLE;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.admin.service.AppSettingService;
import com.baeksuescape.admin.service.EditableSettings;
import com.baeksuescape.community.dto.ContentTarget;
import com.baeksuescape.community.dto.NewReport;
import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.mapper.ReportMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-193 N-33 글·댓글 신고 — 신고 접수(N-33-1)와 기준 건수 자동 숨김(N-33-2).
// 작성자가 아니라 글·댓글 자체를 신고한다. 기준·하루 횟수는 APP_SETTING 값을 읽는다.
@Service
public class CommunityReportService {

    // APP_SETTING에 값이 없을 때 쓰는 기본값(DDL 시드 값과 같다)
    public static final int DEFAULT_AUTO_HIDE_COUNT = 5;
    public static final int DEFAULT_DAILY_LIMIT = 3;

    private final ReportMapper reportMapper;
    private final ContentStatusService contentStatus;
    private final AppSettingService settings;
    private final Clock clock;

    public CommunityReportService(ReportMapper reportMapper, ContentStatusService contentStatus, AppSettingService settings, Clock clock) {
        this.reportMapper = reportMapper;
        this.contentStatus = contentStatus;
        this.settings = settings;
        this.clock = clock;
    }

    // N-33-1 신고 접수 → N-33-2 미처리 신고가 기준 건수 이상이면 대상을 숨긴다.
    // 오류: 대상 없음·삭제 404, 본인 글 409, 중복 신고 409, 하루 횟수 초과 429
    @Transactional
    public ReportDtos.ReportCreated submit(long reporterUserId, ReportDtos.ReportCreate request) {
        String targetType = request.targetType();
        long targetId = request.targetId();
        ContentTarget target = contentStatus.find(targetType, targetId);
        if (target == null || DELETED.equals(target.statusCode())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TARGET_NOT_FOUND", "신고할 글·댓글을 찾을 수 없습니다.");
        }
        if (Objects.equals(target.ownerUserId(), reporterUserId)) {
            throw new ApiException(HttpStatus.CONFLICT, "OWN_CONTENT", "내가 쓴 글·댓글은 신고할 수 없습니다.");
        }
        if (reportMapper.countByReporterAndTarget(reporterUserId, targetType, targetId) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_REPORT", "이미 신고한 글·댓글입니다.");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        int dailyLimit = settings.intValue(EditableSettings.REPORT_DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
        if (reportMapper.countByReporterSince(reporterUserId, now.toLocalDate().atStartOfDay()) >= dailyLimit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "DAILY_LIMIT_EXCEEDED", "신고는 하루 " + dailyLimit + "번까지 할 수 있습니다.");
        }

        NewReport report = new NewReport();
        report.setTargetTypeCode(targetType);
        report.setPostId(POST.equals(targetType) ? targetId : null);
        report.setCommentId(POST.equals(targetType) ? null : targetId);
        report.setReporterUserId(reporterUserId);
        report.setReasonCode(request.reasonCode());
        report.setDetailText(REASON_OTHER.equals(request.reasonCode()) ? blankToNull(request.detailText()) : null);
        report.setReportedAt(now);
        reportMapper.insertReport(report);

        boolean hidden = HIDDEN.equals(target.statusCode());
        int autoHideCount = settings.intValue(EditableSettings.REPORT_AUTO_HIDE_COUNT, DEFAULT_AUTO_HIDE_COUNT);
        if (VISIBLE.equals(target.statusCode()) && reportMapper.countOpenByTarget(targetType, targetId) >= autoHideCount) {
            hidden = contentStatus.change(targetType, targetId, VISIBLE, HIDDEN, ACTION_HIDE, ACTOR_SYSTEM, null, report.getReportId(), now);
        }
        return new ReportDtos.ReportCreated(report.getReportId(), hidden);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
