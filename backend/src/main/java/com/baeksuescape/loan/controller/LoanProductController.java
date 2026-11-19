package com.baeksuescape.loan.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baeksuescape.loan.dto.LoanDtos;
import com.baeksuescape.loan.service.LoanProductService;

// N-37 대출 상품 목록·상세 API (API 정의서 2-7 LOAN-01·02). 로그인한 회원이 부른다. 응답에 회원 정보는 없다.
@RestController
@RequestMapping("/api/loan-products")
public class LoanProductController {

    private final LoanProductService loanProductService;

    public LoanProductController(LoanProductService loanProductService) {
        this.loanProductService = loanProductService;
    }

    // LOAN-01 N-37-1 전체 상품 목록 (필터·정렬은 화면이 한다)
    @GetMapping
    public LoanDtos.ProductList list() {
        return loanProductService.list();
    }

    // LOAN-02 N-37-2 상품 상세 (productCode 예: LP001)
    @GetMapping("/{productCode}")
    public LoanDtos.Product detail(@PathVariable String productCode) {
        return loanProductService.detail(productCode);
    }
}
