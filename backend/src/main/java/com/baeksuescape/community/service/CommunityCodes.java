package com.baeksuescape.community.service;

import java.util.List;

// FP-191 신용 라운지 코드값 — DDL v0.3.2 BOARD_POST·BOARD_COMMENT·BOARD_POST_LOG·CONTENT_REPORT의 CHECK 값과 같다.
public final class CommunityCodes {

    private CommunityCodes() {
    }

    // 신고 대상 종류
    public static final String POST = "POST";
    public static final String COMMENT = "COMMENT";

    // 글 카테고리(FP-261, DDL C15 CK_BPT_CATEGORY와 같다). 고르지 않으면 자유로 저장한다.
    public static final String CATEGORY_FREE = "FREE";
    public static final String CATEGORY_PATTERN = "CREDIT_SCORE|LOAN|CARD|EMPLOYEE|SELF_EMPLOYED|FREELANCER|" + CATEGORY_FREE;

    // 글·댓글 상태
    public static final String VISIBLE = "VISIBLE";
    public static final String HIDDEN = "HIDDEN_BY_REPORT";
    public static final String DELETED = "DELETED";

    // 글 기록(BOARD_POST_LOG) 동작·처리자
    public static final String ACTION_CREATE = "CREATE";
    public static final String ACTION_UPDATE = "UPDATE";
    public static final String ACTION_DELETE = "DELETE";
    public static final String ACTION_HIDE = "HIDE";
    public static final String ACTION_RESTORE = "RESTORE";
    public static final String ACTOR_USER = "USER";
    public static final String ACTOR_ADMIN = "ADMIN";
    public static final String ACTOR_SYSTEM = "SYSTEM";

    // 신고 상태·처리 결과
    public static final String REPORT_RECEIVED = "RECEIVED";
    public static final String REPORT_IN_REVIEW = "IN_REVIEW";
    public static final String REPORT_DONE = "DONE";
    public static final String REPORT_REJECTED = "REJECTED";
    // 숨김 유지 — FP-224부터 새 처리에는 쓰지 않는다. 이전 처리 기록(CONTENT_REPORT.RESULT_CODE)에 남아 있어 값은 지우지 않는다.
    public static final String RESULT_KEEP_HIDDEN = "KEEP_HIDDEN";
    public static final String RESULT_DELETE = "DELETE";
    public static final String RESULT_REJECT = "REJECT";

    // 신고 사유 5개(N-33-1). 상세 내용은 '기타'일 때만 받는다.
    public static final String REASON_OTHER = "OTHER";
    public static final List<String> REASONS = List.of("ABUSE", "SPAM", "PRIVACY_EXPOSURE", "FALSE_INFO", REASON_OTHER);

    // 탈퇴 회원의 글·댓글은 그대로 두고 작성자만 이렇게 보여 준다(11/12 결정).
    public static final String WITHDRAWN_NAME = "탈퇴한 회원";
}
