package com.baeksuescape.finance.service;

import com.baeksuescape.finance.dto.PeerBenchmarkResponse;
import com.baeksuescape.finance.mapper.PeerBenchmarkMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

// N-15-2 동년배 기준값 서비스 — 공공통계(HFS) 연령대별 평균 소득·자산·부채 조회 및 계산 로직 처리
@Slf4j
@Service
@RequiredArgsConstructor
public class PeerBenchmarkService {

    private static final int DEFAULT_STAT_YEAR = 2025;
    private static final Set<String> ALLOWED_AGE_GROUPS = Set.of("20대", "30대", "40대", "50대 이상");
    private static final Set<String> ALLOWED_JOB_TYPES = Set.of("EMPLOYEE", "SELF_EMPLOYED", "FREELANCER");

    private final PeerBenchmarkMapper peerBenchmarkMapper;

    // N-15-2 특정 연령대의 공공통계 기준값을 조회한다. DB 조회 오류는 은폐하지 않고 전파한다.
    public PeerBenchmarkResponse getPeerBenchmark(String ageGroup, Integer year) {
        int targetYear = (year != null && year > 0) ? year : DEFAULT_STAT_YEAR;
        String normalizedAge = normalizeAgeGroup(ageGroup);

        PeerBenchmarkResponse response = peerBenchmarkMapper.findByAgeGroup(targetYear, normalizedAge);
        if (response == null) {
            throw new NoSuchElementException("해당 조건의 공공통계 기준값이 존재하지 않습니다: year=" + targetYear + ", ageGroup=" + normalizedAge);
        }
        return response;
    }

    // 전체 연령대(20대, 30대, 40대, 50대 이상)의 기준값 통계 목록을 조회한다.
    public List<PeerBenchmarkResponse> getAllBenchmarks(Integer year) {
        int targetYear = (year != null && year > 0) ? year : DEFAULT_STAT_YEAR;
        List<PeerBenchmarkResponse> list = peerBenchmarkMapper.findAllByYear(targetYear);
        if (list == null || list.isEmpty()) {
            throw new NoSuchElementException("공공통계 기준값 목록이 비어 있습니다: year=" + targetYear);
        }
        return list;
    }

    // N-15-3 직군 및 연령대별 평균 통계를 조회한다 (데모 동일 직군 대비 비교 카드용).
    public PeerBenchmarkResponse getBenchmarkByJobAndAge(String jobType, String ageGroup, Integer year) {
        int targetYear = (year != null && year > 0) ? year : DEFAULT_STAT_YEAR;
        String normalizedAge = normalizeAgeGroup(ageGroup);
        String upperJob = (jobType != null) ? jobType.trim().toUpperCase() : "";

        if (!ALLOWED_JOB_TYPES.contains(upperJob)) {
            throw new IllegalArgumentException("유효하지 않은 직군 코드입니다. 허용값: " + ALLOWED_JOB_TYPES);
        }

        PeerBenchmarkResponse response = peerBenchmarkMapper.findByJobTypeAndAgeGroup(targetYear, upperJob, normalizedAge);
        if (response == null) {
            throw new NoSuchElementException("해당 조건의 직군·연령별 기준값이 존재하지 않습니다: jobType=" + upperJob + ", ageGroup=" + normalizedAge);
        }
        return response;
    }

    // 출생연도로부터 연령대 4개 구간(20대, 30대, 40대, 50대 이상)을 계산한다.
    public String calculateAgeGroupFromBirthYear(Integer birthYear) {
        if (birthYear == null) {
            throw new IllegalArgumentException("출생연도가 입력되지 않았습니다.");
        }
        int currentYear = LocalDate.now().getYear();
        int age = currentYear - birthYear;

        if (age < 19 || age > 120) {
            throw new IllegalArgumentException("유효하지 않은 출생연도입니다: " + birthYear + " (만 " + age + "세)");
        }

        if (age < 30) {
            return "20대";
        } else if (age < 40) {
            return "30대";
        } else if (age < 50) {
            return "40대";
        } else {
            return "50대 이상";
        }
    }

    // 연령대 입력값을 엄격히 검증하여 표준 규격(20대, 30대, 40대, 50대 이상)으로 반환한다.
    public String normalizeAgeGroup(String input) {
        if (input == null || input.trim().isEmpty()) {
            throw new IllegalArgumentException("연령대(ageGroup)는 필수 입력값입니다. 허용값: " + ALLOWED_AGE_GROUPS);
        }
        String clean = input.trim();
        if (clean.equals("20대") || clean.equalsIgnoreCase("20s")) return "20대";
        if (clean.equals("30대") || clean.equalsIgnoreCase("30s")) return "30대";
        if (clean.equals("40대") || clean.equalsIgnoreCase("40s")) return "40대";
        if (clean.equals("50대 이상") || clean.equals("50대이상") || clean.equalsIgnoreCase("50s")) return "50대 이상";

        throw new IllegalArgumentException("유효하지 않은 연령대입니다: '" + input + "'. 허용값: " + ALLOWED_AGE_GROUPS);
    }
}
