import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { scoredReport } from './creditMockData.js'

// N-12-6 mock 시나리오를 메모리에서 전환한다. 새로고침하면 정상 상태로 돌아간다.
// 개발자 도구에서 import('/src/features/credit/mocks/creditMockHandlers.js').then((m) => m.setCreditMockScenario('notFound'))를 실행한 뒤 페이지를 다시 방문한다. 값은 scored, notFound, notScorable, notScorableInput, notScorableStale, notScorableModel, traditionalUnavailable이다.
let scenario = 'scored'
export function setCreditMockScenario(value) {
  scenario = value
}

// N-12-1 회원 인증 후 최신 평가와 산출 불가 상황을 모의한다.
registerMockHandlers({
  'GET /api/report/me': ({ token }) => {
    requireMockUser(token)
    if (scenario === 'notFound') throw new ApiError(404, '평가가 없습니다.', { code: 'ASSESSMENT_NOT_FOUND' })
    const report = structuredClone(scoredReport)
    const reasons = {
      notScorable: 'CONSENT_REQUIRED',
      notScorableInput: 'INPUT_INCOMPLETE',
      notScorableStale: 'STALE_INPUT',
      notScorableModel: 'MODEL_ERROR',
    }
    if (Object.hasOwn(reasons, scenario)) {
      report.gradeStatusCode = 'NOT_SCORABLE'
      report.notScorableReasonCode = reasons[scenario]
      report.traditional = null
      report.alternative = null
      report.comparison = null
      report.gradeBands = null
      report.shap = null
      delete report.modelFeatures
    }
    if (scenario === 'traditionalUnavailable') {
      report.traditional = { scorableYn: 'N', score: null, gradeBandCode: null, defaultProb: null }
      report.comparison = { scoreDiff: null, gradeChanged: null }
    }
    return report
  },
})
