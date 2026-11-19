package com.baeksuescape.loan.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baeksuescape.loan.dto.LoanRows.FeatureRow;
import com.baeksuescape.loan.dto.LoanRows.ProductRow;
import com.baeksuescape.loan.dto.LoanRows.WorkerTypeRow;

// N-37 대출 상품·즐겨찾기 SQL (mapper/loan/LoanMapper.xml, DDL v0.3.2 LOAN_PRODUCT*).
@Mapper
public interface LoanMapper {

    // N-37-1 전체 상품 (PRODUCT_ID 순)
    List<ProductRow> selectProducts();

    // N-37-2 상품 한 개. 없으면 null
    ProductRow selectProductByCode(@Param("productCode") String productCode);

    // 모든 상품의 대상 직군 (행이 없는 상품은 서비스가 전 직군으로 채운다)
    List<WorkerTypeRow> selectWorkerTypes();

    // 모든 상품의 특징 문구 (표시 순서대로)
    List<FeatureRow> selectFeatures();

    // 상품 코드로 상품 번호. 없으면 null
    Long selectProductIdByCode(@Param("productCode") String productCode);

    // N-37-3·N-04-5 내 즐겨찾기 상품 코드 (최근에 담은 순)
    List<String> selectFavoriteCodes(@Param("userId") long userId);

    // N-37-3 즐겨찾기 추가. 이미 있으면 0행(멱등)
    int insertFavorite(@Param("userId") long userId, @Param("productId") long productId, @Param("now") LocalDateTime now);

    // N-37-3 즐겨찾기 해제. 없어도 0행으로 끝난다(멱등)
    int deleteFavorite(@Param("userId") long userId, @Param("productId") long productId);
}
