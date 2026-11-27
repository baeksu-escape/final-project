package com.baeksuescape.community.service;

import static com.baeksuescape.community.service.BoardServiceTest.CLOCK;
import static com.baeksuescape.community.service.BoardServiceTest.NOW;
import static com.baeksuescape.community.service.BoardServiceTest.OTHER;
import static com.baeksuescape.community.service.BoardServiceTest.post;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.admin.service.AppSettingService;
import com.baeksuescape.community.dto.CommentRow;
import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.dto.ReportRow;
import com.baeksuescape.community.mapper.BoardMapper;
import com.baeksuescape.community.mapper.ReportMapper;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.notification.service.NotificationService;

// FP-193 N-34 관리자 신고 처리 — 대상별로 묶은 목록(N-34-1), 신고자 가림(N-34-2), 숨김 유지·삭제·반려(N-34-3).
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminReportServiceTest {

    static final long ADMIN = 1L;

    @Mock
    private BoardMapper boardMapper;
    @Mock
    private ReportMapper reportMapper;
    @Mock
    private AppSettingService settings;
    @Mock
    private NotificationService notificationService;

    private AdminReportService service;

    @BeforeEach
    void setUp() {
        service = new AdminReportService(reportMapper, new ContentStatusService(boardMapper), settings, CLOCK, notificationService);
        given(settings.intValue("REPORT_AUTO_HIDE_COUNT", 5)).willReturn(5);
        given(reportMapper.selectOpenReporterUserIds(anyString(), anyLong())).willReturn(List.of(9L));
    }

    private static ReportRow report(long reportId, String type, long targetId, String reason, String status, String targetStatus,
            LocalDateTime reportedAt) {
        ReportRow row = new ReportRow();
        row.setReportId(reportId);
        row.setTargetTypeCode(type);
        if ("POST".equals(type)) row.setPostId(targetId);
        else row.setCommentId(targetId);
        row.setReasonCode(reason);
        row.setStatusCode(status);
        row.setTargetStatusCode(targetStatus);
        row.setReportedAt(reportedAt);
        row.setReporterNickname("신고자닉");
        row.setReporterWithdrawn("N");
        return row;
    }

    private void assertError(Runnable call, int status, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus().value()).isEqualTo(status);
            assertThat(e.getCode()).isEqualTo(code);
        });
    }

    @Test
    void 같은_대상의_신고를_묶고_숨김_대상을_먼저_보여_준다() {
        given(reportMapper.selectReports(null, null, LocalDateTime.of(2026, 11, 1, 0, 0), LocalDateTime.of(2026, 11, 16, 0, 0)))
                .willReturn(List.of(
                        report(12, "POST", 1, "SPAM", "RECEIVED", "VISIBLE", NOW),
                        report(11, "POST", 1, "ABUSE", "RECEIVED", "VISIBLE", NOW.minusHours(1)),
                        report(5, "COMMENT", 9, "ABUSE", "RECEIVED", "HIDDEN_BY_REPORT", NOW.minusDays(1))));
        given(reportMapper.countOpenTargets()).willReturn(2);

        ReportDtos.ReportList list = service.list(" ", "", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 15));

        assertThat(list.pendingCount()).isEqualTo(2);
        assertThat(list.autoHideCount()).isEqualTo(5);
        assertThat(list.items()).extracting(ReportDtos.ReportGroup::targetType).containsExactly("COMMENT", "POST");
        ReportDtos.ReportGroup postGroup = list.items().get(1);
        assertThat(postGroup.reportId()).isEqualTo(12L);
        assertThat(postGroup.targetId()).isEqualTo(1L);
        assertThat(postGroup.reportCount()).isEqualTo(2);
        assertThat(postGroup.reasonCounts()).containsExactly(entry("ABUSE", 1), entry("SPAM", 1), entry("PRIVACY_EXPOSURE", 0),
                entry("FALSE_INFO", 0), entry("OTHER", 0));
        assertThat(postGroup.statusCode()).isEqualTo("RECEIVED");
    }

    @Test
    void 상세는_원문과_작성자를_보여_주고_신고자는_가린다() {
        given(reportMapper.selectReport(12L)).willReturn(report(12, "POST", 1, "SPAM", "RECEIVED", "VISIBLE", NOW));
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "VISIBLE"));
        ReportRow withdrawn = report(11, "POST", 1, "ABUSE", "RECEIVED", "VISIBLE", NOW.minusHours(1));
        withdrawn.setReporterWithdrawn("Y");
        given(reportMapper.selectReportsByTarget("POST", 1L))
                .willReturn(List.of(report(12, "POST", 1, "SPAM", "RECEIVED", "VISIBLE", NOW), withdrawn));

        ReportDtos.ReportDetail detail = service.detail(12L);

        assertThat(detail.title()).isEqualTo("제목1");
        assertThat(detail.content()).isEqualTo("내용1");
        assertThat(detail.authorNickname()).isEqualTo("닉네임");
        assertThat(detail.reportCount()).isEqualTo(2);
        assertThat(detail.reports()).extracting(ReportDtos.ReportLine::reporter).containsExactly("신**닉", "탈퇴한 회원");
    }

    @Test
    void 반려하면_숨김을_풀고_미처리_신고를_모두_반려로_닫는다() {
        given(reportMapper.selectReport(12L)).willReturn(report(12, "POST", 1, "SPAM", "RECEIVED", "HIDDEN_BY_REPORT", NOW));
        given(reportMapper.selectOpenReporterUserIds("POST", 1L)).willReturn(List.of(9L, 10L));
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "HIDDEN_BY_REPORT"));
        given(reportMapper.countOpenByTarget("POST", 1L)).willReturn(5);
        given(boardMapper.updatePostStatus(1L, "HIDDEN_BY_REPORT", "VISIBLE", NOW)).willReturn(1);
        given(reportMapper.closeOpenReports("POST", 1L, "REJECTED", "REJECT", ADMIN, "문제없음", NOW)).willReturn(5);

        ReportDtos.ReportProcessed result = service.process(ADMIN, 12L, new ReportDtos.ReportProcess("REJECT", " 문제없음 "));

        assertThat(result.targetStatus()).isEqualTo("VISIBLE");
        assertThat(result.handledCount()).isEqualTo(5);
        verify(boardMapper).insertPostLog(1L, "RESTORE", "ADMIN", ADMIN, "HIDDEN_BY_REPORT", "VISIBLE", 12L, NOW);
        verify(notificationService).notifyQuietly(9L, "REPORT_RESULT", "신고 처리 결과가 있어요",
                "신고하신 글은 운영 정책 위반이 아니라고 판단했어요.", "/lounge?post=1");
        verify(notificationService).notifyQuietly(10L, "REPORT_RESULT", "신고 처리 결과가 있어요",
                "신고하신 글은 운영 정책 위반이 아니라고 판단했어요.", "/lounge?post=1");
        verify(notificationService, never()).notifyQuietly(eq(OTHER), eq("REPORT_RESULT"), anyString(), anyString(), anyString());
    }

    // D-23 FP-301 신고자가 작성자이기도 하면 처리 결과·작성자 알림을 합쳐 한 건만 보낸다.
    @Test
    void 삭제하면_글을_지우고_처리_완료로_닫는다() {
        given(reportMapper.selectReport(12L)).willReturn(report(12, "POST", 1, "SPAM", "RECEIVED", "HIDDEN_BY_REPORT", NOW));
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "HIDDEN_BY_REPORT"));
        given(reportMapper.selectOpenReporterUserIds("POST", 1L)).willReturn(List.of(9L, OTHER));
        given(reportMapper.countOpenByTarget("POST", 1L)).willReturn(5);
        given(boardMapper.updatePostStatus(1L, "HIDDEN_BY_REPORT", "DELETED", NOW)).willReturn(1);

        ReportDtos.ReportProcessed result = service.process(ADMIN, 12L, new ReportDtos.ReportProcess("DELETE", null));

        assertThat(result.targetStatus()).isEqualTo("DELETED");
        verify(boardMapper).insertPostLog(1L, "DELETE", "ADMIN", ADMIN, "HIDDEN_BY_REPORT", "DELETED", 12L, NOW);
        verify(notificationService).notifyQuietly(9L, "REPORT_RESULT", "신고 처리 결과가 있어요",
                "신고하신 글이 운영 정책에 따라 삭제 처리됐어요.", "/lounge");

        verify(notificationService).notifyQuietly(OTHER, "REPORT_RESULT", "내 글이 운영 정책에 따라 삭제됐어요",
                "운영 정책에 따라 글이 삭제 처리됐어요.", "/lounge");
        verify(notificationService, never()).notifyQuietly(eq(OTHER), eq("REPORT_RESULT"), eq("신고 처리 결과가 있어요"),
                anyString(), anyString());
        verify(reportMapper).selectOpenReporterUserIds("POST", 1L);
        verify(reportMapper, never()).selectReporterUserId(anyLong());
        verify(reportMapper).closeOpenReports("POST", 1L, "DONE", "DELETE", ADMIN, null, NOW);
    }

    // FP-224: 숨김 유지가 빠져서, 아직 보이는 댓글을 관리자가 내리려면 삭제한다. 댓글은 기록 표가 없어 상태만 바뀐다.
    @Test
    void 아직_보이는_댓글도_삭제하면_지우고_처리_완료로_닫는다() {
        given(reportMapper.selectReport(5L)).willReturn(report(5, "COMMENT", 9, "ABUSE", "RECEIVED", "VISIBLE", NOW));
        CommentRow comment = new CommentRow();
        comment.setCommentId(9L);
        comment.setPostId(1L);
        comment.setUserId(OTHER);
        comment.setStatusCode("VISIBLE");
        given(boardMapper.selectComment(9L)).willReturn(comment);
        given(reportMapper.countOpenByTarget("COMMENT", 9L)).willReturn(1);
        given(boardMapper.updateCommentStatus(9L, "VISIBLE", "DELETED", NOW)).willReturn(1);

        ReportDtos.ReportProcessed result = service.process(ADMIN, 5L, new ReportDtos.ReportProcess("DELETE", null));

        assertThat(result.targetStatus()).isEqualTo("DELETED");
        verify(reportMapper).closeOpenReports("COMMENT", 9L, "DONE", "DELETE", ADMIN, null, NOW);
    }

    @Test
    void 이미_처리된_신고는_다시_처리할_수_없다() {
        given(reportMapper.selectReport(12L)).willReturn(report(12, "POST", 1, "SPAM", "DONE", "HIDDEN_BY_REPORT", NOW));
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "HIDDEN_BY_REPORT"));
        given(reportMapper.countOpenByTarget("POST", 1L)).willReturn(0);

        assertError(() -> service.process(ADMIN, 12L, new ReportDtos.ReportProcess("REJECT", null)), 409, "ALREADY_HANDLED");
        verify(boardMapper, never()).updatePostStatus(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 없는_신고는_404() {
        assertError(() -> service.detail(404L), 404, "REPORT_NOT_FOUND");
    }
}
