package com.baeksuescape.loan.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.loan.dto.LoanDtos;
import com.baeksuescape.loan.dto.LoanRows.FeatureRow;
import com.baeksuescape.loan.dto.LoanRows.ProductRow;
import com.baeksuescape.loan.dto.LoanRows.WorkerTypeRow;
import com.baeksuescape.loan.mapper.LoanMapper;

// N-37-1·N-37-2 대출 상품 목록·상세 — 더미 상품을 읽어 대상 직군·특징·필요 서류를 배열로 조립한다.
// 내 점수 충족 여부·즐겨찾기 여부는 넣지 않는다(화면이 신용 리포트·즐겨찾기 API로 따로 채운다).
@Service
@Transactional(readOnly = true)
public class LoanProductService {

    // 대상 직군 행이 없는 상품은 전 직군 대상이다(DDL 주석).
    static final List<String> ALL_WORKER_TYPES = List.of("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");
    private static final String DOCUMENT_SEPARATOR = "·";

    private final LoanMapper loanMapper;

    public LoanProductService(LoanMapper loanMapper) {
        this.loanMapper = loanMapper;
    }

    // N-37-1 전체 상품 (PRODUCT_ID 순)
    public LoanDtos.ProductList list() {
        Map<Long, List<String>> workerTypes = new HashMap<>();
        for (WorkerTypeRow row : loanMapper.selectWorkerTypes()) {
            workerTypes.computeIfAbsent(row.getProductId(), k -> new ArrayList<>()).add(row.getWorkerTypeCode());
        }
        Map<Long, List<String>> features = new HashMap<>();
        for (FeatureRow row : loanMapper.selectFeatures()) {
            features.computeIfAbsent(row.getProductId(), k -> new ArrayList<>()).add(row.getFeatureText());
        }
        List<LoanDtos.Product> items = loanMapper.selectProducts().stream()
                .map(row -> toProduct(row, workerTypes.get(row.getProductId()), features.get(row.getProductId())))
                .toList();
        return new LoanDtos.ProductList(items);
    }

    // N-37-2 상품 하나. 없으면 404 PRODUCT_NOT_FOUND
    public LoanDtos.Product detail(String productCode) {
        ProductRow row = loanMapper.selectProductByCode(productCode);
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "대출 상품을 찾을 수 없습니다.");
        }
        List<String> workerTypes = loanMapper.selectWorkerTypes().stream()
                .filter(w -> w.getProductId().equals(row.getProductId())).map(WorkerTypeRow::getWorkerTypeCode).toList();
        List<String> features = loanMapper.selectFeatures().stream()
                .filter(f -> f.getProductId().equals(row.getProductId())).map(FeatureRow::getFeatureText).toList();
        return toProduct(row, workerTypes, features);
    }

    private LoanDtos.Product toProduct(ProductRow row, List<String> workerTypes, List<String> features) {
        List<String> workerTypeCodes = workerTypes == null || workerTypes.isEmpty() ? ALL_WORKER_TYPES : List.copyOf(workerTypes);
        return new LoanDtos.Product(row.getProductId(), row.getProductCode(), row.getProductName(), row.getProviderName(),
                row.getSummary(), row.getDescription(), row.getEligibilityText(), row.getRateMinPct().doubleValue(),
                row.getRateMaxPct().doubleValue(), row.getLimitMaxAmt(), row.getMinAltScore(), workerTypeCodes, row.getTermText(),
                row.getRepaymentMethod(), splitDocuments(row.getRequiredDocuments()), features == null ? List.of() : List.copyOf(features),
                row.getCautionText(), !"N".equals(row.getDummyYn()));
    }

    // '·' 로 이어 둔 필요 서류 문자열을 나눈다. 비어 있으면 빈 배열.
    static List<String> splitDocuments(String documents) {
        if (documents == null || documents.isBlank()) {
            return List.of();
        }
        return Arrays.stream(documents.split(DOCUMENT_SEPARATOR)).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
