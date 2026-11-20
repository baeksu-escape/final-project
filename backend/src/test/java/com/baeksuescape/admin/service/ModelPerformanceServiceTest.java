package com.baeksuescape.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.baeksuescape.admin.dto.ModelPerformanceDtos.JobReject;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.PerformanceView;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocPoint;
import com.baeksuescape.admin.dto.ModelPerformanceDtos.RocView;
import com.baeksuescape.admin.dto.ModelPerformanceRows.EvalSampleRow;
import com.baeksuescape.admin.dto.ModelPerformanceRows.SeedMeanAucRow;
import com.baeksuescape.admin.mapper.ModelPerformanceMapper;
import com.baeksuescape.global.exception.ApiException;

// N-25 모형 성능 비교 계산 규칙 (FP-184) — 손으로 계산한 5명 표본으로 지표 6개·직군별 오거절률·AUC·ROC 끝점·표본 기준,
// 쿼리 오류 400, ACTIVE 모델·평가 표본 없음 409를 확인한다. DB는 mock으로 대신한다.
@ExtendWith(MockitoExtension.class)
class ModelPerformanceServiceTest {

    private static final String VERSION = "LGBM-BASE-0.1";

    @Mock
    private ModelPerformanceMapper mapper;
    @InjectMocks
    private ModelPerformanceService service;

    // 연체 라벨 점수만 채운 평가 행 (비금융 라벨 점수는 연체와 같게 둔다)
    private static EvalSampleRow row(String job, String split, int bad, int legacyScore, int altScore) {
        EvalSampleRow row = new EvalSampleRow();
        row.setWorkerTypeCode(job);
        row.setSplitCode(split);
        row.setLabelAnyDelinquency12m(bad);
        row.setLabelNonfinEffect12m(bad);
        row.setScoreLegacyDelinq(legacyScore);
        row.setScoreAltDelinq(altScore);
        row.setScoreLegacyNonfin(legacyScore);
        row.setScoreAltNonfin(altScore);
        return row;
    }

    // 우량 3명(1·2·4번), 불량 2명(3·5번). 컷오프 700이면
    // 기존: 승인 1·5번 → 우량 거절 2/3, 불량 승인 1/2 / 대안: 승인 1·2·4번 → 우량 거절 0, 불량 승인 0
    private static List<EvalSampleRow> sample(String split) {
        return List.of(
                row("EMPLOYEE", "VALID", 0, 800, 750),
                row("EMPLOYEE", split, 0, 650, 720),
                row("EMPLOYEE", "VALID", 1, 600, 680),
                row("FREELANCER", "VALID", 0, 690, 710),
                row("FREELANCER", "VALID", 1, 720, 500));
    }

    @Test
    void 컷오프_기준_지표_6개와_직군별_오거절률을_계산한다() {
        given(mapper.selectActiveModelVersion()).willReturn(VERSION);
        given(mapper.selectEvalSamples(VERSION, "THINFILE")).willReturn(sample("VALID"));

        PerformanceView view = service.performance("THINFILE", "DELINQ", 700);

        assertThat(view.sampleCount()).isEqualTo(5);
        assertThat(view.badCount()).isEqualTo(2);
        assertThat(view.sampleBasis()).isEqualTo("VALID");
        assertThat(view.legacy().modelVersion()).isEqualTo(VERSION);
        assertThat(view.legacy().goodRejectRate()).isEqualTo(66.67);
        assertThat(view.legacy().badApproveRate()).isEqualTo(50.0);
        assertThat(view.legacy().approvalRate()).isEqualTo(40.0);
        assertThat(view.legacy().accuracy()).isEqualTo(40.0);
        assertThat(view.legacy().misclassCost()).isEqualTo(1.4); // (우량 거절 2 + 불량 승인 1 × 5) / 5명
        assertThat(view.alternative().goodRejectRate()).isEqualTo(0.0);
        assertThat(view.alternative().badApproveRate()).isEqualTo(0.0);
        assertThat(view.alternative().approvalRate()).isEqualTo(60.0);
        assertThat(view.alternative().accuracy()).isEqualTo(100.0);
        assertThat(view.alternative().misclassCost()).isEqualTo(0.0);

        assertThat(view.byJob()).containsExactly(
                new JobReject("EMPLOYEE", 3, 1, 50.0, 0.0),
                new JobReject("FREELANCER", 2, 1, 100.0, 0.0));
    }

    @Test
    void 씬파일은_표본으로_AUC를_계산하고_시드_1개로_표시한다() {
        given(mapper.selectActiveModelVersion()).willReturn(VERSION);
        given(mapper.selectEvalSamples(VERSION, "THINFILE")).willReturn(sample("TRAIN"));

        PerformanceView view = service.performance("THINFILE", "DELINQ", 700);

        // 기존: 불량 600은 우량 3명보다, 불량 720은 우량 800보다만 낮다 → 4/6
        assertThat(view.legacy().auc()).isEqualTo(0.6667);
        assertThat(view.alternative().auc()).isEqualTo(1.0);
        assertThat(view.aucBasis()).isEqualTo("SINGLE_SEED");
        assertThat(view.sampleBasis()).isEqualTo("TRAIN_VALID");
    }

    @Test
    void 기존_집단은_5개_시드_평균_AUC를_쓴다() {
        SeedMeanAucRow seedMean = new SeedMeanAucRow();
        seedMean.setLegacyAuc(new BigDecimal("0.6049"));
        seedMean.setAlternativeAuc(new BigDecimal("0.5991"));
        given(mapper.selectActiveModelVersion()).willReturn(VERSION);
        given(mapper.selectEvalSamples(VERSION, "LEGACY")).willReturn(sample("VALID"));
        given(mapper.selectSeedMeanAuc(VERSION, "DELINQ")).willReturn(seedMean);

        PerformanceView view = service.performance("LEGACY", "DELINQ", 700);

        assertThat(view.legacy().auc()).isEqualTo(0.6049);
        assertThat(view.alternative().auc()).isEqualTo(0.5991);
        assertThat(view.aucBasis()).isEqualTo("SEED_MEAN_5");
    }

    @Test
    void 기존_집단도_시드_평균이_없으면_표본으로_계산한다() {
        given(mapper.selectActiveModelVersion()).willReturn(VERSION);
        given(mapper.selectEvalSamples(VERSION, "LEGACY")).willReturn(sample("VALID"));
        given(mapper.selectSeedMeanAuc(VERSION, "NONFIN")).willReturn(null);

        PerformanceView view = service.performance("LEGACY", "NONFIN", 700);

        assertThat(view.legacy().auc()).isEqualTo(0.6667);
        assertThat(view.aucBasis()).isEqualTo("SINGLE_SEED");
    }

    @Test
    void 점수가_같으면_AUC에서_절반으로_센다() {
        assertThat(ModelPerformanceService.auc(new int[] { 500, 500 }, new boolean[] { true, false })).isEqualTo(0.5);
    }

    @Test
    void ROC는_0_0에서_100_100까지_10점_간격으로_준다() {
        given(mapper.selectActiveModelVersion()).willReturn(VERSION);
        given(mapper.selectEvalSamples(VERSION, "LEGACY")).willReturn(sample("VALID"));

        RocView view = service.roc("LEGACY", "DELINQ");

        List<RocPoint> points = view.legacy().points();
        assertThat(points).hasSize(102); // 기준 점수 0, 10, …, 1010
        assertThat(points.get(0)).isEqualTo(new RocPoint(0.0, 0.0));
        assertThat(points.get(points.size() - 1)).isEqualTo(new RocPoint(100.0, 100.0));
        assertThat(points.get(70)).isEqualTo(new RocPoint(66.67, 50.0)); // 기준 700 = 컷오프 700의 거절 비율
        assertThat(view.alternative().points()).hasSize(102);
    }

    @Test
    void 허용하지_않는_쿼리_값은_칸마다_400() {
        assertThatThrownBy(() -> service.performance("ALL", "DELINQ", 590))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getCode()).isEqualTo("INVALID_INPUT");
                    assertThat(e.getFieldErrors()).extracting(item -> item.field()).containsExactly("group", "cutoff");
                });
        assertThatThrownBy(() -> service.roc("LEGACY", "OTHER"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getFieldErrors()).extracting(item -> item.field())
                        .containsExactly("label"));
    }

    @Test
    void ACTIVE_모델이_없으면_409() {
        given(mapper.selectActiveModelVersion()).willReturn(null);

        assertThatThrownBy(() -> service.performance("LEGACY", "DELINQ", 700))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getCode()).isEqualTo("MODEL_EVAL_NOT_READY");
                });
    }

    @Test
    void ACTIVE_모델의_평가_표본이_없으면_409() {
        given(mapper.selectActiveModelVersion()).willReturn("DEV-DUMMY");
        given(mapper.selectEvalSamples("DEV-DUMMY", "LEGACY")).willReturn(List.of());

        assertThatThrownBy(() -> service.roc("LEGACY", "DELINQ"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getCode()).isEqualTo("MODEL_EVAL_NOT_READY");
                    assertThat(e.getMessage()).contains("DEV-DUMMY");
                });
    }
}
