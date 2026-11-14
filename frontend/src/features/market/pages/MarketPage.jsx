import { useEffect, useState } from 'react'
import { Card, Notice } from '../../../common/components/index.js'
import { loadMarketBase, loadMarketCategory } from '../api/marketData.js'
import { ALL_GU, DEFAULT_CATEGORY, DEFAULT_METRIC, MAP_METRICS } from '../config/marketConfig.js'
import DongDetailModal from '../components/DongDetailModal.jsx'
import DongDistribution from '../components/DongDistribution.jsx'
import DongRankList from '../components/DongRankList.jsx'
import GuAverageChart from '../components/GuAverageChart.jsx'
import MarketFilters from '../components/MarketFilters.jsx'
import MarketLegend from '../components/MarketLegend.jsx'
import MarketSummary from '../components/MarketSummary.jsx'
import { dongRows, dongValue, getMetric, guAverages, metricStats } from '../utils/marketStats.js'
import '../market.css'

// N-24-3 상권 분석 — 서울 행정동별 상권 지표를 업종·지표·구로 골라 요약·구별 평균·분포·상하위 동으로 보여 주고,
// 동을 고르면 행정동 상세 창(N-24-5)을 연다. 모든 직군이 서울 전체에서 시작한다. 지도(N-24-4)는 FP-205에서 붙인다.
export default function MarketPage() {
  const [base, setBase] = useState(null)
  const [baseError, setBaseError] = useState('')
  const [categoryKey, setCategoryKey] = useState(DEFAULT_CATEGORY)
  const [loaded, setLoaded] = useState({ code: null, data: null, error: '' })
  const [metricKey, setMetricKey] = useState(DEFAULT_METRIC)
  const [gu, setGu] = useState(ALL_GU)
  const [openCode, setOpenCode] = useState(null)

  // 처음 한 번: 기준 분기·업종·지표 정의, 행정동 목록, 동별 업종 요약
  useEffect(() => {
    let alive = true
    loadMarketBase()
      .then((data) => alive && setBase(data))
      .catch((error) => alive && setBaseError(error.message))
    return () => {
      alive = false
    }
  }, [])

  // 업종을 바꿀 때마다 그 업종 파일을 읽는다. 새 파일이 올 때까지는 이전 업종 화면을 그대로 둔다.
  useEffect(() => {
    let alive = true
    loadMarketCategory(categoryKey)
      .then((data) => alive && setLoaded({ code: categoryKey, data, error: '' }))
      .catch((error) => alive && setLoaded((prev) => ({ ...prev, error: error.message })))
    return () => {
      alive = false
    }
  }, [categoryKey])

  const error = baseError || loaded.error
  if (error) return <Notice type="warn">{error} 잠시 뒤 다시 열어 주세요.</Notice>
  if (!base || !loaded.data) return <p className="market-hint">상권 데이터를 불러오는 중입니다…</p>

  const { meta, dongs, dongCategories } = base
  const categoryData = loaded.data
  const quarter = meta.baseQuarter
  const category = meta.categories.find((c) => c.code === loaded.code)

  // 지표 5개 각각의 서울 평균·표준편차 (지표 칩, 상세 창 KPI에 쓴다)
  const metrics = MAP_METRICS.map(({ key }) => {
    const metric = getMetric(meta, key)
    return { metric, stats: metricStats(categoryData, quarter, dongs, key) }
  })
  const { metric, stats } = metrics.find((m) => m.metric.key === metricKey)

  const scopeDongs = gu === ALL_GU ? dongs : dongs.filter((dong) => dong.gu === gu)
  const rows = dongRows(dongs, categoryData, quarter, stats, metric)
  const scopeRows = gu === ALL_GU ? rows : rows.filter((row) => row.dong.gu === gu)
  const guRows = guAverages(categoryData, quarter, stats, metric)
  const storeTotal = scopeDongs.reduce((sum, dong) => sum + (dongValue(categoryData, quarter, dong.code, 'storeCount') ?? 0), 0)
  const guOptions = [{ value: ALL_GU, label: '서울 전체' }, ...[...new Set(dongs.map((dong) => dong.gu))].sort().map((name) => ({ value: name, label: name }))]

  // 상세 창의 이전·다음: 고른 구 안(전체면 서울 전체)에서 순서대로 돈다.
  const moveDong = (step) => {
    const list = scopeDongs.some((dong) => dong.code === openCode) ? scopeDongs : dongs
    const index = list.findIndex((dong) => dong.code === openCode)
    setOpenCode(list[(index + step + list.length) % list.length].code)
  }

  return (
    <div className="market-page">
      <header className="market-page__head">
        <span className="market-tag">N-24 상권 분석 · 서울특별시</span>
        <h2 className="market-page__title">서울 상권 히트맵</h2>
        <p className="market-hint">업종과 지표를 고르면 행정동 색이 바뀝니다. 동을 누르면 그 동의 상세 현황과 업종 순위가 열립니다.</p>
      </header>

      <MarketFilters
        metrics={metrics.map((m) => ({ metric: m.metric, seoul: m.stats.seoul }))}
        metricKey={metricKey}
        onMetric={setMetricKey}
        categories={meta.categories}
        categoryKey={categoryKey}
        onCategory={setCategoryKey}
        guOptions={guOptions}
        gu={gu}
        onGu={setGu}
        dongs={dongs}
        onFound={(dong) => {
          setGu(dong.gu)
          setOpenCode(dong.code)
        }}
      />

      <div className="market-main">
        <Card className="market-map">
          {/* TODO(FP-205) N-24-4 행정동 보로노이 히트맵이 이 자리에 들어간다 */}
          <div className="market-map__placeholder">
            <p>지도는 준비 중입니다 (N-24-4).</p>
            <p className="market-hint">지금은 행정동 검색이나 아래 주의할 동·좋은 동 목록에서 동을 눌러 상세를 볼 수 있습니다.</p>
          </div>
          <MarketLegend metric={metric} stats={stats} />
        </Card>
        <div className="market-side">
          <MarketSummary
            metric={metric}
            category={category}
            stats={stats}
            rows={rows}
            scopeRows={scopeRows}
            guRows={guRows}
            gu={gu}
            storeTotal={storeTotal}
          />
          <GuAverageChart metric={metric} rows={guRows} gu={gu} onSelectGu={(name) => setGu(name ?? ALL_GU)} />
          <DongDistribution metric={metric} stats={stats} rows={scopeRows} />
          <DongRankList metric={metric} rows={scopeRows} onOpen={setOpenCode} />
        </div>
      </div>

      <div className="market-footnote">
        <p className="market-hint">
          출처: {meta.source} · 기준 {quarter}
        </p>
        {meta.notes.map((note) => (
          <p key={note} className="market-hint">
            {note}
          </p>
        ))}
      </div>

      <DongDetailModal
        dong={dongs.find((dong) => dong.code === openCode) || null}
        meta={meta}
        categoryData={categoryData}
        category={category}
        metric={metric}
        metrics={metrics}
        dongCategories={dongCategories}
        onClose={() => setOpenCode(null)}
        onMove={moveDong}
        onCategory={setCategoryKey}
      />
    </div>
  )
}
