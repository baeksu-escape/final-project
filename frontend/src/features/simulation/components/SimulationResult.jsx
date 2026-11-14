import { Card, Chip } from '../../../common/components/index.js'
import { formatSigned, GRADE_LABELS } from '../adapters/simulationAdapter.js'

const gradeText = (code) => GRADE_LABELS[code] ?? '—'
const rateText = (value) => (value === null ? '—' : `연 ${value.toFixed(1)}%`)
const moneyText = (value) => (value === null ? '—' : `${Math.round(value).toLocaleString('ko-KR')}원`)
// 부도 확률은 0~1 값으로 받고 화면에서만 %로 바꾼다.
const probText = (value) => (value === null ? '—' : `${(value * 100).toFixed(value * 100 < 1 ? 2 : 1)}%`)

// N-18-9 현재·예상 점수, 등급 변화, 금융 이력·대안 데이터 영향, 금리·한도·부도 확률을 보여 준다.
export default function SimulationResult({ currentScore, result, stale }) {
  if (!result) {
    return (
      <Card title="예상 대안 점수" className="sim-result">
        <p className="sim-big">{currentScore ?? '—'}</p>
        <p className="sim-hint">지금 대안 점수입니다. 조건을 바꾸면 입력이 멈춘 뒤 자동으로 결과가 나옵니다.</p>
      </Card>
    )
  }
  const { current, changed } = result
  return (
    <Card title="예상 대안 점수" className="sim-result">
      <div className="sim-row sim-row--baseline"><span className="sim-big">{changed.score ?? '—'}</span><span className={result.delta < 0 ? 'sim-mid sim-neg' : 'sim-mid sim-pos'}>{result.delta === null ? '' : formatSigned(result.delta)}</span></div>
      <p className="sim-hint">지금 {current.score ?? '—'}점 → 바꾸면 {changed.score ?? '—'}점</p>
      <div><Chip accent>{current.gradeCode === changed.gradeCode ? `${gradeText(changed.gradeCode)} 등급 유지` : `${gradeText(current.gradeCode)} → ${gradeText(changed.gradeCode)}`}</Chip></div>
      <div className="sim-impacts">
        <div><span className="sim-hint">금융 이력 영향</span><strong>{result.financialImpact === null ? '—' : formatSigned(result.financialImpact)}</strong></div>
        <div><span className="sim-hint">대안 데이터 영향</span><strong>{result.alternativeImpact === null ? '—' : formatSigned(result.alternativeImpact)}</strong></div>
      </div>
      <table className="sim-table">
        <thead><tr><th scope="col"></th><th scope="col">지금</th><th scope="col">바꾸면</th></tr></thead>
        <tbody>
          <tr><th scope="row">예상 금리</th><td>{rateText(current.interestRatePct)}</td><td>{rateText(changed.interestRatePct)}</td></tr>
          <tr><th scope="row">예상 한도</th><td>{moneyText(current.limitAmount)}</td><td>{moneyText(changed.limitAmount)}</td></tr>
          <tr><th scope="row">예상 부도 확률</th><td>{probText(current.defaultProbability)}</td><td>{probText(changed.defaultProbability)}</td></tr>
        </tbody>
      </table>
      {stale && <p className="sim-warn">위 결과는 이전 조건 기준입니다. 지금 입력으로 다시 계산되면 바뀝니다.</p>}
      <p className="sim-hint">금리·한도·부도 확률은 같은 점수대의 참고 정보이며 시연용 계산식으로 구한 값입니다(N-18). 실제 점수와 평가에는 반영되지 않습니다.</p>
    </Card>
  )
}
