package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.GradeBandRow;
import com.baeksuescape.finance.dto.ScoreBandOfferResponse;
import com.baeksuescape.finance.dto.ScoreBandOfferRow;
import com.baeksuescape.finance.mapper.ScoreBandOfferMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.exception.ErrorResponse.FieldErrorItem;

import java.math.BigDecimal;
import java.util.List;

/**
 * FP-170 N-18-7 같은 점수대 참고 금리·한도 조회 서비스.
 * 시뮬레이터의 재계산 점수나 현재 점수를 받아 그 점수대의 금리·한도와 등급을 돌려준다. A조 상품 추천에서도 이 메서드를 재사용할 수 있다.
 */
@Service
@RequiredArgsConstructor
public class ScoreBandOfferService {

    /** 점수 범위 (decisions.md 1-4: 0~1000) */
    public static final int MIN_SCORE = 0;
    public static final int MAX_SCORE = 1000;

    private final ScoreBandOfferMapper scoreBandOfferMapper;

    /**
     * 점수에 맞는 점수대 금리·한도와 등급을 찾는다.
     * 점수가 0~1000 밖이면 400 INVALID_INPUT, 맞는 점수대나 등급이 없으면(시드 미적재 등) 404 NOT_FOUND를 던진다.
     */
    public ScoreBandOfferResponse findOffer(int score) {
        if (score < MIN_SCORE || score > MAX_SCORE) {
            String message = "점수는 0~1000 사이여야 합니다.";
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message,
                    List.of(new FieldErrorItem("score", message)));
        }

        ScoreBandOfferRow offer = scoreBandOfferMapper.selectOfferByScore(score);
        if (offer == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "해당 점수대의 금리·한도 자료가 없습니다.");
        }
        GradeBandRow grade = scoreBandOfferMapper.selectActiveGradeBand(score);
        if (grade == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용 중인 등급 구간에서 해당 점수의 등급을 찾지 못했습니다.");
        }

        return ScoreBandOfferResponse.builder()
                .score(score)
                .gradeBand(grade.getGradeBandCode())
                .cutoffVersion(grade.getCutoffVersion())
                .bandMinScore(offer.getMinScore())
                .bandMaxScore(offer.getMaxScore())
                .expectedMinRate(offer.getRateMinPct().doubleValue())
                .expectedMaxRate(offer.getRateMaxPct().doubleValue())
                .expectedAvgRate(toDouble(offer.getRateAvgPct()))
                .expectedLimitAmount(offer.getLimitAmt())
                .baseDate(offer.getBaseDate() == null ? null : offer.getBaseDate().toString())
                .dummyNotice(true)
                .build();
    }

    private Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }
}
