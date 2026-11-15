import { Card } from '../../../common/components/index.js'
import { RANK_LIST_SIZE } from '../config/marketConfig.js'
import { binOf, formatMetric, worstAndBest } from '../utils/marketStats.js'

// N-24-3 주의할 동·좋은 동 — 고른 범위에서 지표가 가장 나쁜 5곳과 좋은 5곳. 누르면 행정동 상세 창(N-24-5)을 연다.
// 점포가 적은 동은 비율이 크게 튀므로 값 옆에 점포 수를 함께 보여 준다.
export default function DongRankList({ metric, rows, onOpen }) {
  const lists = worstAndBest(rows)
  const worst = lists.worst.slice(0, RANK_LIST_SIZE)
  const best = lists.best.slice(0, RANK_LIST_SIZE)

  const list = (items) => (
    <ol className="market-rank">
      {items.map((row, i) => (
        <li key={row.dong.code}>
          <button type="button" className="market-rank__item" onClick={() => onOpen(row.dong.code)}>
            <span className="market-num market-hint">{i + 1}</span>
            <span>
              <i className={`market-dot market-bin--${binOf(row.score)}`} aria-hidden="true" />
              {row.dong.name} <span className="market-hint">{row.dong.gu}</span>
            </span>
            <span className="market-rank__value">
              <b className="market-num">{formatMetric(metric, row.value)}</b>
              <span className="market-num market-hint">점포 {row.storeCount.toLocaleString('ko-KR')}곳</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )

  return (
    <Card className="market-side-card">
      <div className="market-rank__cols">
        <div>
          <h2 className="market-rank__title">주의할 동</h2>
          {list(worst)}
        </div>
        <div>
          <h2 className="market-rank__title">좋은 동</h2>
          {list(best)}
        </div>
      </div>
      <p className="market-hint">점포가 적은 동은 가게 한두 곳만 바뀌어도 비율이 크게 달라집니다. 점포 수를 함께 보세요.</p>
    </Card>
  )
}
