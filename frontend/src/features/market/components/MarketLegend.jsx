import { HEAT_STEPS } from '../config/marketConfig.js'
import { formatMetric, josa } from '../utils/marketStats.js'

// N-24-4 색 범례 — 지도 빨강 5단계(값이 클수록 진함)와 구간 경계값, 이 지표는 높을수록 좋은지 나쁜지를 글로 알려 준다(1차 시연 후속).
export default function MarketLegend({ metric, stats }) {
  const steps = Array.from({ length: HEAT_STEPS }, (_, i) => i + 1)
  // 칸마다 마우스를 올리면 그 칸의 값 범위가 보인다
  const range = (step) => {
    const from = step === 1 ? stats.min : stats.cuts[step - 2]
    const to = step === HEAT_STEPS ? stats.max : stats.cuts[step - 1]
    return `${formatMetric(metric, from)} ~ ${formatMetric(metric, to)}`
  }
  const hasValues = stats.cuts.length > 0

  return (
    <div className="market-legend">
      <span className="market-legend__ramp">
        <span className="market-hint">낮음</span>
        <span className="market-ramp" aria-hidden="true">
          {steps.map((step) => (
            <i key={step} className={`market-ramp__cell market-heat--${step}`} title={hasValues ? range(step) : undefined} />
          ))}
        </span>
        <span className="market-hint">높음</span>
      </span>
      <span className="market-legend__ramp">
        <i className="market-ramp__cell market-heat--none" aria-hidden="true" />
        <span className="market-hint">자료 없음</span>
      </span>
      {hasValues && (
        <p className="market-hint market-legend__desc">
          색이 진할수록 {josa(metric.name, '이', '가')} 높은 동입니다. 행정동을 값 순서로 5등분했고, 구간 경계는{' '}
          <span className="market-num">{stats.cuts.map((cut) => formatMetric(metric, cut)).join(' · ')}</span>입니다.{' '}
          <b>
            {josa(metric.name, '은', '는')} {metric.dir < 0 ? '낮을수록' : '높을수록'} 좋습니다.
          </b>
          {stats.seoul != null && <> 서울 평균은 <span className="market-num">{formatMetric(metric, stats.seoul)}</span>입니다.</>}
        </p>
      )}
    </div>
  )
}
