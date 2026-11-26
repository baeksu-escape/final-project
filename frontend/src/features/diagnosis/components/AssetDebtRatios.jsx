import { Card, Chip } from '../../../common/components/index.js'
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

// N-16-1·N-16-2 비율과 위험 단계를 표시하고 그래프 범위를 넘거나 계산할 수 없는 경우를 안내한다.
export default function AssetDebtRatios({ result }) {
  const incomplete = METRICS.some(({ key }) => result?.ratios?.[key]?.value == null)
  const overall = result?.overallRisk ?? 'unavailable'
  return <Card title="건전성 진단" className="ad-diagnosis">
    <div className={`ad-summary ad-risk--${overall}`}><Chip>종합 {LABELS[overall] ?? '계산 불가'}</Chip></div>
    {incomplete && <p className="ad-hint">일부 비율은 계산할 수 없습니다. 확인 가능한 지표의 위험·주의 단계는 그대로 표시합니다.</p>}
    <div className="ad-ratios">{METRICS.map((metric) => {
      const ratio = result?.ratios?.[metric.key]
      const value = ratio?.value
      const available = typeof value === 'number' && Number.isFinite(value)
      // N-16-2 흔들림 방지를 위해 기존 범위 표시 줄에서 초과를 안내한다.
      const exceedsMax = available && value > metric.max
      const risk = available ? ratio.risk : 'unavailable'
      const thresholds = ASSET_DEBT_RISK_THRESHOLDS[metric.key]
      return <section key={metric.key} className={`ad-ratio ad-risk--${risk}`}>
        <div className="ad-ratio__heading"><h3>{metric.label}</h3><span><strong>{available ? `${value.toFixed(1)}%` : '—'}</strong> <Chip>{LABELS[risk] ?? '계산 불가'}</Chip></span></div>
        {available ? <><svg className="ad-ratio__meter" role="img" aria-label={`${metric.label} ${value.toFixed(1)}%, 주의 기준 ${thresholds.caution}%, 위험 기준 ${thresholds.danger}%${exceedsMax ? ', 그래프 범위 초과' : ''}`}>
          <rect className="ad-ratio__track" x="0%" y="3" width="100%" height="8" rx="4" />
          <rect className="ad-ratio__fill" x="0%" y="3" width={`${Math.min(100, value / metric.max * 100)}%`} height="8" rx="4" />
          {/* N-16-2 그래프 범위 안의 주의·위험 기준을 트랙에 표시한다. */}
          {thresholds.caution <= metric.max && <line className="ad-ratio__threshold" x1={`${thresholds.caution / metric.max * 100}%`} x2={`${thresholds.caution / metric.max * 100}%`} y1="3" y2="11" />}
          {thresholds.danger <= metric.max && <line className="ad-ratio__threshold" x1={`${thresholds.danger / metric.max * 100}%`} x2={`${thresholds.danger / metric.max * 100}%`} y1="3" y2="11" />}
        </svg><div className="ad-ratio__scale" aria-hidden="true"><span>0%</span><span>{metric.max}%{exceedsMax && <strong className="ad-risk--danger"> 초과</strong>}</span></div>
        </> : <p className="ad-unavailable">{REASONS[ratio?.unavailableReason] ?? '입력값을 확인해 주세요. 계산할 수 없는 비율은 0%로 표시하지 않습니다.'}</p>}
        <p className="ad-hint">{metric.description} 예시 기준: {thresholds.caution}% 주의 · {thresholds.danger}% 위험</p>
      </section>
    })}</div>
  </Card>
}
