import { HEAT_BINS } from '../config/marketConfig.js'
import { formatMetric } from '../utils/marketStats.js'

// N-24-4 색 범례 — 나쁨(선홍)부터 좋음(연청)까지 7단계와, 초록이 뜻하는 서울 평균 근처 범위를 보여 준다.
export default function MarketLegend({ metric, stats }) {
  const low = stats.seoul - 0.25 * stats.sd
  const high = stats.seoul + 0.25 * stats.sd
  return (
    <div className="market-legend">
      <span className="market-hint">{metric.dir < 0 ? '높을수록 나쁨' : '높을수록 좋음'}</span>
      <span className="market-legend__ramp">
        <span className="market-hint">나쁨</span>
        <span className="market-ramp" aria-hidden="true">
          {HEAT_BINS.map((bin) => (
            <i key={bin.key} className={`market-ramp__cell market-bin--${bin.key}`} />
          ))}
        </span>
        <span className="market-hint">좋음</span>
      </span>
      <span className="market-hint market-num">
        초록 = 서울 평균 {formatMetric(metric, stats.seoul)} 근처 ({formatMetric(metric, low)} ~ {formatMetric(metric, high)})
      </span>
      <span className="market-legend__ramp">
        <i className="market-ramp__cell market-bin--none" aria-hidden="true" />
        <span className="market-hint">자료 없음</span>
      </span>
    </div>
  )
}
