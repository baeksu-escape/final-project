package com.baeksuescape.global.security;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.baeksuescape.admin.mapper.AdminAccountMapper;
import com.baeksuescape.global.util.PiiCrypto;
import com.baeksuescape.user.dto.UserAccount;
import com.baeksuescape.user.mapper.UserAccountMapper;

// FP-80 PR #53 검토 — 잠긴 계정의 기존 토큰 차단. 실제 경로(MEM-01 내 정보, ADM-05 계정 목록)를 실제 필터·컨트롤러로 부르고,
// 계정 상태만 DB 대신 Map으로 바꿔 가며 본다. 잠금 401 ACCOUNT_LOCKED → 해제 뒤 같은 토큰 200, 탈퇴는 기존대로 401 UNAUTHORIZED.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LockedAccountTokenTest {

    private static final long MEMBER_ID = 7L;
    private static final long ADMIN_ID = 1L;
    private static final String PROFILE = "/api/members/me/profile";
    private static final String ADMIN_USERS = "/api/admin/users";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;
    @Autowired
    private PiiCrypto crypto;

    @MockBean
    private UserAccountMapper userAccountMapper;
    // ADM-05 목록과 비밀번호 변경 필요 확인이 DB 대신 쓰는 mock. 기본값(빈 목록·0건·변경 필요 없음)으로 둔다.
    @MockBean
    private AdminAccountMapper adminAccountMapper;

    // 회원별 계정 상태. 관리자 잠금·해제를 이 값을 바꾸는 것으로 흉내 낸다.
    private final Map<Long, String> statuses = new HashMap<>();

    @BeforeEach
    void setUp() {
        statuses.put(MEMBER_ID, UserAccount.ACTIVE);
        statuses.put(ADMIN_ID, UserAccount.ACTIVE);
        given(userAccountMapper.selectAccountStatus(anyLong())).willAnswer(call -> statuses.get(call.getArgument(0, Long.class)));
        given(userAccountMapper.selectById(MEMBER_ID)).willReturn(member());
    }

    private UserAccount member() {
        UserAccount account = new UserAccount();
        account.setUserId(MEMBER_ID);
        account.setLoginId("employee");
        account.setNickname("직장인");
        account.setNameEnc(crypto.encrypt("홍길동"));
        account.setEmailEnc(crypto.encrypt("employee@example.com"));
        account.setPhoneEnc(crypto.encrypt("01012345678"));
        account.setRoleCode(UserAccount.ROLE_USER);
        account.setWorkerTypeCode("EMPLOYEE");
        account.setAccountStatusCode(UserAccount.ACTIVE);
        account.setCreatedAt(LocalDateTime.of(2026, 10, 1, 9, 30));
        return account;
    }

    private String bearer(long userId, String role) {
        return "Bearer " + tokenProvider.issue(userId, role);
    }

    @Test
    void 잠긴_일반_회원_토큰으로_내_정보는_401_ACCOUNT_LOCKED() throws Exception {
        String token = bearer(MEMBER_ID, UserAccount.ROLE_USER);
        statuses.put(MEMBER_ID, UserAccount.LOCKED);

        mvc.perform(get(PROFILE).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$.message").value("잠긴 계정입니다. 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정하면 풀립니다."));
    }

    // FP-258 관리자는 비밀번호 찾기로 풀 수 없어 관리자 안내(401 ADMIN_ACCOUNT_LOCKED)다.
    @Test
    void 잠긴_관리자_토큰으로_계정_목록은_401_ADMIN_ACCOUNT_LOCKED와_관리자_안내() throws Exception {
        String token = bearer(ADMIN_ID, UserAccount.ROLE_ADMIN);
        statuses.put(ADMIN_ID, UserAccount.LOCKED);

        mvc.perform(get(ADMIN_USERS).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ADMIN_ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$.message").value("잠긴 관리자 계정입니다. 다른 관리자에게 잠금 해제를 요청해 주세요."));
    }

    @Test
    void 잠금을_풀면_같은_토큰으로_다시_200() throws Exception {
        String memberToken = bearer(MEMBER_ID, UserAccount.ROLE_USER);
        String adminToken = bearer(ADMIN_ID, UserAccount.ROLE_ADMIN);

        statuses.put(MEMBER_ID, UserAccount.LOCKED);
        statuses.put(ADMIN_ID, UserAccount.LOCKED);
        mvc.perform(get(PROFILE).header(HttpHeaders.AUTHORIZATION, memberToken)).andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN_USERS).header(HttpHeaders.AUTHORIZATION, adminToken)).andExpect(status().isUnauthorized());

        statuses.put(MEMBER_ID, UserAccount.ACTIVE);
        statuses.put(ADMIN_ID, UserAccount.ACTIVE);
        mvc.perform(get(PROFILE).header(HttpHeaders.AUTHORIZATION, memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.loginId").value("employee"));
        mvc.perform(get(ADMIN_USERS).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    @Test
    void 탈퇴_계정은_기존대로_401_UNAUTHORIZED_사용_중인_계정은_영향_없음() throws Exception {
        statuses.put(MEMBER_ID, UserAccount.WITHDRAWN);
        mvc.perform(get(PROFILE).header(HttpHeaders.AUTHORIZATION, bearer(MEMBER_ID, UserAccount.ROLE_USER)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mvc.perform(get(ADMIN_USERS).header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID, UserAccount.ROLE_ADMIN)))
                .andExpect(status().isOk());
    }
}
