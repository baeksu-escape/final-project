package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse;
import com.baeksuescape.finance.dto.peer.PeerBenchmarkResponse.GroupAverage;
import com.baeksuescape.finance.service.PeerBenchmarkService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.user.mapper.UserAccountMapper;
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
 * FP-160 DIAG-01 GET /api/members/me/peer-benchmark 의 경로·JSON 필드 이름과 보안 설정(토큰 없음 401, 관리자 403)을 보는 웹 계층 시험.
 * 문서(docs/spec/api/api_spec_c.md)에 적은 필드 이름이 실제 응답과 같은지 여기서 고정한다. MemberFinanceControllerTest처럼 test 프로필(H2)로 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PeerBenchmarkControllerTest {

    private static final String PEER_BENCHMARK = "/api/members/me/peer-benchmark";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private PeerBenchmarkService peerBenchmarkService;

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
    @DisplayName("토큰의 회원 번호로 서비스를 부르고, 문서와 같은 필드 이름으로 돌려준다(금액별 인원 포함, 5명 미만 금액은 null로 내려감)")
    void peerBenchmark_ok_fieldNames() throws Exception {
        given(peerBenchmarkService.benchmark(7L)).willReturn(new PeerBenchmarkResponse("EMPLOYEE", "30S",
                new GroupAverage(132, 42_000_000L, 85_000_000L, 31_000_000L, 130, 128, 125),
                new GroupAverage(3, null, null, null, 3, 3, 2)));

        mockMvc.perform(get(PEER_BENCHMARK).header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workerTypeCode").value("EMPLOYEE"))
                .andExpect(jsonPath("$.ageBandCode").value("30S"))
                .andExpect(jsonPath("$.sameWorkerType.memberCount").value(132))
                .andExpect(jsonPath("$.sameWorkerType.annualIncomeAmount").value(42_000_000))
                .andExpect(jsonPath("$.sameWorkerType.totalAssetAmount").value(85_000_000))
                .andExpect(jsonPath("$.sameWorkerType.totalDebtAmount").value(31_000_000))
                .andExpect(jsonPath("$.sameWorkerType.incomeMemberCount").value(130))
                .andExpect(jsonPath("$.sameWorkerType.assetMemberCount").value(128))
                .andExpect(jsonPath("$.sameWorkerType.debtMemberCount").value(125))
                .andExpect(jsonPath("$.sameAgeBand.memberCount").value(3))
                .andExpect(jsonPath("$.sameAgeBand.annualIncomeAmount").value(nullValue()))
                .andExpect(jsonPath("$.sameAgeBand.totalAssetAmount").value(nullValue()))
                .andExpect(jsonPath("$.sameAgeBand.totalDebtAmount").value(nullValue()))
                .andExpect(jsonPath("$.sameAgeBand.debtMemberCount").value(2));
        verify(peerBenchmarkService).benchmark(7L);
    }

    @Test
    @DisplayName("토큰이 없으면 보안 설정이 401 UNAUTHORIZED를 내고 서비스를 부르지 않는다")
    void withoutToken_unauthorized() throws Exception {
        mockMvc.perform(get(PEER_BENCHMARK))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(peerBenchmarkService);
    }

    @Test
    @DisplayName("관리자 토큰이면 403 FORBIDDEN이다 (/api/members/me/**는 ROLE_USER 전용)")
    void admin_forbidden() throws Exception {
        mockMvc.perform(get(PEER_BENCHMARK).header(HttpHeaders.AUTHORIZATION, bearer(1L, "ROLE_ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verifyNoInteractions(peerBenchmarkService);
    }

    @Test
    @DisplayName("직군을 고르지 않았으면 서비스의 409 JOB_TYPE_REQUIRED가 공통 오류 형식으로 나간다")
    void noJobType_conflict() throws Exception {
        given(peerBenchmarkService.benchmark(7L))
                .willThrow(new ApiException(HttpStatus.CONFLICT, "JOB_TYPE_REQUIRED", "직군을 먼저 선택해 주세요."));

        mockMvc.perform(get(PEER_BENCHMARK).header(HttpHeaders.AUTHORIZATION, bearer(7L, "ROLE_USER")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("JOB_TYPE_REQUIRED"));
    }
}
