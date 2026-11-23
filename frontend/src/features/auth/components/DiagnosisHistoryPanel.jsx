import { useEffect, useState } from 'react'
import { Card } from '../../../common/components/index.js'
import { fetchDiagnosisHistory } from '../api/diagnosisHistoryApi.js'
import DiagnosisHistoryTable from './DiagnosisHistoryTable.jsx'
import DiagnosisScoreChart from './DiagnosisScoreChart.jsx'

// FP-222 v2 마이 페이지 [진단내역] 탭 — 진단 내역(MEM-06)을 한 번 불러와 위에는 점수 변화 그래프, 아래에는 지금처럼 표를 보여 준다.
export default function DiagnosisHistoryPanel() {
  const [items, setItems] = useState(null)
  const [loadError, setLoadError] = useState('')

  // 탭에 들어올 때 진단 내역을 한 번 불러온다.
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

  return (
    <Card title="진단 내역" className="my-page-history-card">
      {loadError && (
        <p className="diagnosis-history__error" role="alert">
          {loadError}
        </p>
      )}
      {!loadError && items === null && <p className="diagnosis-history__loading">진단 내역을 불러오는 중입니다.</p>}
      {!loadError && items !== null && (
        <>
          {items.length > 0 && <DiagnosisScoreChart items={items} />}
          <DiagnosisHistoryTable items={items} />
        </>
      )}
    </Card>
  )
}
