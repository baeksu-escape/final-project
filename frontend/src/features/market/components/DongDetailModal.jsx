import { useState } from 'react'
import { Button, Modal, SegmentedControl } from '../../../common/components/index.js'
import { CATEGORY_RANK_OPTIONS } from '../config/marketConfig.js'
import { binOf, categoryRanking, dongValue, formatMetric, getMetric, josa, rankedDongCount, scoreOf, verdictOf } from '../utils/marketStats.js'
import DongTrendChart from './DongTrendChart.jsx'

// 업종 순위표 막대 색 — 폐업률은 선홍, 매출 전년비는 증감에 따라, 나머지는 보라.
function rankBarClass(key, value) {
  if (key === 'closeRate') return 'market-bin--neg2'
  if (key === 'salesYoY') return value >= 0 ? 'market-bin--pos2' : 'market-bin--neg2'
  return 'market-rank-bar--plain'
}

// N-24-5 행정동 상세 창 — 고른 동·업종의 지표 6개(서울·구 비교), 최근 4분기 추이, 서울·구 순위, 요약 문장, 동 안 업종 순위표를 보여 준다.
// metrics: 지도 지표 5개의 [{ metric, stats }], metric: 지금 고른 지표
export default function DongDetailModal({ dong, meta, categoryData, category, metric, metrics, dongCategories, onClose, onMove, onCategory }) {
  const [rankKey, setRankKey] = useState(CATEGORY_RANK_OPTIONS[0].value)
  if (!dong) return null

  const quarter = meta.baseQuarter
  const dongData = categoryData.dongs[dong.code]
  const guData = categoryData.gu[dong.gu]?.[quarter] || {}
  const seoulData = categoryData.seoul[quarter]
  const storeMetric = getMetric(meta, 'storeCount')
  const salesMetric = getMetric(meta, 'salesPerStore')
  const yoyMetric = getMetric(meta, 'salesYoY')

  const current = metrics.find((m) => m.metric.key === metric.key)
  const currentValue = dongValue(categoryData, quarter, dong.code, metric.key)
  const verdict = verdictOf(scoreOf(currentValue, current.stats, metric))

  // 지표별 값·점수 (요약 문장의 가장 좋은·약한 지표에 쓴다)
  const scored = metrics
    .map(({ metric: m, stats }) => ({ m, value: dongValue(categoryData, quarter, dong.code, m.key), stats }))
    .map((row) => ({ ...row, score: scoreOf(row.value, row.stats, row.m) }))
  const ranked = scored.filter((row) => row.score != null).sort((a, b) => b.score - a.score)

  const rank = dongData?.rank?.[metric.key]
  const totals = categoryData.rankTotal[metric.key]

  const summary = dongCategories[dong.code] || {}
  const storeOrder = meta.categories
    .map((c) => ({ code: c.code, v: summary[c.code]?.storeCount ?? -1 }))
    .sort((a, b) => b.v - a.v)
    .findIndex((row) => row.code === category.code)

  const option = CATEGORY_RANK_OPTIONS.find((o) => o.value === rankKey)
  const optionMetric = getMetric(meta, option.value)
  const rows = categoryRanking(summary, meta.categories, option)
  const vmax = Math.max(...rows.map((row) => Math.abs(row.summary[option.value] ?? 0)), 1)
  const top = rows[0]

  const points = meta.quarters.map((q) => ({
    quarter: q,
    salesPerStore: dongData?.quarters[q]?.salesPerStore ?? null,
    closeRate: dongData?.quarters[q]?.closeRate ?? null,
  }))

  return (
    <Modal open title={`${dong.name} · ${category.name}`} onClose={onClose}>
      <div className="market-detail__head">
        <div className="market-detail__badges">
          <span className="market-tag">{dong.gu} · 행정동 상세</span>
          <span className={`market-badge market-bin--${verdict.bin}`}>
            {metric.name} {formatMetric(metric, currentValue)} · {verdict.text}
          </span>
        </div>
        <div className="market-detail__nav">
          <Button size="sm" onClick={() => onMove(-1)}>
            ‹ 이전
          </Button>
          <Button size="sm" onClick={() => onMove(1)}>
            다음 ›
          </Button>
        </div>
      </div>

      <div className="market-kpis">
        <div className="market-kpi market-kpi--store">
          <span className="market-hint">{category.name} 점포 수</span>
          <span className="market-kpi__value">{formatMetric(storeMetric, dongValue(categoryData, quarter, dong.code, 'storeCount'))}</span>
          <span className="market-kpi__cmp market-num">서울 동 평균 {seoulData.dongAvgStoreCount}곳</span>
          <span className="market-kpi__cmp">
            점포당 분기 매출 {formatMetric(salesMetric, dongValue(categoryData, quarter, dong.code, 'salesPerStore'))}
          </span>
        </div>
        {scored.map(({ m, value, score }) => (
          <div key={m.key} className={`market-kpi market-bin--${binOf(score)}`} aria-current={m.key === metric.key ? 'true' : undefined}>
            <span className="market-hint">{m.name}</span>
            <span className="market-kpi__value">{formatMetric(m, value)}</span>
            <span className="market-kpi__cmp market-num">
              서울 {formatMetric(m, seoulData[m.key])} · {dong.gu} {formatMetric(m, guData[m.key] ?? null)}
            </span>
            <span className="market-kpi__cmp">{verdictOf(score).text}</span>
          </div>
        ))}
      </div>

      <div className="market-detail__panels">
        <section className="card market-detail__panel">
          <h3 className="market-detail__title">최근 4분기 추이</h3>
          <DongTrendChart points={points} />
        </section>
        <section className="card market-detail__panel">
          <h3 className="market-detail__title">순위</h3>
          <div className="market-kpis market-kpis--two">
            <div className={`market-kpi market-bin--${verdict.bin}`}>
              <span className="market-hint">서울 {totals.seoul}개 동 중</span>
              <span className="market-kpi__value">{rank ? `${rank.seoul}위` : '자료 없음'}</span>
              <span className="market-kpi__cmp">{metric.name} 좋은 순</span>
            </div>
            <div className={`market-kpi market-bin--${verdict.bin}`}>
              <span className="market-hint">
                {dong.gu} {totals.gu[dong.gu]}개 동 중
              </span>
              <span className="market-kpi__value">{rank ? `${rank.gu}위` : '자료 없음'}</span>
              <span className="market-kpi__cmp">{metric.name} 좋은 순</span>
            </div>
          </div>
          <p className="market-detail__text">
            {dong.name}의 {josa(category.name, '은', '는')} 점포 {formatMetric(storeMetric, summary[category.code]?.storeCount ?? null)}으로 이 동에서{' '}
            <b>{storeOrder + 1}번째</b>로 많은 업종입니다.
            {ranked.length > 1 && (
              <>
                {' '}
                지표 중에서는 <b>{josa(ranked[0].m.name, '이', '가')}</b> 가장 좋고{' '}
                <b>{josa(ranked[ranked.length - 1].m.name, '이', '가')}</b> 가장 약합니다.
              </>
            )}{' '}
            매출은 1년 전보다 <b className="market-num">{formatMetric(yoyMetric, summary[category.code]?.salesYoY ?? null)}</b> 바뀌었습니다.
          </p>
        </section>
      </div>

      <section className="market-detail__ranking" aria-label={`${dong.name} 업종 순위`}>
        <div className="market-detail__ranking-head">
          <h3 className="market-detail__title">{dong.name} 업종 순위</h3>
          <SegmentedControl label="순위 기준" options={CATEGORY_RANK_OPTIONS} value={rankKey} onChange={setRankKey} />
        </div>
        <div className="market-table-wrap">
          <table className="market-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>업종</th>
                <th className="market-table__r">{option.label}</th>
                <th className="market-table__bar-col" aria-hidden="true" />
                <th className="market-table__r">서울 내 매출 전년비 순위</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, k) => {
                const value = row.summary[option.value] ?? null
                const mine = row.category.code === category.code
                const yoyRank = row.summary.salesYoYRankSeoul
                return (
                  <tr key={row.category.code} className={mine ? 'market-table__row--me' : undefined}>
                    <td className="market-num">{k + 1}</td>
                    <td>
                      <button type="button" className="market-table__link" onClick={() => onCategory(row.category.code)}>
                        {row.category.name}
                      </button>
                      {mine && <span className="market-hint"> (보는 중)</span>}
                    </td>
                    <td className="market-table__r market-num">{formatMetric(optionMetric, value)}</td>
                    <td>
                      <div className="market-track">
                        <i className={rankBarClass(option.value, value)} style={{ width: `${(Math.abs(value ?? 0) / vmax) * 100}%` }} />
                      </div>
                    </td>
                    <td className="market-table__r market-num">
                      {yoyRank != null ? `${yoyRank} / ${rankedDongCount(dongCategories, row.category.code)}` : '자료 없음'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="market-hint">
          업종 이름을 누르면 그 업종으로 바꿔 봅니다. {option.value === 'closeRate' ? '폐업률은 낮은 순입니다. ' : ''}1위 업종은{' '}
          {top.category.name}({formatMetric(optionMetric, top.summary[option.value] ?? null)})입니다.
        </p>
      </section>

      <p className="market-note">
        출처: {meta.source} · 기준 {quarter}. 서울·구 값은 합계 기준이며, 점포가 적은 동은 비율이 크게 튈 수 있습니다.
      </p>
    </Modal>
  )
}
