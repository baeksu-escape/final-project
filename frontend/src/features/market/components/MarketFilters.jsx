import { useId, useState } from 'react'
import { Button, SegmentedControl, Select } from '../../../common/components/index.js'
import { formatMetric } from '../utils/marketStats.js'

// 같은 이름의 동이 여러 구에 있어(예: 신사동) 검색 목록에는 "이름 (구)"로 보여 준다.
const dongLabel = (dong) => `${dong.name} (${dong.gu})`

// 검색어로 행정동을 찾는다. "이름 (구)" 그대로 → 이름이 같은 동 → 이름에 검색어가 들어간 동 순서.
function findDong(dongs, query) {
  const q = query.trim()
  if (!q) return null
  return dongs.find((d) => dongLabel(d) === q) || dongs.find((d) => d.name === q) || dongs.find((d) => d.name.includes(q)) || null
}

// N-24-4 보기 조건 — 지표(서울 평균 표시)·업종·구를 고르고 행정동을 검색한다. 찾은 동은 onFound로 넘긴다.
export default function MarketFilters({ metrics, metricKey, onMetric, categories, categoryKey, onCategory, guOptions, gu, onGu, dongs, onFound }) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  const search = () => {
    const dong = findDong(dongs, query)
    if (!dong) {
      setMessage(query.trim() ? `"${query.trim()}"을(를) 찾지 못했습니다. 목록에서 골라 주세요.` : '')
      return
    }
    setMessage('')
    onFound(dong)
  }

  return (
    <section className="card market-filters" aria-label="보기 조건">
      <div className="market-filters__row" role="group" aria-label="지표">
        <span className="market-filters__label">지표</span>
        <div className="market-filters__chips">
          {metrics.map(({ metric, seoul }) => (
            <button
              key={metric.key}
              type="button"
              className="market-metric-chip"
              aria-pressed={metric.key === metricKey}
              title={metric.desc}
              onClick={() => onMetric(metric.key)}
            >
              <b>{metric.name}</b>
              <span className="market-num">서울 평균 {formatMetric(metric, seoul)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="market-filters__row">
        <span className="market-filters__label">업종</span>
        <SegmentedControl
          label="업종"
          options={categories.map((c) => ({ value: c.code, label: c.name }))}
          value={categoryKey}
          onChange={onCategory}
        />
      </div>
      <div className="market-filters__row market-filters__row--region">
        <span className="market-filters__label">지역</span>
        <Select label="구 선택" options={guOptions} value={gu} onChange={(value) => onGu(value)} />
        <form
          className="market-filters__search"
          onSubmit={(event) => {
            event.preventDefault()
            search()
          }}
        >
          <label className="form-field__label" htmlFor={`${listId}-q`}>
            행정동 검색
          </label>
          <div className="market-filters__search-row">
            <input
              id={`${listId}-q`}
              className="text-input__control"
              list={listId}
              value={query}
              placeholder="예: 서교동"
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit">찾기</Button>
          </div>
          <datalist id={listId}>
            {dongs.map((dong) => (
              <option key={dong.code} value={dongLabel(dong)} />
            ))}
          </datalist>
          <span className="market-hint" role="status">
            {message}
          </span>
        </form>
      </div>
    </section>
  )
}
