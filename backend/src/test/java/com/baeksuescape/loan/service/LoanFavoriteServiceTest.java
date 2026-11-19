package com.baeksuescape.loan.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.loan.mapper.LoanMapper;

// N-37-3 즐겨찾기 추가·해제 규칙 — 회원 번호 전달, 멱등, 없는 상품 404. DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
class LoanFavoriteServiceTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-19T01:00:00Z"), SEOUL);

    @Mock
    private LoanMapper loanMapper;
    private LoanFavoriteService service;

    @BeforeEach
    void setUp() {
        service = new LoanFavoriteService(loanMapper, CLOCK);
    }

    @Test
    void 목록은_그_회원_번호로_조회한다() {
        given(loanMapper.selectFavoriteCodes(7L)).willReturn(List.of("LP003", "LP001"));

        assertThat(service.list(7L).items()).containsExactly("LP003", "LP001");
    }

    @Test
    void 추가는_상품_번호와_서버_시각으로_저장한다() {
        given(loanMapper.selectProductIdByCode("LP001")).willReturn(1L);

        service.add(7L, "LP001");

        verify(loanMapper).insertFavorite(7L, 1L, LocalDateTime.now(CLOCK));
    }

    @Test
    void 이미_담았거나_동시에_눌러_중복_키가_나도_성공이다() {
        given(loanMapper.selectProductIdByCode("LP001")).willReturn(1L);
        willThrow(new DuplicateKeyException("PK_LOAN_PRODUCT_FAVORITE")).given(loanMapper).insertFavorite(anyLong(), anyLong(), any());

        service.add(7L, "LP001");
    }

    @Test
    void 해제는_없어도_성공이고_그_회원_것만_지운다() {
        given(loanMapper.selectProductIdByCode("LP001")).willReturn(1L);
        given(loanMapper.deleteFavorite(7L, 1L)).willReturn(0);

        service.remove(7L, "LP001");

        verify(loanMapper).deleteFavorite(7L, 1L);
    }

    @Test
    void 없는_상품은_추가와_해제_모두_404_PRODUCT_NOT_FOUND() {
        given(loanMapper.selectProductIdByCode("LP999")).willReturn(null);

        assertThatThrownBy(() -> service.add(7L, "LP999")).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("PRODUCT_NOT_FOUND"));
        assertThatThrownBy(() -> service.remove(7L, "LP999")).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getStatus().value()).isEqualTo(404));
        verify(loanMapper, never()).insertFavorite(anyLong(), anyLong(), any());
        verify(loanMapper, never()).deleteFavorite(anyLong(), anyLong());
    }
}
