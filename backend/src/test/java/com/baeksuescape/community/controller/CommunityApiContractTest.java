package com.baeksuescape.community.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.admin.service.AppSettingService;
import com.baeksuescape.admin.dto.SettingDtos;
import com.baeksuescape.community.dto.BoardDtos;
import com.baeksuescape.community.dto.ReportDtos;
import com.baeksuescape.community.service.AdminReportService;
import com.baeksuescape.community.service.BoardService;
import com.baeksuescape.community.service.CommunityReportService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-191 신용 라운지 API 계약 — 경로·권한·상태 코드·JSON 키가 API 정의서 v0.2(COMM-01~07, ADM-11~14)와 같은지 본다.
// 서비스는 mock으로 대신하고, 보안 필터·입력 검증·오류 처리는 실제로 탄다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommunityApiContractTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private BoardService boardService;
    @MockBean
    private CommunityReportService reportService;
    @MockBean
    private AdminReportService adminReportService;
    @MockBean
    private AppSettingService settingService;
    // FP-80 /api/admin/** 인터셉터가 '비밀번호 변경 필요' 여부를 이 매퍼로 본다. mock 기본값(null)이라 통과한다.
    @MockBean
    private AdminAccountMapper adminAccountMapper;

    private static final LocalDateTime AT = LocalDateTime.of(2026, 11, 15, 10, 0);

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"));
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, "ROLE_ADMIN"));
    }

    // ---- 권한 ----

    @Test
    void 로그인하지_않으면_라운지와_신고_API는_401() throws Exception {
        mvc.perform(get("/api/board/posts")).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/reports"), "{}")).andExpect(status().isUnauthorized());
    }

    @Test
    void 일반_사용자는_관리자_신고_설정_API를_부를_수_없다() throws Exception {
        mvc.perform(asUser(get("/api/admin/reports"))).andExpect(status().isForbidden());
        mvc.perform(asUser(get("/api/admin/settings"))).andExpect(status().isForbidden());
    }

    // ---- COMM-01~06 글·댓글 ----

    @Test
    void 글_목록은_items와_쪽_정보를_준다() throws Exception {
        given(boardService.list(7L, 2, 10, "적금", null, "LOAN")).willReturn(new BoardDtos.PostPage(
                List.of(new BoardDtos.PostSummary(3L, "LOAN", null, "탈퇴한 회원", 4, AT, true, false)), 2, 10, 11));

        mvc.perform(asUser(get("/api/board/posts").param("page", "2").param("keyword", "적금").param("category", "LOAN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].postId").value(3))
                .andExpect(jsonPath("$.items[0].categoryCode").value("LOAN"))
                .andExpect(jsonPath("$.items[0].title").value((Object) null))
                .andExpect(jsonPath("$.items[0].nickname").value("탈퇴한 회원"))
                .andExpect(jsonPath("$.items[0].commentCount").value(4))
                .andExpect(jsonPath("$.items[0].createdAt").exists())
                .andExpect(jsonPath("$.items[0].hidden").value(true))
                .andExpect(jsonPath("$.items[0].mine").value(false))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalCount").value(11));
    }

    @Test
    void 글_상세는_댓글을_함께_준다() throws Exception {
        given(boardService.detail(7L, 3L)).willReturn(new BoardDtos.PostDetail(3L, "CARD", "제목", "내용", "닉네임", AT, null, false, true,
                List.of(new BoardDtos.Comment(9L, "댓글", "다른닉", AT, false, false))));

        mvc.perform(asUser(get("/api/board/posts/3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryCode").value("CARD"))
                .andExpect(jsonPath("$.title").value("제목"))
                .andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.comments[0].commentId").value(9))
                .andExpect(jsonPath("$.comments[0].content").value("댓글"));
    }

    @Test
    void 글_카테고리는_정해진_값만_받는다() throws Exception {
        given(boardService.create(eq(7L), any())).willReturn(new BoardDtos.PostCreated(12L));
        for (String code : List.of("CREDIT_SCORE", "LOAN", "CARD", "FREE")) {
            mvc.perform(asUser(json(post("/api/board/posts"),
                    "{\"title\":\"글\",\"content\":\"내용\",\"categoryCode\":\"" + code + "\"}"))).andExpect(status().isOk());
        }
        mvc.perform(asUser(json(put("/api/board/posts/12"), "{\"title\":\"글\",\"content\":\"내용\",\"categoryCode\":\"EMPLOYEE\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("categoryCode"));
    }

    @Test
    void 글_작성_수정_삭제와_빈_제목_400() throws Exception {
        given(boardService.create(eq(7L), any())).willReturn(new BoardDtos.PostCreated(12L));
        mvc.perform(asUser(json(post("/api/board/posts"), "{\"title\":\"첫 글\",\"content\":\"안녕하세요\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.postId").value(12));

        mvc.perform(asUser(json(post("/api/board/posts"), "{\"title\":\" \",\"content\":\"안녕하세요\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("title"));

        // 본문은 1300자까지 (DDL VARCHAR2(1300 CHAR), C9)
        mvc.perform(asUser(json(post("/api/board/posts"), "{\"title\":\"긴 글\",\"content\":\"" + "가".repeat(1300) + "\"}")))
                .andExpect(status().isOk());
        mvc.perform(asUser(json(post("/api/board/posts"), "{\"title\":\"긴 글\",\"content\":\"" + "가".repeat(1301) + "\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("content"));

        mvc.perform(asUser(json(put("/api/board/posts/12"), "{\"title\":\"고친 글\",\"content\":\"내용\"}")))
                .andExpect(status().isOk())
                .andExpect(content().json("{}"));

        willThrow(new ApiException(HttpStatus.FORBIDDEN, "NOT_OWNER", "내가 쓴 글만 고치거나 지울 수 있습니다."))
                .given(boardService).delete(7L, 13L);
        mvc.perform(asUser(delete("/api/board/posts/13")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_OWNER"));
    }

    @Test
    void 댓글_조회와_작성() throws Exception {
        given(boardService.comments(7L, 3L)).willReturn(new BoardDtos.CommentList(List.of()));
        mvc.perform(asUser(get("/api/board/posts/3/comments")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments").isArray());

        given(boardService.addComment(eq(7L), eq(3L), any())).willReturn(new BoardDtos.CommentCreated(21L));
        mvc.perform(asUser(json(post("/api/board/posts/3/comments"), "{\"content\":\"좋은 정보네요\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentId").value(21));
    }

    @Test
    @DisplayName("글 목록은 filter 쿼리를 서비스로 넘긴다")
    void postList_passesFilter() throws Exception {
        given(boardService.list(7L, 1, 10, null, "mine", null)).willReturn(new BoardDtos.PostPage(List.of(), 1, 10, 0));

        mvc.perform(asUser(get("/api/board/posts").param("filter", "mine")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0));
        verify(boardService).list(7L, 1, 10, null, "mine", null);
    }

    // ---- COMM-10·11 내 댓글 수정·삭제 ----

    @Test
    @DisplayName("댓글을 고치고 지우면 빈 객체를 주고, 토큰의 회원 번호와 경로의 글·댓글 번호를 넘긴다")
    void comment_updateAndDelete() throws Exception {
        mvc.perform(asUser(json(put("/api/board/posts/3/comments/21"), "{\"content\":\"고친 댓글\"}")))
                .andExpect(status().isOk())
                .andExpect(content().json("{}", true));
        verify(boardService).updateComment(7L, 3L, 21L, new BoardDtos.CommentWrite("고친 댓글"));

        mvc.perform(asUser(delete("/api/board/posts/3/comments/21")))
                .andExpect(status().isOk())
                .andExpect(content().json("{}", true));
        verify(boardService).deleteComment(7L, 3L, 21L);
    }

    @Test
    @DisplayName("댓글 수정은 빈 내용·1000자 초과면 400, 로그인 전이면 수정·삭제 모두 401이다")
    void comment_invalidAndUnauthorized() throws Exception {
        for (String text : List.of(" ", "가".repeat(1001))) {
            mvc.perform(asUser(json(put("/api/board/posts/3/comments/21"), "{\"content\":\"" + text + "\"}")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("content"));
        }
        mvc.perform(json(put("/api/board/posts/3/comments/21"), "{\"content\":\"댓글\"}")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/board/posts/3/comments/21")).andExpect(status().isUnauthorized());
        verifyNoInteractions(boardService);
    }

    @Test
    @DisplayName("숨겨진 댓글 오류는 공통 오류 형식 409 COMMENT_HIDDEN으로 나간다")
    void comment_hidden_conflict() throws Exception {
        willThrow(new ApiException(HttpStatus.CONFLICT, "COMMENT_HIDDEN", "신고로 숨김 처리된 댓글은 고치거나 지울 수 없습니다."))
                .given(boardService).deleteComment(7L, 3L, 21L);

        mvc.perform(asUser(delete("/api/board/posts/3/comments/21")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMENT_HIDDEN"));
    }

    // ---- COMM-09 내가 쓴 댓글 ----

    @Test
    void 내가_쓴_댓글은_일반_사용자만_보고_items와_쪽_정보를_준다() throws Exception {
        given(boardService.myComments(7L, 2, 10, "적금", "LOAN")).willReturn(new BoardDtos.MyCommentPage(
                List.of(new BoardDtos.MyComment(21L, 3L, "LOAN", "적금 질문", "글쓴이", null, AT, true)), 2, 10, 11));

        mvc.perform(asUser(get("/api/members/me/comments").param("page", "2").param("keyword", "적금").param("category", "LOAN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].commentId").value(21))
                .andExpect(jsonPath("$.items[0].postId").value(3))
                .andExpect(jsonPath("$.items[0].categoryCode").value("LOAN"))
                .andExpect(jsonPath("$.items[0].postTitle").value("적금 질문"))
                .andExpect(jsonPath("$.items[0].content").value((Object) null))
                .andExpect(jsonPath("$.items[0].postNickname").value("글쓴이"))
                .andExpect(jsonPath("$.items[0].createdAt").exists())
                .andExpect(jsonPath("$.items[0].hidden").value(true))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalCount").value(11));

        mvc.perform(get("/api/members/me/comments")).andExpect(status().isUnauthorized());
        mvc.perform(asAdmin(get("/api/members/me/comments"))).andExpect(status().isForbidden());
    }

    // ---- COMM-07 신고 ----

    @Test
    void 신고_접수와_오류_코드() throws Exception {
        given(reportService.submit(eq(7L), any())).willReturn(new ReportDtos.ReportCreated(100L, true));
        mvc.perform(asUser(json(post("/api/reports"), "{\"targetType\":\"POST\",\"targetId\":3,\"reasonCode\":\"SPAM\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reportId").value(100))
                .andExpect(jsonPath("$.targetHidden").value(true));

        mvc.perform(asUser(json(post("/api/reports"), "{\"targetType\":\"USER\",\"targetId\":3,\"reasonCode\":\"BAD\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));

        willThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "DAILY_LIMIT_EXCEEDED", "신고는 하루 3번까지 할 수 있습니다."))
                .given(reportService).submit(eq(7L), any());
        mvc.perform(asUser(json(post("/api/reports"), "{\"targetType\":\"COMMENT\",\"targetId\":9,\"reasonCode\":\"OTHER\"}")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("DAILY_LIMIT_EXCEEDED"));
    }

    // ---- ADM-11~14 관리자 ----

    @Test
    void 관리자_신고_목록은_필터를_받고_묶음을_준다() throws Exception {
        Map<String, Integer> reasons = Map.of("SPAM", 5);
        given(adminReportService.list("RECEIVED", null, LocalDate.of(2026, 11, 1), null)).willReturn(new ReportDtos.ReportList(1, 5,
                List.of(new ReportDtos.ReportGroup(12L, "POST", 3L, null, "제목", "HIDDEN_BY_REPORT", 5, reasons, "RECEIVED", AT))));

        mvc.perform(asAdmin(get("/api/admin/reports").param("status", "RECEIVED").param("from", "2026-11-01")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingCount").value(1))
                .andExpect(jsonPath("$.autoHideCount").value(5))
                .andExpect(jsonPath("$.items[0].reportId").value(12))
                .andExpect(jsonPath("$.items[0].targetType").value("POST"))
                .andExpect(jsonPath("$.items[0].targetId").value(3))
                .andExpect(jsonPath("$.items[0].reportCount").value(5))
                .andExpect(jsonPath("$.items[0].reasonCounts.SPAM").value(5))
                .andExpect(jsonPath("$.items[0].targetStatus").value("HIDDEN_BY_REPORT"));
    }

    @Test
    void 관리자_처리_결과_저장과_잘못된_결과값_400() throws Exception {
        given(adminReportService.process(eq(1L), eq(12L), any())).willReturn(new ReportDtos.ReportProcessed("REJECT", "VISIBLE", 5));
        mvc.perform(asAdmin(json(patch("/api/admin/reports/12"), "{\"resultCode\":\"REJECT\",\"memo\":\"문제없음\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultCode").value("REJECT"))
                .andExpect(jsonPath("$.targetStatus").value("VISIBLE"))
                .andExpect(jsonPath("$.handledCount").value(5));

        mvc.perform(asAdmin(json(patch("/api/admin/reports/12"), "{\"resultCode\":\"HIDE\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("resultCode"));

        // FP-224: 숨김 유지는 더 받지 않는다(삭제·반려만)
        mvc.perform(asAdmin(json(patch("/api/admin/reports/12"), "{\"resultCode\":\"KEEP_HIDDEN\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("resultCode"));
    }

    @Test
    void 관리자_설정_조회와_변경() throws Exception {
        SettingDtos.SettingView view = new SettingDtos.SettingView("REPORT_AUTO_HIDE_COUNT", 7, "신고 자동 숨김 기준 건수 (3~10)", 3, 10);
        given(settingService.list()).willReturn(new SettingDtos.SettingList(List.of(view)));
        mvc.perform(asAdmin(get("/api/admin/settings")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.settings[0].settingKey").value("REPORT_AUTO_HIDE_COUNT"))
                .andExpect(jsonPath("$.settings[0].min").value(3))
                .andExpect(jsonPath("$.settings[0].max").value(10));

        given(settingService.update(eq(1L), any())).willReturn(view);
        mvc.perform(asAdmin(json(put("/api/admin/settings"), "{\"settingKey\":\"REPORT_AUTO_HIDE_COUNT\",\"value\":7}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(7));
        verify(settingService).update(eq(1L), any());
    }
}
