import { Card } from '../../../common/components/index.js'
import { ALL_GU } from '../config/marketConfig.js'
import { formatMetric, sortWorstFirst, worstAndBest } from '../utils/marketStats.js'

// N-24-3 요약 카드 — 서울 평균, 평균보다 나쁜·좋은 동 수, 고른 구의 순위, 가장 주의할·좋은 동을 문장으로 보여 준다.
// rows: 서울 전체 동 { dong, value, score }, scopeRows: 고른 구 안의 동, guRows: 구별 평균(나쁜 순)
export default function MarketSummary({ metric, category, stats, rows, scopeRows, guRows, gu, storeTotal }) {
  const ranked = sortWorstFirst(rows)
  const bad = ranked.filter((row) => row.score <= -0.25).length
  const good = ranked.filter((row) => row.score >= 0.25).length
  const scoped = worstAndBest(scopeRows)
  const worst = scoped.worst[0]
  const best = scoped.best[0]
  const guIndex = guRows.findIndex((row) => row.gu === gu)
  const place = gu === ALL_GU ? '서울' : gu

  return (
    <Card title={`${category.name} · ${metric.name}`} className="market-side-card market-summary">
      <p>
        서울 평균은 <b className="market-num">{formatMetric(metric, stats.seoul)}</b>입니다. {metric.desc}입니다.
      </p>
      <p>
        평균보다 나쁜 동이 <b className="market-num market-text--bad">{bad}곳</b>, 좋은 동이{' '}
        <b className="market-num market-text--good">{good}곳</b>입니다.
      </p>
      {gu !== ALL_GU && guIndex >= 0 && (
        <p>
          {gu} 평균은 <b className="market-num">{formatMetric(metric, guRows[guIndex].value)}</b>로, {guRows.length}개 구 중 나쁜 쪽에서{' '}
          <b className="market-num">{guIndex + 1}번째</b>입니다.
        </p>
      )}
      {worst && best && (
        <p>
          {place}에서 가장 주의할 곳은 <b>{worst.dong.name}</b>({formatMetric(metric, worst.value)}), 가장 좋은 곳은{' '}
          <b>{best.dong.name}</b>({formatMetric(metric, best.value)})입니다.
        </p>
      )}
      {gu === ALL_GU && guRows.length > 0 && (
        <p>
          구 단위로는 <b>{guRows[0].gu}</b>가 가장 나쁘고 <b>{guRows[guRows.length - 1].gu}</b>가 가장 좋습니다.
        </p>
      )}
      <p className="market-hint market-num">
        표시 범위 {category.name} 점포 {storeTotal.toLocaleString('ko-KR')}곳 · 행정동 {scopeRows.length}곳
      </p>
    </Card>
  )
}
