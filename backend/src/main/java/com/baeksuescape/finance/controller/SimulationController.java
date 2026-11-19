package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.CreditCareBaseResponse;
import com.baeksuescape.finance.dto.CreditCareSimulationRequest;
import com.baeksuescape.finance.dto.CreditCareSimulationResponse;
import com.baeksuescape.finance.dto.ScoreBandOfferResponse;
import com.baeksuescape.finance.service.CreditCareSimulationService;
import com.baeksuescape.finance.service.ScoreBandOfferService;
import com.baeksuescape.global.exception.ApiException;
import com.baeksuescape.global.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final CreditCareSimulationService creditCareSimulationService;

    /**
     * N-18-7 같은 점수대 참고 금리·한도 조회 API. 점수(0~1000)를 받아 점수대의 금리 범위·평균·한도와 등급을 돌려준다.
     * 상품 추천은 A조 담당이라 여기서 하지 않는다.
     */
    @GetMapping("/score-band-offer")
    public ResponseEntity<ScoreBandOfferResponse> getScoreBandOffer(@RequestParam int score) {
        return ResponseEntity.ok(scoreBandOfferService.findOffer(score));
    }

    /** N-18-1·N-18-10 SIM-01 입력 10개의 내 실제 값 (점수가 나온 최근 평가 기준). 평가가 없으면 404 ASSESSMENT_NOT_FOUND. */
    @GetMapping("/credit-care/base")
    public ResponseEntity<CreditCareBaseResponse> getCreditCareBase(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(creditCareSimulationService.base(requireLoginUserId(user)));
    }

    /** N-18-5·N-18-8 SIM-02 바꾼 값으로 점수 재계산 (FastAPI ML-04, 저장 안 함). */
    @PostMapping("/credit-care/recalculate")
    public ResponseEntity<CreditCareSimulationResponse> recalculateCreditCare(@AuthenticationPrincipal AuthUser user,
            @RequestBody(required = false) CreditCareSimulationRequest request) {
        return ResponseEntity.ok(creditCareSimulationService.recalculate(requireLoginUserId(user), request));
    }

    // /api/simulation/**는 지금 임시 공개 경로라 토큰이 없을 수 있다. 내 평가를 읽는 API는 로그인을 요구한다.
    private long requireLoginUserId(AuthUser user) {
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        }
        return user.userId();
    }
}
