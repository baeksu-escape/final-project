import { useCallback, useEffect, useState } from 'react'
import { fetchCreditReport } from '../../credit/api/creditApi.js'
import { getLoanProducts } from './loanCatalog.js'

// N-37-1 상품과 저장된 대안 점수를 읽는다. 점수 조회 실패·미산출을 0점으로 바꾸지 않는다.
export function useLoanCatalog(userId) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ userId: null, revision: -1, products: [], score: null, loading: true, error: '', scoreNotice: '', scoreError: '' })
  // N-37-1 상품·점수 조회 실패를 다시 시도한다. 새 요청이 시작되면 이전 결과는 표시하지 않는다.
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    let active = true
    Promise.allSettled([getLoanProducts(), fetchCreditReport()]).then(([catalog, report]) => {
      if (!active) return
      const result = report.status === 'fulfilled' ? report.value?.alternative : null
      const score = result?.scorableYn === 'Y' && Number.isFinite(result.score) ? result.score : null
      // N-37-2 평가 당시 경계에 저장 등급과 점수가 함께 맞을 때만 등급을 표시한다. 새 경계는 만들지 않는다.
      const gradeBands = report.status === 'fulfilled' ? report.value?.gradeBands : null
      const gradeBand = gradeBands?.cutoffVersion && Array.isArray(gradeBands.bands)
        ? gradeBands.bands.find((band) => band.gradeBandCode === result?.gradeBandCode
          && Number.isFinite(band.minScore) && Number.isFinite(band.maxScore)
          && score != null && score >= band.minScore && score <= band.maxScore) : null
      // N-37-1 기존 리포트의 평가 없음 계약은 정상 상태다. 그 외 조회 실패만 재시도 오류로 분류한다.
      const noAssessment = report.status === 'rejected' && report.reason?.status === 404
        && report.reason?.data?.code === 'ASSESSMENT_NOT_FOUND'
      setState({ userId, revision, products: catalog.status === 'fulfilled' ? catalog.value : [], score,
        gradeBandCode: gradeBand?.gradeBandCode ?? null, loading: false,
        error: catalog.status === 'rejected' ? catalog.reason.message : '',
        scoreError: report.status === 'rejected' && !noAssessment ? '점수를 불러오지 못했습니다. 다시 시도해 주세요.' : '',
        scoreNotice: (report.status === 'fulfilled' || noAssessment) && score == null ? '저장된 대안 점수가 없어 점수 조건을 확인할 수 없습니다.' : '' })
    })
    return () => { active = false }
  }, [userId, revision])
  // N-37-1 회원이 바뀐 직후 이전 회원의 점수를 노출하지 않고 새 조회가 끝날 때까지 대기한다.
  return { ...(state.userId === userId && state.revision === revision ? state
    : { products: [], score: null, loading: true, error: '', scoreNotice: '', scoreError: '' }), reload }
}
