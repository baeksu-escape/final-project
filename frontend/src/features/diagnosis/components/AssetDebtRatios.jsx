import { Fragment } from 'react'
import { Card, Chip } from '../../../common/components/index.js'
import { PAYMENT_STATUS_LABELS } from '../../dataInput/config/altDataSources.js'
import { ASSET_DEBT_RISK_THRESHOLDS } from '../utils/financeCalculations.js'

const LABELS = { safe: '안전', caution: '주의', danger: '위험', unavailable: '계산 불가' }
const METRICS = [
  { key: 'dsr', label: '상환 부담률 (DSR)', max: 80, description: '연소득 중 1년간 빚을 갚는 데 쓰는 금액의 비율입니다.' },
  { key: 'debtToAsset', label: '자산 대비 부채', max: 120, description: '가진 자산에 비해 부채가 얼마나 되는지 봅니다.' },
  { key: 'debtToNetAsset', label: '순자산 대비 부채', max: 200, description: '자산에서 부채를 뺀 순자산과 부채를 비교합니다.' },
]
const REASONS = {
  income_zero: '연소득이 0원이어서 비율을 계산할 수 없습니다.',
  income_missing: '연소득 또는 상환액을 확인해 주세요.',
  asset_missing: '총자산이 미입력입니다. 0원으로 대체하지 않습니다.',
  asset_zero: '총자산이 0원이어서 자산 대비 비율을 계산할 수 없습니다.',
  asset_or_debt_missing: '총자산 또는 총부채를 입력해 주세요.',
  debt_missing: '총부채가 미입력입니다.',
  net_asset_not_positive: '순자산이 0원 이하이므로 비율을 계산할 수 없습니다.',
}

// N-16-1·N-16-2 계산 결과만 받아 비율·위험 단계를 표시한다. 미산출 비율은 빈 막대와 사유로 구분한다.
// N-20-5 상환 부담률 아래에 저장된 공과금 납부 기록을 참고 항목으로 표시한다.
export default function AssetDebtRatios({ result, utilityPayment, utilityPaymentInvalid }) {
  const incomplete = METRICS.some(({ key }) => result?.ratios?.[key]?.value == null)
  const overall = result?.overallRisk ?? 'unavailable'
  return <Card title="건전성 진단" className="ad-diagnosis">
    <div className={`ad-summary ad-risk--${overall}`}><Chip>종합 {LABELS[overall] ?? '계산 불가'}</Chip></div>
    {incomplete && <p className="ad-hint">일부 비율은 계산할 수 없습니다. 확인 가능한 지표의 위험·주의 단계는 그대로 표시합니다.</p>}
    <div className="ad-ratios">{METRICS.map((metric) => {
      const ratio = result?.ratios?.[metric.key]
      const value = ratio?.value
      const available = typeof value === 'number' && Number.isFinite(value)
      const risk = available ? ratio.risk : 'unavailable'
      const thresholds = ASSET_DEBT_RISK_THRESHOLDS[metric.key]
      return <Fragment key={metric.key}><section className={`ad-ratio ad-risk--${risk}`}>
        <div className="ad-ratio__heading"><h3>{metric.label}</h3><span><strong>{available ? `${value.toFixed(1)}%` : '—'}</strong> <Chip>{LABELS[risk] ?? '계산 불가'}</Chip></span></div>
        {available ? <><svg className="ad-ratio__meter" role="img" aria-label={`${metric.label} ${value.toFixed(1)}%, 주의 기준 ${thresholds.caution}%, 위험 기준 ${thresholds.danger}%`}>
          <rect className="ad-ratio__track" x="0%" y="3" width="100%" height="8" rx="4" />
          <rect className="ad-ratio__fill" x="0%" y="3" width={`${Math.min(100, value / metric.max * 100)}%`} height="8" rx="4" />
          {/* N-16-2 그래프 범위 안의 주의·위험 기준을 트랙에 표시한다. */}
          {thresholds.caution <= metric.max && <line className="ad-ratio__threshold" x1={`${thresholds.caution / metric.max * 100}%`} x2={`${thresholds.caution / metric.max * 100}%`} y1="3" y2="11" />}
          {thresholds.danger <= metric.max && <line className="ad-ratio__threshold" x1={`${thresholds.danger / metric.max * 100}%`} x2={`${thresholds.danger / metric.max * 100}%`} y1="3" y2="11" />}
        </svg><div className="ad-ratio__scale" aria-hidden="true"><span>0%</span><span>{metric.max}%</span></div></> : <p className="ad-unavailable">{REASONS[ratio?.unavailableReason] ?? '입력값을 확인해 주세요. 계산할 수 없는 비율은 0%로 표시하지 않습니다.'}</p>}
        <p className="ad-hint">{metric.description} 예시 기준: {thresholds.caution}% 주의 · {thresholds.danger}% 위험</p>
      </section>{metric.key === 'dsr' && <UtilityPaymentSummary utilityPayment={utilityPayment} utilityPaymentInvalid={utilityPaymentInvalid} />}</Fragment>
    })}</div>
  </Card>
}

// N-20-5 공과금 납부율과 월별 상태를 보여 준다. 기록 없음과 응답 형식 오류는 각각 안내한다.
function UtilityPaymentSummary({ utilityPayment, utilityPaymentInvalid }) {
  const rate = utilityPayment?.onTimeRatePct
  const emptyMessage = utilityPaymentInvalid ? '공과금 납부 정보를 확인할 수 없어요.' : '공과금 납부 기록이 없어요.'
  return <section>
    <div className="ad-ratio__heading">
      <h3>공과금 기한 내 납부율 (참고)</h3>
      <strong>{rate == null ? '—' : `${rate.toFixed(1)}%`}</strong>
    </div>
    {utilityPayment ? <>
      <p className="ad-hint">
        최근 {utilityPayment.recordedMonthCount}개월 중 기한 내 {utilityPayment.onTimeMonthCount}개월
        {utilityPayment.recordedMonthCount < 12 && ' · 12개월 미만 기록 기준'}
      </p>
      <ul className="l-g2" aria-label="월별 공과금 납부 상태">
        {utilityPayment.months.map(({ billMonth, paymentStatusCode }) => (
          <li key={billMonth}><Chip>{billMonth} {PAYMENT_STATUS_LABELS[paymentStatusCode]}</Chip></li>
        ))}
      </ul>
    </> : <p className="ad-hint">{emptyMessage}</p>}
    <p className="ad-hint">공과금 납부율은 DSR 계산과 위험 단계에 반영되지 않아요.</p>
  </section>
}
