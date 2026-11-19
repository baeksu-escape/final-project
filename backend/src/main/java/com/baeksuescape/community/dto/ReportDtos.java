package com.baeksuescape.community.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

// FP-191 N-33 신고 접수(COMM-07)와 N-34 관리자 신고 접수(ADM-11~13) 요청·응답.
// reasonCounts는 사유 5개를 늘 같은 순서(ABUSE, SPAM, PRIVACY_EXPOSURE, FALSE_INFO, OTHER)로 0건까지 담는다.
public final class ReportDtos {

    private ReportDtos() {
    }

    // COMM-07 신고 접수. detailText는 reasonCode가 OTHER일 때만 저장한다.
    public record ReportCreate(
            @NotBlank(message = "신고 대상을 골라 주세요.") @Pattern(regexp = "POST|COMMENT", message = "신고 대상이 올바르지 않습니다.") String targetType,
            @NotNull(message = "신고 대상을 골라 주세요.") @Positive(message = "신고 대상이 올바르지 않습니다.") Long targetId,
            @NotBlank(message = "신고 사유를 골라 주세요.")
            @Pattern(regexp = "ABUSE|SPAM|PRIVACY_EXPOSURE|FALSE_INFO|OTHER", message = "신고 사유가 올바르지 않습니다.") String reasonCode,
            @Size(max = 500, message = "상세 내용은 500자까지 쓸 수 있습니다.") String detailText) {
    }

    // targetHidden: 이 신고로(또는 이미) 대상이 숨김 상태인지
    public record ReportCreated(Long reportId, boolean targetHidden) {
    }

    // ADM-11 같은 대상의 신고 묶음 한 줄. reportId는 그 묶음의 가장 최근 신고 번호(상세·처리에 쓴다).
    // targetId: 글이면 글 번호, 댓글이면 댓글 번호. parentPostId: 댓글의 원래 글 번호(글이면 null).
    public record ReportGroup(Long reportId, String targetType, Long targetId, Long parentPostId, String targetText, String targetStatus,
            int reportCount, Map<String, Integer> reasonCounts, String statusCode, LocalDateTime lastReportedAt) {
    }

    // ADM-11 목록. pendingCount: 미처리 신고가 있는 대상 수(필터와 무관), autoHideCount: 지금 자동 숨김 기준(건)
    public record ReportList(int pendingCount, int autoHideCount, List<ReportGroup> items) {
    }

    // ADM-12 신고 한 건. reporter는 가린 닉네임
    public record ReportLine(Long reportId, String reporter, String reasonCode, String detailText, String statusCode, String resultCode,
            String handlerMemo, LocalDateTime reportedAt, LocalDateTime handledAt) {
    }

    // ADM-12 신고 상세 — 대상 원문과 작성자 닉네임, 사유별 건수, 그 대상의 신고 전체
    public record ReportDetail(Long reportId, String targetType, Long targetId, Long parentPostId, String targetStatus, String title,
            String content, String authorNickname, int reportCount, Map<String, Integer> reasonCounts, List<ReportLine> reports) {
    }

    // ADM-13 처리 결과 저장 — FP-224: 새 처리는 삭제(DELETE)·반려(REJECT)만 받는다. 숨김 유지(KEEP_HIDDEN)는 400이다(이전 기록은 DB에 그대로 남는다).
    public record ReportProcess(
            @NotBlank(message = "처리 결과를 골라 주세요.")
            @Pattern(regexp = "DELETE|REJECT", message = "처리 결과는 삭제·반려 중에서 골라 주세요.") String resultCode,
            @Size(max = 500, message = "처리 메모는 500자까지 쓸 수 있습니다.") String memo) {
    }

    // handledCount: 이번에 함께 처리된 신고 수, targetStatus: 처리 후 대상 상태
    public record ReportProcessed(String resultCode, String targetStatus, int handledCount) {
    }
}
