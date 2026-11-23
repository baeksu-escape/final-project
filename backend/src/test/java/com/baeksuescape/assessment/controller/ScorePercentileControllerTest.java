package com.baeksuescape.assessment.controller;

import com.baeksuescape.assessment.dto.ScorePercentileResponse;
import com.baeksuescape.assessment.dto.ScorePercentileResponse.GroupPosition;
import com.baeksuescape.assessment.service.ScorePercentileService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FP-251 RPT-05 GET /api/members/me/score-percentile 의 경로·JSON 필드 이름과 보안 설정(토큰 없음 401, 관리자 403)을 보는 웹 계층 시험.
 * 문서(docs/spec/api/api_spec_c.md)에 적은 필드 이름이 실제 응답과 같은지 여기서 고정한다. test 프로필(H2)로 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ScorePercentileControllerTest {

    private static final String SCORE_PERCENTILE = "/api/members/me/score-percentile";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private ScorePercentileService scorePercentileService;

    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUp() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private String bearer(long userId, String role) {
        return "Bearer " + tokenProvider.issue(userId, role);
    }

    @Test
    @DisplayName("토큰의 회원 번호로 서비스를 부르고, 문서와 같은 필드 이름으로 돌려준다(5명 미만 집단은 값이 null)")
    void scorePercentile_ok_fieldNames() throws Exception {
        given(scorePercentileService.percentile(7L)).willReturn(new ScorePercentileResponse(709, "SELF_EMPLOYED", "30S",
                "LGBM-BASE-0.2", 5, List.of(
                        new GroupPosition("WORKER_TYPE", 40, new BigDecimal("37.5"), new BigDecimal("690.0"), new BigDecimal("19.0")),
                        new GroupPosition("AGE_BAND", 30, new BigDecimal("46.7"), new BigDecimal("714.0"), new BigDecimal("-5.0")),
                        new GroupPosition("WORKER_TYPE_AGE", 3, null, null, null))));

        mockMvc.perform(get(SCORE_PERCENTILE).header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myScore").value(709))
                .andExpect(jsonPath("$.workerTypeCode").value("SELF_EMPLOYED"))
                .andExpect(jsonPath("$.ageBandCode").value("30S"))
                .andExpect(jsonPath("$.modelVersion").value("LGBM-BASE-0.2"))
                .andExpect(jsonPath("$.minGroupSize").value(5))
                .andExpect(jsonPath("$.groups.length()").value(3))
                .andExpect(jsonPath("$.groups[0].groupType").value("WORKER_TYPE"))
                .andExpect(jsonPath("$.groups[0].memberCount").value(40))
                .andExpect(jsonPath("$.groups[0].topPct").value(37.5))
                .andExpect(jsonPath("$.groups[0].avgScore").value(690.0))
                .andExpect(jsonPath("$.groups[0].diffFromAvg").value(19.0))
                .andExpect(jsonPath("$.groups[1].groupType").value("AGE_BAND"))
                .andExpect(jsonPath("$.groups[1].diffFromAvg").value(-5.0))
                .andExpect(jsonPath("$.groups[2].groupType").value("WORKER_TYPE_AGE"))
                .andExpect(jsonPath("$.groups[2].memberCount").value(3))
                .andExpect(jsonPath("$.groups[2].topPct").value(nullValue()))
                .andExpect(jsonPath("$.groups[2].avgScore").value(nullValue()))
                .andExpect(jsonPath("$.groups[2].diffFromAvg").value(nullValue()));
        verify(scorePercentileService).percentile(7L);
    }

    @Test
    @DisplayName("토큰이 없으면 보안 설정이 401 UNAUTHORIZED를 내고 서비스를 부르지 않는다")
    void withoutToken_unauthorized() throws Exception {
        mockMvc.perform(get(SCORE_PERCENTILE))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(scorePercentileService);
    }

    @Test
    @DisplayName("관리자 토큰이면 403 FORBIDDEN이다 (/api/members/me/**는 ROLE_USER 전용)")
    void admin_forbidden() throws Exception {
        mockMvc.perform(get(SCORE_PERCENTILE).header(HttpHeaders.AUTHORIZATION, bearer(1L, "ROLE_ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verifyNoInteractions(scorePercentileService);
    }

    @Test
    @DisplayName("점수가 없으면 서비스의 404 ASSESSMENT_NOT_FOUND가 공통 오류 형식으로 나간다")
    void noScore_notFound() throws Exception {
        given(scorePercentileService.percentile(7L))
                .willThrow(new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND", "평가 결과가 없습니다."));

        mockMvc.perform(get(SCORE_PERCENTILE).header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ASSESSMENT_NOT_FOUND"));
    }
}
