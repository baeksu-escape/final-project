import { apiGet } from '../../../common/api/client.js'
import '../mocks/creditMockHandlers.js'

// N-12-1 로그인한 회원의 최신 신용 리포트를 조회한다.
export function fetchCreditReport() {
  return apiGet('/api/report/me')
}
