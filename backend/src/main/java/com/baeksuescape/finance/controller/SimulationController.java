package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.ScoreBandOfferResponse;
import com.baeksuescape.finance.service.ScoreBandOfferService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * N-18 신용케어 시뮬레이터 REST 컨트롤러 (FP-170).
 * 지금은 같은 점수대 금리·한도 조회만 있다. 점수 재계산(N-18-5)은 B조 예측 서버가 준비되면 추가한다.
 */
@RestController
@RequestMapping("/api/simulation")
@RequiredArgsConstructor
public class SimulationController {

    private final ScoreBandOfferService scoreBandOfferService;

    /**
     * N-18-7 같은 점수대 참고 금리·한도 조회 API. 점수(0~1000)를 받아 점수대의 금리 범위·평균·한도와 등급을 돌려준다.
     * 상품 추천은 A조 담당이라 여기서 하지 않는다.
     */
    @GetMapping("/score-band-offer")
    public ResponseEntity<ScoreBandOfferResponse> getScoreBandOffer(@RequestParam int score) {
        return ResponseEntity.ok(scoreBandOfferService.findOffer(score));
    }
}
