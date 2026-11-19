package com.baeksuescape.loan.service;

import java.time.Clock;
import java.time.LocalDateTime;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.loan.dto.LoanDtos;
import com.baeksuescape.loan.mapper.LoanMapper;

// N-37-3 대출 상품 즐겨찾기 추가·해제, N-04-5 내 즐겨찾기 목록. 추가·해제는 몇 번 불러도 같은 결과(멱등)다.
@Service
public class LoanFavoriteService {

    private final LoanMapper loanMapper;
    private final Clock clock;

    public LoanFavoriteService(LoanMapper loanMapper, Clock clock) {
        this.loanMapper = loanMapper;
        this.clock = clock;
    }

    // N-04-5 내 즐겨찾기 상품 코드 (최근에 담은 순)
    @Transactional(readOnly = true)
    public LoanDtos.FavoriteList list(long userId) {
        return new LoanDtos.FavoriteList(loanMapper.selectFavoriteCodes(userId));
    }

    // N-37-3 즐겨찾기 추가. 이미 담겨 있어도 성공이다. 없는 상품이면 404 PRODUCT_NOT_FOUND
    @Transactional
    public void add(long userId, String productCode) {
        long productId = requireProductId(productCode);
        try {
            loanMapper.insertFavorite(userId, productId, LocalDateTime.now(clock));
        } catch (DuplicateKeyException alreadyAdded) {
            // 동시에 두 번 눌러 같은 줄이 먼저 들어간 경우 — 담긴 상태는 같으므로 성공으로 본다.
        }
    }

    // N-37-3 즐겨찾기 해제. 담겨 있지 않아도 성공이다. 없는 상품이면 404 PRODUCT_NOT_FOUND
    @Transactional
    public void remove(long userId, String productCode) {
        loanMapper.deleteFavorite(userId, requireProductId(productCode));
    }

    private long requireProductId(String productCode) {
        Long productId = loanMapper.selectProductIdByCode(productCode);
        if (productId == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "대출 상품을 찾을 수 없습니다.");
        }
        return productId;
    }
}
