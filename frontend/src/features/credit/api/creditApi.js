import { apiGet } from '../../../common/api/client.js'
import '../mocks/creditMockHandlers.js'

// N-12-1 로그인한 회원의 최신 신용 리포트를 조회한다.
export function fetchCreditReport() {
  return apiGet('/api/report/me')
}

// N-04-6 진단 내역에서 현재 평가의 지난번 대비 변화를 조회한다.
// TODO(PR #45 병합 후): 우찬 님 fetchDiagnosisHistory로 바꾸고 리포트 mock requestId를 우찬 mock의 최신 diagnosisId와 맞춘다.
export function fetchCreditDiagnosisHistory() {
  return apiGet('/api/members/me/diagnoses')
}
