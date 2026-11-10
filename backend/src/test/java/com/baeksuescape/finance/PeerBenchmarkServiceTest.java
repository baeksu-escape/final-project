package com.baeksuescape.finance;

import com.baeksuescape.finance.dto.PeerBenchmarkResponse;
import com.baeksuescape.finance.mapper.PeerBenchmarkMapper;
import com.baeksuescape.finance.service.PeerBenchmarkService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

// N-15-2 동년배 기준값 서비스 단위 테스트
@ExtendWith(MockitoExtension.class)
class PeerBenchmarkServiceTest {

    @Mock
    private PeerBenchmarkMapper peerBenchmarkMapper;

    @InjectMocks
    private PeerBenchmarkService peerBenchmarkService;

    @Test
    @DisplayName("DB에 데이터가 있을 때 정상적으로 통계값을 조회한다")
    void getPeerBenchmark_fromMapper() {
        // given
        PeerBenchmarkResponse mockRes = PeerBenchmarkResponse.builder()
                .statYear(2025)
                .ageGroup("30대")
                .avgAnnualIncome(38000000L)
                .avgTotalAsset(98000000L)
                .avgTotalDebt(56000000L)
                .sampleSize(4120)
                .build();
        given(peerBenchmarkMapper.findByAgeGroup(2025, "30대")).willReturn(mockRes);

        // when
        PeerBenchmarkResponse result = peerBenchmarkService.getPeerBenchmark("30대", 2025);

        // then
        assertThat(result).isNotNull();
        assertThat(result.getAgeGroup()).isEqualTo("30대");
        assertThat(result.getAvgAnnualIncome()).isEqualTo(38000000L);
    }

    @Test
    @DisplayName("DB 조회 결과가 null이면 예외를 숨기지 않고 NoSuchElementException을 던진다")
    void getPeerBenchmark_notFound() {
        // given
        given(peerBenchmarkMapper.findByAgeGroup(2025, "20대")).willReturn(null);

        // when & then
        assertThatThrownBy(() -> peerBenchmarkService.getPeerBenchmark("20대", 2025))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessageContaining("공공통계 기준값이 존재하지 않습니다");
    }

    @Test
    @DisplayName("유효하지 않은 연령대 입력(60대, 25, abc, null, 빈문자열)은 IllegalArgumentException을 던진다")
    void normalizeAgeGroup_invalid() {
        assertThatThrownBy(() -> peerBenchmarkService.normalizeAgeGroup("60대"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> peerBenchmarkService.normalizeAgeGroup("25"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> peerBenchmarkService.normalizeAgeGroup("abc"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> peerBenchmarkService.normalizeAgeGroup(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> peerBenchmarkService.normalizeAgeGroup(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("허용된 규격(20대, 30대, 40대, 50대 이상) 및 s 표기는 정상적으로 표준 연령대로 반환한다")
    void normalizeAgeGroup_valid() {
        assertThat(peerBenchmarkService.normalizeAgeGroup("20대")).isEqualTo("20대");
        assertThat(peerBenchmarkService.normalizeAgeGroup("20s")).isEqualTo("20대");
        assertThat(peerBenchmarkService.normalizeAgeGroup("30대")).isEqualTo("30대");
        assertThat(peerBenchmarkService.normalizeAgeGroup("30s")).isEqualTo("30대");
        assertThat(peerBenchmarkService.normalizeAgeGroup("40대")).isEqualTo("40대");
        assertThat(peerBenchmarkService.normalizeAgeGroup("50대 이상")).isEqualTo("50대 이상");
        assertThat(peerBenchmarkService.normalizeAgeGroup("50s")).isEqualTo("50대 이상");
    }

    @Test
    @DisplayName("출생연도로부터 연령대 4개 구간을 정상 계산하며 50세 이상은 50대 이상으로 분류한다")
    void calculateAgeGroupFromBirthYear_valid() {
        int currentYear = LocalDate.now().getYear();

        assertThat(peerBenchmarkService.calculateAgeGroupFromBirthYear(currentYear - 25)).isEqualTo("20대");
        assertThat(peerBenchmarkService.calculateAgeGroupFromBirthYear(currentYear - 35)).isEqualTo("30대");
        assertThat(peerBenchmarkService.calculateAgeGroupFromBirthYear(currentYear - 45)).isEqualTo("40대");
        assertThat(peerBenchmarkService.calculateAgeGroupFromBirthYear(currentYear - 58)).isEqualTo("50대 이상");
        assertThat(peerBenchmarkService.calculateAgeGroupFromBirthYear(currentYear - 70)).isEqualTo("50대 이상");
    }

    @Test
    @DisplayName("비정상적인 출생연도(미성년자, 120세 초과, null)는 IllegalArgumentException을 던진다")
    void calculateAgeGroupFromBirthYear_invalid() {
        int currentYear = LocalDate.now().getYear();

        assertThatThrownBy(() -> peerBenchmarkService.calculateAgeGroupFromBirthYear(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> peerBenchmarkService.calculateAgeGroupFromBirthYear(currentYear - 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> peerBenchmarkService.calculateAgeGroupFromBirthYear(1800))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("직군 및 연령대별 평균 조회가 정상 동작한다")
    void getBenchmarkByJobAndAge_valid() {
        // given
        PeerBenchmarkResponse mockRes = PeerBenchmarkResponse.builder()
                .statYear(2025)
                .ageGroup("30대")
                .avgAnnualIncome(43000000L)
                .build();
        given(peerBenchmarkMapper.findByJobTypeAndAgeGroup(2025, "EMPLOYEE", "30대")).willReturn(mockRes);

        // when
        PeerBenchmarkResponse result = peerBenchmarkService.getBenchmarkByJobAndAge("EMPLOYEE", "30대", 2025);

        // then
        assertThat(result).isNotNull();
        assertThat(result.getAvgAnnualIncome()).isEqualTo(43000000L);
    }

    @Test
    @DisplayName("허용되지 않은 직군 코드는 IllegalArgumentException을 던진다")
    void getBenchmarkByJobAndAge_invalidJob() {
        assertThatThrownBy(() -> peerBenchmarkService.getBenchmarkByJobAndAge("INVALID_JOB", "30대", 2025))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
