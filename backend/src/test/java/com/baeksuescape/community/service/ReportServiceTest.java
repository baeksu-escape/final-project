package com.baeksuescape.community.service;

import static com.baeksuescape.community.service.BoardServiceTest.CLOCK;
import static com.baeksuescape.community.service.BoardServiceTest.ME;
import static com.baeksuescape.community.service.BoardServiceTest.NOW;
import static com.baeksuescape.community.service.BoardServiceTest.OTHER;
import static com.baeksuescape.community.service.BoardServiceTest.post;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.baeksuescape.admin.setting.AppSettingService;
import com.baeksuescape.community.dto.CommentRow;
import com.baeksuescape.community.dto.NewReport;
import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.mapper.BoardMapper;
import com.baeksuescape.community.mapper.ReportMapper;
import com.baeksuescape.global.exception.ApiException;

// FP-193 N-33 신고 규칙 — 신고 접수(N-33-1: 본인 글·중복·하루 3번·기타만 상세)와 기준 건수 자동 숨김(N-33-2: 기준 5건, 글·댓글 각각).
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportServiceTest {

    @Mock
    private BoardMapper boardMapper;
    @Mock
    private ReportMapper reportMapper;
    @Mock
    private AppSettingService settings;

    private ReportService service;

    @BeforeEach
    void setUp() {
        service = new ReportService(reportMapper, new ContentStatusService(boardMapper), settings, CLOCK);
        given(settings.intValue("REPORT_DAILY_LIMIT", 3)).willReturn(3);
        given(settings.intValue("REPORT_AUTO_HIDE_COUNT", 5)).willReturn(5);
        given(boardMapper.selectPost(1L)).willReturn(post(1, OTHER, "VISIBLE"));
        willAnswer(invocation -> {
            invocation.<NewReport>getArgument(0).setReportId(100L);
            return 1;
        }).given(reportMapper).insertReport(any());
    }

    private static ReportDtos.ReportCreate reportPost(long postId, String reason, String detail) {
        return new ReportDtos.ReportCreate("POST", postId, reason, detail);
    }

    private void assertError(Runnable call, int status, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus().value()).isEqualTo(status);
            assertThat(e.getCode()).isEqualTo(code);
        });
        verify(reportMapper, never()).insertReport(any());
    }

    @Test
    void 본인이_쓴_글은_신고할_수_없다() {
        given(boardMapper.selectPost(2L)).willReturn(post(2, ME, "VISIBLE"));
        assertError(() -> service.submit(ME, reportPost(2L, "SPAM", null)), 409, "OWN_CONTENT");
    }

    @Test
    void 같은_사용자가_같은_대상을_중복_신고할_수_없다() {
        given(reportMapper.countByReporterAndTarget(ME, "POST", 1L)).willReturn(1);
        assertError(() -> service.submit(ME, reportPost(1L, "SPAM", null)), 409, "DUPLICATE_REPORT");
    }

    @Test
    void 하루_3번을_넘게_신고할_수_없다() {
        given(reportMapper.countByReporterSince(ME, LocalDateTime.of(2026, 11, 15, 0, 0))).willReturn(3);
        assertError(() -> service.submit(ME, reportPost(1L, "SPAM", null)), 429, "DAILY_LIMIT_EXCEEDED");
    }

    @Test
    void 없거나_삭제된_대상은_신고할_수_없다() {
        given(boardMapper.selectPost(3L)).willReturn(post(3, OTHER, "DELETED"));
        assertError(() -> service.submit(ME, reportPost(3L, "SPAM", null)), 404, "TARGET_NOT_FOUND");
        assertError(() -> service.submit(ME, reportPost(99L, "SPAM", null)), 404, "TARGET_NOT_FOUND");
    }

    @Test
    void 상세_내용은_기타일_때만_저장한다() {
        ArgumentCaptor<NewReport> saved = ArgumentCaptor.forClass(NewReport.class);

        service.submit(ME, reportPost(1L, "SPAM", "광고 링크가 있어요"));
        service.submit(ME, reportPost(1L, "OTHER", "  도배 같아요  "));

        verify(reportMapper, times(2)).insertReport(saved.capture());
        assertThat(saved.getAllValues().get(0).getDetailText()).isNull();
        assertThat(saved.getAllValues().get(1).getDetailText()).isEqualTo("도배 같아요");
        assertThat(saved.getAllValues().get(1).getPostId()).isEqualTo(1L);
        assertThat(saved.getAllValues().get(1).getCommentId()).isNull();
        assertThat(saved.getAllValues().get(1).getReportedAt()).isEqualTo(NOW);
    }

    @Test
    void 미처리_신고가_4건이면_숨기지_않는다() {
        given(reportMapper.countOpenByTarget("POST", 1L)).willReturn(4);

        ReportDtos.ReportCreated created = service.submit(ME, reportPost(1L, "ABUSE", null));

        assertThat(created.reportId()).isEqualTo(100L);
        assertThat(created.targetHidden()).isFalse();
        verify(boardMapper, never()).updatePostStatus(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void 미처리_신고가_기준_5건이_되면_글을_자동으로_숨기고_SYSTEM_기록을_남긴다() {
        given(reportMapper.countOpenByTarget("POST", 1L)).willReturn(5);
        given(boardMapper.updatePostStatus(1L, "VISIBLE", "HIDDEN_BY_REPORT", NOW)).willReturn(1);

        ReportDtos.ReportCreated created = service.submit(ME, reportPost(1L, "ABUSE", null));

        assertThat(created.targetHidden()).isTrue();
        verify(boardMapper).insertPostLog(1L, "HIDE", "SYSTEM", null, "VISIBLE", "HIDDEN_BY_REPORT", 100L, NOW);
    }

    @Test
    void 댓글은_따로_세어_숨기고_글_기록은_남기지_않는다() {
        CommentRow comment = new CommentRow();
        comment.setCommentId(9L);
        comment.setPostId(1L);
        comment.setUserId(OTHER);
        comment.setStatusCode("VISIBLE");
        given(boardMapper.selectComment(9L)).willReturn(comment);
        given(reportMapper.countOpenByTarget("COMMENT", 9L)).willReturn(5);
        given(boardMapper.updateCommentStatus(9L, "VISIBLE", "HIDDEN_BY_REPORT", NOW)).willReturn(1);

        ReportDtos.ReportCreated created = service.submit(ME, new ReportDtos.ReportCreate("COMMENT", 9L, "ABUSE", null));

        assertThat(created.targetHidden()).isTrue();
        verify(boardMapper, never()).insertPostLog(anyLong(), anyString(), anyString(), any(), any(), anyString(), any(), any());
    }

    @Test
    void 관리자가_바꾼_숨김_기준을_따른다() {
        given(settings.intValue("REPORT_AUTO_HIDE_COUNT", 5)).willReturn(3);
        given(reportMapper.countOpenByTarget("POST", 1L)).willReturn(3);
        given(boardMapper.updatePostStatus(1L, "VISIBLE", "HIDDEN_BY_REPORT", NOW)).willReturn(1);

        assertThat(service.submit(ME, reportPost(1L, "SPAM", null)).targetHidden()).isTrue();
    }
}
