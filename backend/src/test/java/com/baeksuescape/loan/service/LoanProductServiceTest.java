package com.baeksuescape.loan.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.loan.dto.LoanDtos;
import com.baeksuescape.loan.dto.LoanRows.FeatureRow;
import com.baeksuescape.loan.dto.LoanRows.ProductRow;
import com.baeksuescape.loan.dto.LoanRows.WorkerTypeRow;
import com.baeksuescape.loan.mapper.LoanMapper;

// N-37-1·N-37-2 대출 상품 목록·상세 조립 규칙 — 배열 조립, 직군 행 없음=전 직군, 점수 조건 NULL 유지, 없는 상품 404. DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
class LoanProductServiceTest {

    @Mock
    private LoanMapper loanMapper;
    @InjectMocks
    private LoanProductService service;

    private static ProductRow product(long id, String code, Integer minAltScore, String documents) {
        ProductRow row = new ProductRow();
        row.setProductId(id);
        row.setProductCode(code);
        row.setProviderName("가상은행 A");
        row.setProductName("상품" + id);
        row.setSummary("한 줄");
        row.setDescription("설명");
        row.setRateMinPct(new BigDecimal("4.51"));
        row.setRateMaxPct(new BigDecimal("9.76"));
        row.setLimitMaxAmt(95000000L);
        row.setTermText("12~60개월(시연)");
        row.setRepaymentMethod("원리금균등");
        row.setMinAltScore(minAltScore);
        row.setEligibilityText("급여소득자 대상(시연용)");
        row.setRequiredDocuments(documents);
        row.setCautionText("더미 상품 · 실제 상품 아님");
        row.setDummyYn("Y");
        return row;
    }

    private static WorkerTypeRow worker(long productId, String code) {
        WorkerTypeRow row = new WorkerTypeRow();
        row.setProductId(productId);
        row.setWorkerTypeCode(code);
        return row;
    }

    private static FeatureRow feature(long productId, String text) {
        FeatureRow row = new FeatureRow();
        row.setProductId(productId);
        row.setFeatureText(text);
        return row;
    }

    @Test
    void 목록은_상품마다_직군_특징_서류를_배열로_조립한다() {
        given(loanMapper.selectProducts()).willReturn(List.of(product(1, "LP001", 780, "재직증명서·급여 명세서"), product(2, "LP002", 700, null)));
        given(loanMapper.selectWorkerTypes()).willReturn(List.of(worker(1, "EMPLOYEE"), worker(1, "FREELANCER")));
        given(loanMapper.selectFeatures()).willReturn(List.of(feature(1, "특징1"), feature(1, "특징2")));

        List<LoanDtos.Product> items = service.list().items();

        assertThat(items).hasSize(2);
        LoanDtos.Product first = items.get(0);
        assertThat(first.productId()).isEqualTo(1L);
        assertThat(first.productCode()).isEqualTo("LP001");
        assertThat(first.name()).isEqualTo("상품1");
        assertThat(first.eligibility()).isEqualTo("급여소득자 대상(시연용)");
        assertThat(first.rateMinPct()).isEqualTo(4.51);
        assertThat(first.limitAmount()).isEqualTo(95000000L);
        assertThat(first.minScore()).isEqualTo(780);
        assertThat(first.workerTypeCodes()).containsExactly("EMPLOYEE", "FREELANCER");
        assertThat(first.features()).containsExactly("특징1", "특징2");
        assertThat(first.requiredDocuments()).containsExactly("재직증명서", "급여 명세서");
        assertThat(first.dummyYn()).isTrue();
    }

    @Test
    void 직군_행이_없으면_전_직군_서류와_특징이_없으면_빈_배열() {
        given(loanMapper.selectProducts()).willReturn(List.of(product(2, "LP002", 700, null)));
        given(loanMapper.selectWorkerTypes()).willReturn(List.of());
        given(loanMapper.selectFeatures()).willReturn(List.of());

        LoanDtos.Product item = service.list().items().get(0);

        assertThat(item.workerTypeCodes()).containsExactly("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");
        assertThat(item.requiredDocuments()).isEmpty();
        assertThat(item.features()).isEmpty();
    }

    @Test
    void 점수_조건이_없는_상품은_minScore가_null로_나간다() {
        given(loanMapper.selectProducts()).willReturn(List.of(product(3, "LP003", null, "신분증 사본")));
        given(loanMapper.selectWorkerTypes()).willReturn(List.of());
        given(loanMapper.selectFeatures()).willReturn(List.of());

        assertThat(service.list().items().get(0).minScore()).isNull();
    }

    @Test
    void 상세는_그_상품의_직군과_특징만_담는다() {
        given(loanMapper.selectProductByCode("LP001")).willReturn(product(1, "LP001", 780, "신분증 사본·소득 증빙"));
        given(loanMapper.selectWorkerTypesByProductId(1L)).willReturn(List.of(worker(1, "EMPLOYEE")));
        given(loanMapper.selectFeaturesByProductId(1L)).willReturn(List.of(feature(1, "특징1")));

        LoanDtos.Product detail = service.detail("LP001");

        assertThat(detail.workerTypeCodes()).containsExactly("EMPLOYEE");
        assertThat(detail.features()).containsExactly("특징1");
        assertThat(detail.requiredDocuments()).containsExactly("신분증 사본", "소득 증빙");
        assertThat(detail.cautionText()).isEqualTo("더미 상품 · 실제 상품 아님");
    }

    @Test
    void 상세는_전체_직군_특징_조회를_부르지_않고_그_상품_것만_읽는다() {
        given(loanMapper.selectProductByCode("LP001")).willReturn(product(1, "LP001", 780, "신분증 사본"));
        given(loanMapper.selectWorkerTypesByProductId(1L)).willReturn(List.of());
        given(loanMapper.selectFeaturesByProductId(1L)).willReturn(List.of());

        LoanDtos.Product detail = service.detail("LP001");

        verify(loanMapper, never()).selectWorkerTypes();
        verify(loanMapper, never()).selectFeatures();
        verify(loanMapper).selectWorkerTypesByProductId(1L);
        verify(loanMapper).selectFeaturesByProductId(1L);
        assertThat(detail.workerTypeCodes()).containsExactly("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");
        assertThat(detail.features()).isEmpty();
    }

    @Test
    void 없는_상품_코드는_404_PRODUCT_NOT_FOUND() {
        given(loanMapper.selectProductByCode("LP999")).willReturn(null);

        assertThatThrownBy(() -> service.detail("LP999")).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus().value()).isEqualTo(404);
            assertThat(e.getCode()).isEqualTo("PRODUCT_NOT_FOUND");
        });
    }
}
