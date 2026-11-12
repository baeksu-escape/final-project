import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../../common/components/Button.jsx'
import Notice from '../../../common/components/Notice.jsx'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { DATA_INPUT_PATHS } from '../../dataInput/dataInputPaths.js'
import { fetchCreditReport } from '../api/creditApi.js'
import ScoreComparisonCard from '../components/ScoreComparisonCard.jsx'
import ShapFactorsCard from '../components/ShapFactorsCard.jsx'
import '../styles/creditReport.css'

const REASONS = {
  CONSENT_REQUIRED: '대안 데이터에 동의하고 데이터를 불러와 주세요.',
  INPUT_INCOMPLETE: '입력 화면에서 필요한 정보를 입력해 주세요.',
  STALE_INPUT: '입력 정보를 최신 상태로 갱신해 주세요.',
  MODEL_ERROR: '점수를 산출하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
}

// N-12-6 신용 리포트의 최신 평가와 산출 불가 상태를 보여 준다.
export default function CreditReportPage() {
  const [state, setState] = useState({ loading: true, report: null, error: null })
  const [alertVisible, setAlertVisible] = useState(true)
  useEffect(() => {
    let active = true
    fetchCreditReport().then((report) => {
      if (active) setState({ loading: false, report, error: null })
    }).catch((error) => {
      if (active) setState({ loading: false, report: null, error })
    })
    return () => { active = false }
  }, [])

  if (state.loading) return <p role="status">신용 리포트를 불러오는 중입니다.</p>
  if (state.error?.status === 404 && state.error?.data?.code === 'ASSESSMENT_NOT_FOUND') {
    return <Notice>아직 점수가 없습니다. <Link to={DATA_INPUT_PATHS.DATA_INPUT}>입력 후 점수를 산출해 주세요.</Link></Notice>
  }
  if (state.error) return <Notice type="warn">신용 리포트를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</Notice>

  const { report } = state
  const date = report.assessedAt ? new Date(report.assessedAt).toLocaleString('ko-KR') : '-'
  const diff = report.previousScoreDiff
  const showInputLink = ['CONSENT_REQUIRED', 'INPUT_INCOMPLETE', 'STALE_INPUT'].includes(report.notScorableReasonCode)
  // TODO(RPT-02 미정): 새 점수 판단 기준
  return (
    <div className="credit-report">
      {alertVisible && report.gradeStatusCode === 'SCORED' && (
        <Notice type="success">
          <span>새 점수가 나왔어요 · 대안 {report.alternative?.score}점{diff != null && ` (지난번보다 ${diff > 0 ? '+' : ''}${diff}점)`}</span>{' '}
          <Button size="sm" onClick={() => setAlertVisible(false)}>닫기</Button>
        </Notice>
      )}
      <header>
        <h1>신용 리포트</h1>
        <p>{JOB_TYPE_LABELS[report.workerTypeCode] ?? report.workerTypeCode} 기준 · 마지막 산출 {date}</p>
      </header>
      {report.gradeStatusCode === 'NOT_SCORABLE' ? (
        <Notice type="warn">
          {REASONS[report.notScorableReasonCode] ?? '점수를 산출할 수 없습니다.'}{' '}
          {showInputLink && <Link to={DATA_INPUT_PATHS.DATA_INPUT}>입력 화면으로</Link>}
        </Notice>
      ) : <ScoreComparisonCard report={report} />}
      {report.gradeStatusCode === 'SCORED' && <ShapFactorsCard shap={report.shap} alternativeScore={report.alternative?.score} />}
      {/* FP-89: 요약 카드 자리 */}
    </div>
  )
}
