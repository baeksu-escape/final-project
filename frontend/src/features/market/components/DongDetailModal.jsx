import { useState } from 'react'
import { Button, Modal, SegmentedControl } from '../../../common/components/index.js'
import { CATEGORY_RANK_OPTIONS, DETAIL_TABS } from '../config/marketConfig.js'
import {
  categoryRanking,
  dongValue,
  formatMetric,
  getMetric,
  heatOf,
  josa,
  rankPercentText,
  rankedDongCount,
  scoreOf,
  verdictOf,
} from '../utils/marketStats.js'
import DongTrendChart from './DongTrendChart.jsx'

// 업종 순위표 막대 색 — 폐업률은 선홍, 매출 전년비는 증감에 따라, 나머지는 보라.
function rankBarClass(key, value) {
  if (key === 'closeRate') return 'market-bin--neg2'
  if (key === 'salesYoY') return value >= 0 ? 'market-bin--pos2' : 'market-bin--neg2'
  return 'market-rank-bar--plain'
}

// N-24-5 행정동 상세 창 — 고른 동·업종의 지표 6개(서울·구 비교)와 요약 문장, 최근 4분기 추이와 서울·구 순위, 동 안 업종 순위표를 보여 준다.
// 1차 시연 후속: 한 화면에 다 보이면 읽기 어려워 [요약]·[추이·순위]·[업종 순위] 탭으로 나눴다. [이전]·[다음]으로 동을 바꿔도 탭은 그대로다.
// metrics: 지도 지표 5개의 [{ metric, stats }], metric: 지금 고른 지표
export default function DongDetailModal({ dong, meta, categoryData, category, metric, metrics, dongCategories, onClose, onMove, onCategory }) {
  const [rankKey, setRankKey] = useState(CATEGORY_RANK_OPTIONS[0].value)
  const [tab, setTab] = useState(DETAIL_TABS[0].value)
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
  // 배지·순위 칸 색은 지도와 같은 빨강 5단계(값의 크기). 좋고 나쁨은 verdict 글자로 알려 준다.
  const currentHeat = heatOf(currentValue, current.stats)

  // 지표별 값·점수 (요약 문장의 가장 좋은·약한 지표에 쓴다)
  const scored = metrics
    .map(({ metric: m, stats }) => ({ m, value: dongValue(categoryData, quarter, dong.code, m.key), stats }))
    .map((row) => ({ ...row, score: scoreOf(row.value, row.stats, row.m) }))
  const ranked = scored.filter((row) => row.score != null).sort((a, b) => b.score - a.score)

  const rank = dongData?.rank?.[metric.key]
  const totals = categoryData.rankTotal[metric.key]

  const summary = dongCategories[dong.code] || {}
  const myStores = summary[category.code]?.storeCount ?? null
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
          <span className={`market-badge market-heat--${currentHeat}`}>
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

      <SegmentedControl label="상세 보기" options={DETAIL_TABS} value={tab} onChange={setTab} />

      {/* [요약] 지표 6개(뜻·서울·구 비교·판정)와 요약 문장 */}
      {tab === 'summary' && (
        <div className="market-detail__tab">
          <div className="market-kpis">
            <div className="market-kpi market-kpi--store">
              <span className="market-hint">{category.name} 점포 수</span>
              <span className="market-kpi__desc">{storeMetric.desc}</span>
              <span className="market-kpi__value">{formatMetric(storeMetric, dongValue(categoryData, quarter, dong.code, 'storeCount'))}</span>
              <span className="market-kpi__cmp market-num">서울 동 평균 {seoulData.dongAvgStoreCount}곳</span>
              <span className="market-kpi__cmp">
                점포당 분기 매출 {formatMetric(salesMetric, dongValue(categoryData, quarter, dong.code, 'salesPerStore'))}
              </span>
            </div>
            {scored.map(({ m, value, score, stats }) => (
              <div key={m.key} className={`market-kpi market-heat--${heatOf(value, stats)}`} aria-current={m.key === metric.key ? 'true' : undefined}>
                <span className="market-hint">{m.name}</span>
                <span className="market-kpi__desc">{m.desc}</span>
                <span className="market-kpi__value">{formatMetric(m, value)}</span>
                <span className="market-kpi__cmp market-num">
                  서울 {formatMetric(m, seoulData[m.key])} · {dong.gu} {formatMetric(m, guData[m.key] ?? null)}
                </span>
                <span className="market-kpi__cmp">{verdictOf(score).text}</span>
              </div>
            ))}
          </div>
          <p className="market-detail__text">
            {myStores == null ? (
              <>
                {dong.name}의 {josa(category.name, '은', '는')} 점포 자료가 없습니다.
              </>
            ) : (
              <>
                {dong.name}의 {josa(category.name, '은', '는')} 점포 {formatMetric(storeMetric, myStores)}으로 이 동에서{' '}
                <b>{storeOrder + 1}번째</b>로 많은 업종입니다.
              </>
            )}
            {ranked.length > 1 && (
              <>
                {' '}
                지표 중에서는 <b>{josa(ranked[0].m.name, '이', '가')}</b> 가장 좋고{' '}
                <b>{josa(ranked[ranked.length - 1].m.name, '이', '가')}</b> 가장 약합니다.
              </>
            )}{' '}
            매출은 1년 전보다 <b className="market-num">{formatMetric(yoyMetric, summary[category.code]?.salesYoY ?? null)}</b> 바뀌었습니다.
          </p>
        </div>
      )}

      {/* [추이·순위] 최근 4분기 추이와 고른 지표의 서울·구 순위 */}
      {tab === 'trend' && (
        <div className="market-detail__panels">
          <section className="card market-detail__panel">
            <h3 className="market-detail__title">최근 4분기 추이</h3>
            <DongTrendChart points={points} />
          </section>
          <section className="card market-detail__panel">
            <h3 className="market-detail__title">{metric.name} 순위</h3>
            <div className="market-kpis market-kpis--two">
              <div className={`market-kpi market-heat--${currentHeat}`}>
                <span className="market-hint">서울 {totals.seoul}개 동 중</span>
                <span className="market-kpi__value">{rank ? `${rank.seoul}위` : '자료 없음'}</span>
                <span className="market-kpi__cmp">{metric.name} 좋은 순</span>
              </div>
              <div className={`market-kpi market-heat--${currentHeat}`}>
                <span className="market-hint">
                  {dong.gu} {totals.gu[dong.gu]}개 동 중
                </span>
                <span className="market-kpi__value">{rank ? `${rank.gu}위` : '자료 없음'}</span>
                <span className="market-kpi__cmp">{metric.name} 좋은 순</span>
              </div>
            </div>
            <p className="market-hint">1위가 {metric.name} 기준으로 가장 좋은 동입니다. 자료가 없는 동은 순위에서 빠집니다.</p>
          </section>
        </div>
      )}

      {/* [업종 순위] 이 동 안의 8개 업종 줄 세우기 */}
      {tab === 'categories' && (
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
                  <th className="market-table__r">서울 내 매출 증가 순위</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, k) => {
                  const value = row.summary[option.value] ?? null
                  const mine = row.category.code === category.code
                  const yoyRank = row.summary.salesYoYRankSeoul
                  const yoyTotal = rankedDongCount(dongCategories, row.category.code)
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
                      {/* 1차 시연 후속: "234 / 396" 대신 상위·하위 %로 보이고, 정확한 순위는 마우스를 올리면 보인다 */}
                      <td className="market-table__r market-num" title={yoyRank != null ? `서울 ${yoyTotal}개 동 중 ${yoyRank}위` : undefined}>
                        {rankPercentText(yoyRank, yoyTotal)}
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
          <p className="market-hint">
            서울 내 매출 증가 순위: 작년 같은 분기보다 매출이 얼마나 늘었는지를 서울 행정동끼리 비교한 위치입니다(상위일수록 많이 늘었음). 작년 자료가
            없는 동은 빠집니다.
          </p>
        </section>
      )}

      <p className="market-note">
        출처: {meta.source} · 기준 {quarter}. 서울·구 값은 합계 기준이며, 점포가 적은 동은 비율이 크게 튈 수 있습니다.
      </p>
    </Modal>
  )
}
