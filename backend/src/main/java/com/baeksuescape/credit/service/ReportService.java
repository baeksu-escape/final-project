package com.baeksuescape.credit.service;

import com.baeksuescape.credit.dto.ReportAssessment;
import com.baeksuescape.credit.dto.ReportResponse;
import com.baeksuescape.credit.mapper.ReportMapper;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// N-12-1·N-14-1 저장된 평가만 읽는다. 인증된 회원 번호는 추후 공통 인증 컨트롤러에서 전달한다.
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {
    private final ReportMapper reportMapper;

    // N-12-1 최신 평가가 없으면 빈 결과를 반환한다. HTTP 상태·공통 예외 연결 규칙은 아직 정하지 않는다.
    public Optional<ReportResponse> findLatest(Long userId) {
        requireUser(userId);
        return Optional.ofNullable(reportMapper.findLatest(userId)).map(row -> assemble(userId, row));
    }

    // N-12-1 타인 소유와 존재하지 않는 요청은 모두 빈 결과로 처리해 소유 여부를 노출하지 않는다.
    public Optional<ReportResponse> findByRequestId(Long userId, String requestId) {
        requireUser(userId);
        if (requestId == null || !requestId.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
            throw new IllegalArgumentException("평가 요청 번호 형식이 올바르지 않습니다.");
        }
        return Optional.ofNullable(reportMapper.findByRequestId(userId, requestId)).map(row -> assemble(userId, row));
    }

    // N-12-3·N-14-4 저장된 점수와 버전별 경계·피처를 조립하며 재평가하거나 NULL을 0으로 바꾸지 않는다.
    private ReportResponse assemble(Long userId, ReportAssessment row) {
        ReportResponse result = new ReportResponse();
        result.setRequestId(row.getRequestId());
        result.setAssessedAt(row.getAssessedAt());
        result.setInputBaseMonth(row.getInputBaseMonth());
        result.setWorkerTypeCode(row.getWorkerTypeCode());
        result.setGradeStatusCode(row.getGradeStatusCode());
        result.setNotScorableReasonCode(row.getNotScorableReasonCode());
        result.setModelVersion(row.getModelVersion());
        result.setAiSummary(row.getAiSummary());
        result.setTraditional(new ReportResponse.ModelResult(row.getTradScorableYn(), row.getTradScore(), row.getTradGradeBandCode(), row.getTradDefaultProb()));
        result.setAlternative(new ReportResponse.ModelResult(row.getAltScorableYn(), row.getAltScore(), row.getAltGradeBandCode(), row.getAltDefaultProb()));
        boolean comparable = "Y".equals(row.getTradScorableYn()) && "Y".equals(row.getAltScorableYn())
                && row.getTradScore() != null && row.getAltScore() != null;
        result.setComparison(new ReportResponse.Comparison(
                comparable ? row.getAltScore() - row.getTradScore() : null,
                comparable && row.getTradGradeBandCode() != null && row.getAltGradeBandCode() != null
                        ? !row.getTradGradeBandCode().equals(row.getAltGradeBandCode()) : null));
        result.setGradeBands(new ReportResponse.GradeBands(row.getCutoffVersion(), reportMapper.findGradeBands(userId, row.getAssessmentId())));
        result.setShap(new ReportResponse.Shap(row.getShapBaseScore(), reportMapper.findFactors(userId, row.getAssessmentId())));
        return result;
    }

    // N-12-1 인증 없이 회원 번호가 비어 있는 내부 호출을 차단한다.
    private void requireUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("인증된 회원 번호가 필요합니다.");
        }
    }
}
