package com.baeksuescape.assessment.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.admin.dto.AdminStatsRows.MemberScore;
import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.admin.mapper.AdminStatsMapper;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;

/**
 * FP-164 ADM-04 사용자 비교 분석 API — 보안(일반 회원만: 관리자 403, 토큰 없음 401)과 응답 필드 이름(명세서 api_spec_c.md)을 고정한다.
 * 실제 보안 필터·오류 처리를 타고, DB 매퍼만 mock으로 대신한다(AdminStatsApiTest와 같은 방식).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GroupComparisonApiTest {

    private static final String URL = "/api/members/me/group-comparison";
    private static final long ME = 1L;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private AdminStatsMapper statsMapper;
    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private AdminAccountMapper adminAccountMapper;

    @BeforeEach
    void setUp() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder builder, String role) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(ME, role));
    }

    private static MemberScore member(long userId, String workerType, String ageBand, int trad, int alt, String grade) {
        MemberScore m = new MemberScore();
        m.setUserId(userId);
        m.setWorkerTypeCode(workerType);
        m.setAgeBandCode(ageBand);
        m.setTradScore(trad);
        m.setAltScore(alt);
        m.setAltGradeBandCode(grade);
        m.setTradGradeBandCode("CAUTION");
        return m;
    }

    @Test
    @DisplayName("일반 회원: 200, 전체·직군별·연령대별·격자·내 평가 필드 이름. 5명 미만 칸은 null, 관리자 전용 수치는 없다")
    void userGetsComparison() throws Exception {
        List<MemberScore> members = new ArrayList<>();
        members.add(member(ME, "EMPLOYEE", "30S", 640, 700, "STANDARD"));
        for (long id = 2; id <= 5; id++) {
            members.add(member(id, "EMPLOYEE", "30S", 640, 700, "STANDARD"));
        }
        members.add(member(6, "FREELANCER", "20S", 580, 640, "CAUTION"));
        given(statsMapper.selectActiveModelVersion()).willReturn("LGBM-BASE-0.2");
        given(statsMapper.selectLatestScoredMembers("LGBM-BASE-0.2")).willReturn(members);

        mvc.perform(as(get(URL), "ROLE_USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.modelVersion").value("LGBM-BASE-0.2"))
                .andExpect(jsonPath("$.minGroupSize").value(5))
                .andExpect(jsonPath("$.me.workerTypeCode").value("EMPLOYEE"))
                .andExpect(jsonPath("$.me.ageBandCode").value("30S"))
                .andExpect(jsonPath("$.me.tradScore").value(640))
                .andExpect(jsonPath("$.me.altScore").value(700))
                .andExpect(jsonPath("$.me.tradGradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.me.altGradeBandCode").value("STANDARD"))
                .andExpect(jsonPath("$.overall.groupCode").value("ALL"))
                .andExpect(jsonPath("$.overall.memberCount").value(6))
                .andExpect(jsonPath("$.overall.avgAltScore").value(690.0))
                .andExpect(jsonPath("$.overall.avgScoreUplift").value(60.0))
                .andExpect(jsonPath("$.overall.standardOrAboveRatePct").value(83.3))
                .andExpect(jsonPath("$.overall.gradeDistribution[1].gradeBandCode").value("STANDARD"))
                .andExpect(jsonPath("$.overall.tradStandardOrAboveRatePct").value(0.0))
                .andExpect(jsonPath("$.overall.tradScoredMemberCount").value(6))
                .andExpect(jsonPath("$.byWorkerType.length()").value(3))
                .andExpect(jsonPath("$.byWorkerType[0].groupCode").value("EMPLOYEE"))
                .andExpect(jsonPath("$.byWorkerType[0].avgAltScore").value(700.0))
                .andExpect(jsonPath("$.byAgeBand.length()").value(4))
                .andExpect(jsonPath("$.byAgeBand[0].groupCode").value("20S"))
                .andExpect(jsonPath("$.byAgeBand[0].memberCount").value(1))
                .andExpect(jsonPath("$.byAgeBand[0].avgAltScore").value(nullValue()))
                .andExpect(jsonPath("$.grid.length()").value(12))
                .andExpect(jsonPath("$.grid[1].workerTypeCode").value("EMPLOYEE"))
                .andExpect(jsonPath("$.grid[1].ageBandCode").value("30S"))
                .andExpect(jsonPath("$.grid[1].stats.groupCode").value("EMPLOYEE:30S"))
                .andExpect(jsonPath("$.grid[1].stats.memberCount").value(5))
                .andExpect(jsonPath("$.grid[1].stats.avgAltScore").value(700.0))
                .andExpect(jsonPath("$.grid[8].stats.groupCode").value("FREELANCER:20S"))
                .andExpect(jsonPath("$.grid[8].stats.avgAltScore").value(nullValue()))
                .andExpect(jsonPath("$.summary").doesNotExist())
                .andExpect(jsonPath("$.registeredMemberCount").doesNotExist());
    }

    @Test
    @DisplayName("ACTIVE 모델로 낸 내 평가가 없으면 me는 null(200)")
    void noScoreYet() throws Exception {
        given(statsMapper.selectActiveModelVersion()).willReturn("LGBM-BASE-0.2");
        given(statsMapper.selectLatestScoredMembers("LGBM-BASE-0.2"))
                .willReturn(List.of(member(7, "EMPLOYEE", "30S", 640, 700, "STANDARD")));

        mvc.perform(as(get(URL), "ROLE_USER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me").value(nullValue()))
                .andExpect(jsonPath("$.overall.memberCount").value(1));
    }

    @Test
    @DisplayName("관리자 토큰은 403, 토큰이 없으면 401이고 통계를 읽지 않는다")
    void notUser() throws Exception {
        mvc.perform(as(get(URL), "ROLE_ADMIN")).andExpect(status().isForbidden());
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        verifyNoInteractions(statsMapper);
    }
}
