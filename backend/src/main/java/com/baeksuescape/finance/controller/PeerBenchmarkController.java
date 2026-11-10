package com.baeksuescape.finance.controller;

import com.baeksuescape.finance.dto.PeerBenchmarkResponse;
import com.baeksuescape.finance.service.PeerBenchmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

// N-15-2 동년배 기준값 조회 API 컨트롤러 — 공공통계(HFS) 연령대별 평균 소득·자산·부채 제공
@RestController
@RequestMapping("/api/finance")
@RequiredArgsConstructor
public class PeerBenchmarkController {

    private final PeerBenchmarkService peerBenchmarkService;

    // N-15-2 동년배(또는 직군별) 기준값을 조회한다.
    @GetMapping("/peer-benchmark")
    public ResponseEntity<PeerBenchmarkResponse> getPeerBenchmark(
            @RequestParam(value = "ageGroup", required = false) String ageGroup,
            @RequestParam(value = "birthYear", required = false) Integer birthYear,
            @RequestParam(value = "jobType", required = false) String jobType,
            @RequestParam(value = "year", required = false) Integer year
    ) {
        String targetAgeGroup = ageGroup;
        if ((targetAgeGroup == null || targetAgeGroup.trim().isEmpty()) && birthYear != null) {
            targetAgeGroup = peerBenchmarkService.calculateAgeGroupFromBirthYear(birthYear);
        }

        PeerBenchmarkResponse response;
        if (jobType != null && !jobType.trim().isEmpty()) {
            response = peerBenchmarkService.getBenchmarkByJobAndAge(jobType, targetAgeGroup, year);
        } else {
            response = peerBenchmarkService.getPeerBenchmark(targetAgeGroup, year);
        }

        return ResponseEntity.ok(response);
    }

    // 전체 연령대(20대, 30대, 40대, 50대 이상)의 기준값 통계 목록을 조회한다.
    @GetMapping("/peer-benchmark/all")
    public ResponseEntity<List<PeerBenchmarkResponse>> getAllPeerBenchmarks(
            @RequestParam(value = "year", required = false) Integer year
    ) {
        List<PeerBenchmarkResponse> responseList = peerBenchmarkService.getAllBenchmarks(year);
        return ResponseEntity.ok(responseList);
    }

    // 잘못된 입력 파라미터 예외 처리 (400 Bad Request)
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("status", 400, "error", "Bad Request", "message", e.getMessage()));
    }

    // 조회 데이터 부재 예외 처리 (404 Not Found)
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("status", 404, "error", "Not Found", "message", e.getMessage()));
    }
}
