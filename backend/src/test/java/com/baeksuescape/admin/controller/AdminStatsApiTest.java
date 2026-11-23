package com.baeksuescape.admin.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
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
 * FP-161 ADM-03 관리자 통계 API — 보안(관리자만: 일반 회원 403, 토큰 없음 401)과 응답 필드 이름(명세서 api_spec_c.md)을 고정한다.
 * 실제 보안 필터·오류 처리를 타고, DB 매퍼만 mock으로 대신한다(AdminApiTest와 같은 방식).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminStatsApiTest {

    private static final String STATS = "/api/admin/stats";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private AdminStatsMapper statsMapper;
    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;
    // 비밀번호 변경이 필요한 관리자 검사(인터셉터)용. 기본값 null = 변경 필요 없음.
    @MockBean
    private AdminAccountMapper adminAccountMapper;

    @BeforeEach
    void setUp() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder builder, String role) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(1L, role));
    }

    private static MemberScore member(String workerType, String ageBand, int trad, int alt, String grade) {
        MemberScore m = new MemberScore();
        m.setWorkerTypeCode(workerType);
        m.setAgeBandCode(ageBand);
        m.setTradScore(trad);
        m.setAltScore(alt);
        m.setAltGradeBandCode(grade);
        m.setTradGradeBandCode(trad >= 665 ? "STANDARD" : "CAUTION");   // 예시는 모두 780 미만
        return m;
    }

    @Test
    @DisplayName("관리자: 200, 요약·등급 분포·그룹 표 필드 이름. 5명 미만 그룹은 평균이 null")
    void adminGetsStats() throws Exception {
        List<MemberScore> members = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            members.add(member("EMPLOYEE", "30S", 640, 700, "STANDARD"));
        }
        members.add(member("FREELANCER", "20S", 580, 640, "CAUTION"));
        given(statsMapper.selectActiveModelVersion()).willReturn("LGBM-BASE-0.2");
        given(statsMapper.selectLatestScoredMembers("LGBM-BASE-0.2")).willReturn(members);
        given(statsMapper.selectRegisteredMemberCount()).willReturn(120L);
        given(statsMapper.selectScoredCountSince(any(), eq("LGBM-BASE-0.2"))).willReturn(3L);

        mvc.perform(as(get(STATS), "ROLE_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupBy").value("WORKER_TYPE"))
                .andExpect(jsonPath("$.modelVersion").value("LGBM-BASE-0.2"))
                .andExpect(jsonPath("$.minGroupSize").value(5))
                .andExpect(jsonPath("$.summary.assessedMemberCount").value(6))
                .andExpect(jsonPath("$.summary.avgTradScore").value(630.0))
                .andExpect(jsonPath("$.summary.avgAltScore").value(690.0))
                .andExpect(jsonPath("$.summary.avgScoreUplift").value(60.0))
                .andExpect(jsonPath("$.summary.standardOrAboveRatePct").value(83.3))
                .andExpect(jsonPath("$.summary.registeredMemberCount").value(120))
                .andExpect(jsonPath("$.summary.todayScoredCount").value(3))
                .andExpect(jsonPath("$.gradeDistribution[0].gradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.gradeDistribution[0].count").value(1))
                .andExpect(jsonPath("$.gradeDistribution[0].ratePct").value(16.7))
                .andExpect(jsonPath("$.groups[0].groupCode").value("EMPLOYEE"))
                .andExpect(jsonPath("$.groups[0].memberCount").value(5))
                .andExpect(jsonPath("$.groups[0].avgAltScore").value(700.0))
                .andExpect(jsonPath("$.groups[0].gradeDistribution[1].count").value(5))
                .andExpect(jsonPath("$.groups[2].groupCode").value("FREELANCER"))
                .andExpect(jsonPath("$.groups[2].memberCount").value(1))
                .andExpect(jsonPath("$.groups[2].avgAltScore").value(nullValue()))
                .andExpect(jsonPath("$.groups[2].gradeDistribution").value(nullValue()))
                // 기존 모델(11/23 추가): 기존 점수 640·580은 모두 CAUTION
                .andExpect(jsonPath("$.summary.tradStandardOrAboveRatePct").value(0.0))
                .andExpect(jsonPath("$.summary.tradScoredMemberCount").value(6))
                .andExpect(jsonPath("$.groups[0].tradScoredMemberCount").value(5))
                .andExpect(jsonPath("$.tradGradeDistribution[0].gradeBandCode").value("CAUTION"))
                .andExpect(jsonPath("$.tradGradeDistribution[0].count").value(6))
                .andExpect(jsonPath("$.tradGradeDistribution[0].ratePct").value(100.0))
                .andExpect(jsonPath("$.groups[0].tradStandardOrAboveRatePct").value(0.0))
                .andExpect(jsonPath("$.groups[0].tradGradeDistribution[0].count").value(5))
                .andExpect(jsonPath("$.groups[2].tradGradeDistribution").value(nullValue()));
    }

    @Test
    @DisplayName("groupBy=AGE_BAND면 연령대 4개, 그 밖의 값은 400 INVALID_INPUT(field groupBy)")
    void groupBy() throws Exception {
        given(statsMapper.selectActiveModelVersion()).willReturn("LGBM-BASE-0.2");
        given(statsMapper.selectLatestScoredMembers("LGBM-BASE-0.2")).willReturn(List.of());

        mvc.perform(as(get(STATS).param("groupBy", "AGE_BAND"), "ROLE_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupBy").value("AGE_BAND"))
                .andExpect(jsonPath("$.groups.length()").value(4))
                .andExpect(jsonPath("$.groups[3].groupCode").value("50_PLUS"));

        mvc.perform(as(get(STATS).param("groupBy", "JOB"), "ROLE_ADMIN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("groupBy"));
    }

    @Test
    @DisplayName("일반 회원 토큰은 403, 토큰이 없으면 401이고 통계를 읽지 않는다")
    void notAdmin() throws Exception {
        mvc.perform(as(get(STATS), "ROLE_USER")).andExpect(status().isForbidden());
        mvc.perform(get(STATS)).andExpect(status().isUnauthorized());
        verifyNoInteractions(statsMapper);
    }
}
