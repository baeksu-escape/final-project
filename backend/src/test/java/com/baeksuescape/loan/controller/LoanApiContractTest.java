package com.baeksuescape.loan.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.JwtTokenProvider;
import com.baeksuescape.loan.dto.LoanDtos;
import com.baeksuescape.loan.service.LoanFavoriteService;
import com.baeksuescape.loan.service.LoanProductService;
import com.baeksuescape.user.mapper.UserAccountMapper;

// N-37 대출 상품 API 계약 — 경로·권한·상태 코드·JSON 키가 API 정의서 2-7(LOAN-01~05)과 같은지 본다.
// 서비스는 mock으로 대신하고, 보안 필터·오류 처리는 실제로 탄다.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoanApiContractTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtTokenProvider tokenProvider;

    @MockBean
    private UserAccountMapper userAccountMapper;
    @MockBean
    private LoanProductService productService;
    @MockBean
    private LoanFavoriteService favoriteService;

    @BeforeEach
    void active() {
        given(userAccountMapper.selectAccountStatus(anyLong())).willReturn("ACTIVE");
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenProvider.issue(7L, "ROLE_USER"));
    }

    private static LoanDtos.Product sample() {
        return new LoanDtos.Product(1L, "LP001", "든든 일반 신용대출", "가상은행 A", "한 줄", "설명", "모든 직군 대상(시연용)", 4.51, 9.76,
                95000000L, null, List.of("EMPLOYEE", "FREELANCER"), "12~60개월(시연)", "원리금균등", List.of("신분증 사본", "소득 증빙"),
                List.of("특징1"), "더미 상품 · 실제 상품 아님", true);
    }

    @Test
    void 로그인하지_않으면_대출_상품_API는_401() throws Exception {
        mvc.perform(get("/api/loan-products")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/loan-products/LP001")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/members/me/favorite-loan-products")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/members/me/favorite-loan-products/LP001")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/members/me/favorite-loan-products/LP001")).andExpect(status().isUnauthorized());
    }

    @Test
    void LOAN_01_목록은_items에_화면_필드_이름으로_준다() throws Exception {
        given(productService.list()).willReturn(new LoanDtos.ProductList(List.of(sample())));

        mvc.perform(asUser(get("/api/loan-products")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].productId").value(1))
                .andExpect(jsonPath("$.items[0].productCode").value("LP001"))
                .andExpect(jsonPath("$.items[0].name").value("든든 일반 신용대출"))
                .andExpect(jsonPath("$.items[0].providerName").value("가상은행 A"))
                .andExpect(jsonPath("$.items[0].description").value("설명"))
                .andExpect(jsonPath("$.items[0].eligibility").value("모든 직군 대상(시연용)"))
                .andExpect(jsonPath("$.items[0].rateMinPct").value(4.51))
                .andExpect(jsonPath("$.items[0].rateMaxPct").value(9.76))
                .andExpect(jsonPath("$.items[0].limitAmount").value(95000000))
                .andExpect(jsonPath("$.items[0].minScore").value((Object) null))
                .andExpect(jsonPath("$.items[0].workerTypeCodes[1]").value("FREELANCER"))
                .andExpect(jsonPath("$.items[0].termText").value("12~60개월(시연)"))
                .andExpect(jsonPath("$.items[0].repaymentMethod").value("원리금균등"))
                .andExpect(jsonPath("$.items[0].requiredDocuments[1]").value("소득 증빙"))
                .andExpect(jsonPath("$.items[0].features[0]").value("특징1"))
                .andExpect(jsonPath("$.items[0].dummyYn").value(true))
                .andExpect(jsonPath("$.items[0].myScore").doesNotExist())
                .andExpect(jsonPath("$.items[0].favorite").doesNotExist());
    }

    @Test
    void LOAN_02_상세와_없는_상품_404() throws Exception {
        given(productService.detail("LP001")).willReturn(sample());
        given(productService.detail("LP999")).willThrow(new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "대출 상품을 찾을 수 없습니다."));

        mvc.perform(asUser(get("/api/loan-products/LP001")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productCode").value("LP001"))
                .andExpect(jsonPath("$.cautionText").value("더미 상품 · 실제 상품 아님"));
        mvc.perform(asUser(get("/api/loan-products/LP999")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
    }

    @Test
    void LOAN_03_내_즐겨찾기는_토큰_회원_기준_items_코드_배열() throws Exception {
        given(favoriteService.list(7L)).willReturn(new LoanDtos.FavoriteList(List.of("LP003", "LP001")));

        mvc.perform(asUser(get("/api/members/me/favorite-loan-products")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0]").value("LP003"))
                .andExpect(jsonPath("$.items[1]").value("LP001"));
    }

    @Test
    void LOAN_04_05_추가와_해제는_200과_빈_객체() throws Exception {
        mvc.perform(asUser(put("/api/members/me/favorite-loan-products/LP001")))
                .andExpect(status().isOk()).andExpect(content().json("{}"));
        verify(favoriteService).add(7L, "LP001");

        mvc.perform(asUser(delete("/api/members/me/favorite-loan-products/LP001")))
                .andExpect(status().isOk()).andExpect(content().json("{}"));
        verify(favoriteService).remove(7L, "LP001");
    }

    @Test
    void 없는_상품_즐겨찾기는_404_PRODUCT_NOT_FOUND() throws Exception {
        willThrow(new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "대출 상품을 찾을 수 없습니다.")).given(favoriteService).add(7L, "LP999");

        mvc.perform(asUser(put("/api/members/me/favorite-loan-products/LP999")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
    }
}
