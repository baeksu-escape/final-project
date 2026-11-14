import { DIST_RANGE, HEAT_BINS, MAP_METRICS } from '../config/marketConfig.js'

// N-24-3 상권 지표 계산 — 서울 평균과 비교한 색 구간, 구별 평균, 분포, 상·하위 동, 숫자 표시를 한곳에 모았다.

// meta.json의 지표 정의에 화면 설정(증감 여부·설명)을 합친다. dir은 좋은 방향(1: 높을수록 좋음, -1: 낮을수록 좋음).
export function getMetric(meta, key) {
  const base = meta.metrics.find((metric) => metric.key === key)
  const extra = MAP_METRICS.find((metric) => metric.key === key) || {}
  return { ...base, ...extra, dir: base.higherIsBetter ? 1 : -1 }
}

// 지표 값을 단위에 맞춰 글자로 만든다. 값이 없으면 "자료 없음".
export function formatMetric(metric, value) {
  if (value == null) return '자료 없음'
  if (metric.unit === '%') return `${metric.signed && value > 0 ? '+' : ''}${value.toFixed(1)}%`
  if (metric.unit === '원') return `${(value / 1000000).toFixed(1)}백만원`
  return `${Math.round(value).toLocaleString('ko-KR')}${metric.unit}`
}

// 이름 뒤에 받침에 맞는 조사를 붙인다. 예: josa('매출 전년비', '이', '가') → '매출 전년비가'
export function josa(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasBatchim = code < 0 || code > 11171 || code % 28 !== 0
  return word + (hasBatchim ? withBatchim : withoutBatchim)
}

// 한 행정동의 기준 분기 지표 값.
export function dongValue(categoryData, quarter, code, key) {
  return categoryData.dongs[code]?.quarters[quarter]?.[key] ?? null
}

// 색을 칠할 기준값. 가운데는 서울 평균(합계 기준), 폭은 행정동 값의 표준편차.
export function metricStats(categoryData, quarter, dongs, key) {
  const values = dongs.map((dong) => dongValue(categoryData, quarter, dong.code, key)).filter((v) => v != null)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1
  const sorted = [...values].sort((a, b) => a - b)
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  return {
    seoul: categoryData.seoul[quarter][key],
    sd,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    // 분포 막대 범위 — 점포가 적은 동의 튀는 값 때문에 막대가 한쪽에 몰리지 않게 5~95% 구간만 쓴다
    low: pick(DIST_RANGE[0]),
    high: pick(DIST_RANGE[1]),
  }
}

// 서울 평균에서 좋은 쪽으로 몇 표준편차 떨어졌는지. 값이 없으면 null.
export function scoreOf(value, stats, metric) {
  if (value == null) return null
  return (metric.dir * (value - stats.seoul)) / stats.sd
}

// 점수가 속한 색 구간 key(neg3~pos3). 값이 없으면 'none'.
export function binOf(score) {
  if (score == null) return 'none'
  return HEAT_BINS.find((bin) => score >= bin.min && score < bin.max).key
}

// 점수를 말로 바꾼다. bin은 배지 색에 쓴다.
export function verdictOf(score) {
  if (score == null) return { text: '자료 없음', bin: 'none' }
  if (score <= -0.75) return { text: '서울 평균보다 나쁨', bin: 'neg2' }
  if (score < -0.25) return { text: '평균보다 조금 나쁨', bin: 'neg1' }
  if (score <= 0.25) return { text: '서울 평균과 비슷', bin: 'neu' }
  if (score < 0.75) return { text: '평균보다 조금 좋음', bin: 'pos1' }
  return { text: '서울 평균보다 좋음', bin: 'pos2' }
}

// 행정동마다 { dong, value, score, storeCount }. 값이 없는 동도 넣고 score는 null로 둔다.
export function dongRows(dongs, categoryData, quarter, stats, metric) {
  return dongs.map((dong) => {
    const value = dongValue(categoryData, quarter, dong.code, metric.key)
    const storeCount = dongValue(categoryData, quarter, dong.code, 'storeCount') ?? 0
    return { dong, value, score: scoreOf(value, stats, metric), storeCount }
  })
}

// 주의할 동(나쁜 순)과 좋은 동(좋은 순). 값이 같으면 점포가 많은 동을 위로 올린다.
export function worstAndBest(rows) {
  const valid = rows.filter((row) => row.score != null)
  const worst = [...valid].sort((a, b) => a.score - b.score || b.storeCount - a.storeCount)
  const best = [...valid].sort((a, b) => b.score - a.score || b.storeCount - a.storeCount)
  return { worst, best }
}

// 값이 있는 행만 나쁜 순(점수 낮은 순)으로 정렬한다.
export function sortWorstFirst(rows) {
  return rows.filter((row) => row.score != null).sort((a, b) => a.score - b.score)
}

// 구별 평균(합계 기준)을 나쁜 순으로 돌려준다.
export function guAverages(categoryData, quarter, stats, metric) {
  const rows = Object.entries(categoryData.gu).map(([gu, byQuarter]) => {
    const value = byQuarter[quarter]?.[metric.key] ?? null
    return { gu, value, score: scoreOf(value, stats, metric) }
  })
  return sortWorstFirst(rows)
}

// low~high를 같은 폭으로 나눠 구간마다 동 수를 센다. 범위 밖 값은 양 끝 구간에 넣는다.
export function histogram(rows, stats, count) {
  const step = (stats.high - stats.low) / count || 1
  const bins = Array.from({ length: count }, (_, i) => ({ from: stats.low + step * i, to: stats.low + step * (i + 1), count: 0 }))
  rows.forEach((row) => {
    if (row.value == null) return
    const index = Math.floor((row.value - stats.low) / step)
    bins[Math.max(0, Math.min(count - 1, index))].count += 1
  })
  return bins
}

// 동 안 업종 순위표 — 고른 기준으로 8개 업종을 줄 세운다. 값이 없는 업종은 맨 아래.
export function categoryRanking(dongSummary, categories, option) {
  const rows = categories.map((category) => ({ category, summary: dongSummary?.[category.code] || {} }))
  return rows.sort((a, b) => {
    const va = a.summary[option.value]
    const vb = b.summary[option.value]
    if (va == null) return 1
    if (vb == null) return -1
    return option.dir * (vb - va)
  })
}

// 업종 하나에서 매출 전년비 순위가 매겨진 행정동 수(순위의 분모).
export function rankedDongCount(dongCategories, categoryCode) {
  return Object.values(dongCategories).filter((summary) => summary[categoryCode]?.salesYoYRankSeoul != null).length
}
