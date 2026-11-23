import { apiGet } from '../../../common/api/client.js'
import '../mocks/creditMockHandlers.js'

// N-12-1 로그인한 회원의 최신 신용 리포트를 조회한다.
export function fetchCreditReport() {
  return apiGet('/api/report/me')
}

// N-13-1 RPT-05 로그인 회원의 직군·연령대별 점수 위치를 조회한다.
export function fetchScorePercentile() {
  return apiGet('/api/members/me/score-percentile')
}
