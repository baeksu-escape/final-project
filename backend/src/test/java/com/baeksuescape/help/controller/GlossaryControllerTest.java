package com.baeksuescape.help.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.help.dto.GlossaryResponse;
import com.baeksuescape.help.service.GlossaryService;
import com.baeksuescape.user.mapper.UserAccountMapper;
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

/**
 * FP-180 GET /api/glossary(HELP-01)의 JSON 필드 이름과 로그인 확인(토큰 없음 401)을 보는 API 테스트.
 * 보안·공통 예외 처리기까지 실제와 같게 붙이려고 test 프로필(H2)로 전체 컨텍스트를 띄운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GlossaryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private GlossaryService glossaryService;

    // JWT 필터가 계정 상태를 확인하므로(잠금·탈퇴면 무시) 사용 중인 계정으로 돌려준다.
    @MockBean
    private UserAccountMapper userAccountMapper;

    @BeforeEach
    void setUpAccount() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    @Test
    @DisplayName("로그인하면 terms 아래 term·easyText·explanation으로 나가고 termId는 없다")
    void getGlossary() throws Exception {
        when(glossaryService.findAll()).thenReturn(new GlossaryResponse(List.of(
                new GlossaryResponse.Term("DSR", "1년 소득 중 빚 갚는 데 드는 비율", "총부채원리금상환비율"),
                new GlossaryResponse.Term("원리금", "갚아야 할 원금과 이자", null))));

        mockMvc.perform(get("/api/glossary")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(2L, "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.terms[0].term").value("DSR"))
                .andExpect(jsonPath("$.terms[0].easyText").value("1년 소득 중 빚 갚는 데 드는 비율"))
                .andExpect(jsonPath("$.terms[0].explanation").value("총부채원리금상환비율"))
                .andExpect(jsonPath("$.terms[0].termId").doesNotExist())
                .andExpect(jsonPath("$.terms[1].explanation").value(nullValue()));
    }

    @Test
    @DisplayName("토큰이 없으면 보안 설정이 401 UNAUTHORIZED를 내고 서비스를 부르지 않는다")
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/glossary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(glossaryService);
    }
}
