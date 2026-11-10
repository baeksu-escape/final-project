import { useEffect, useState } from 'react'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { fetchDiagnosisHistory } from '../api/diagnosisHistoryApi.js'
import { EMPTY_HISTORY_MESSAGE, GRADE_LABELS } from '../diagnosisHistoryConfig.js'

// 가장 오래된 진단처럼 변화 값이 없을 때 보일 문자.
const NO_CHANGE = '—'

// 서버 시각 문자열(2026-11-09T14:30:00)을 "2026-11-09 14:30"으로 보여 준다.
function formatCalculatedAt(value) {
  return value.slice(0, 16).replace('T', ' ')
}

// 변화 값을 부호와 함께 보여 준다. 예) 12 → +12, -5 → -5, null → —
function formatChange(change) {
  if (change === null || change === undefined) return NO_CHANGE
  return change > 0 ? `+${change}` : String(change)
}

// N-04-6 진단 내역 조회 — 지난 평가를 최신순 표로 보여 준다. 순서·변화·등급은 서버가 보낸 값을 그대로 쓰고, 모델 버전은 보여 주지 않는다.
export default function DiagnosisHistoryTable() {
  const [items, setItems] = useState(null)
  const [loadError, setLoadError] = useState('')

  // 화면에 들어올 때 진단 내역을 한 번 불러온다.
  useEffect(() => {
    let cancelled = false
    fetchDiagnosisHistory()
      .then((result) => {
        if (!cancelled) setItems(result.items)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) {
    return (
      <p className="diagnosis-history__error" role="alert">
        {loadError}
      </p>
    )
  }
  if (items === null) return <p className="diagnosis-history__loading">진단 내역을 불러오는 중입니다.</p>
  if (items.length === 0) return <p className="diagnosis-history__empty">{EMPTY_HISTORY_MESSAGE}</p>

  return (
    <table className="diagnosis-history-table">
      <caption className="diagnosis-history-table__caption">지난 진단 결과(최신순)</caption>
      <thead>
        <tr>
          <th scope="col">산출 일시</th>
          <th scope="col">직군</th>
          <th scope="col">기존</th>
          <th scope="col">대안</th>
          <th scope="col">등급</th>
          <th scope="col">변화</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.diagnosisId}>
            <td>{formatCalculatedAt(item.calculatedAt)}</td>
            <td>{JOB_TYPE_LABELS[item.jobType] ?? NO_CHANGE}</td>
            <td>{item.existingScore}</td>
            <td>{item.alternativeScore}</td>
            <td>{GRADE_LABELS[item.grade] ?? item.grade}</td>
            <td>{formatChange(item.alternativeScoreChange)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
