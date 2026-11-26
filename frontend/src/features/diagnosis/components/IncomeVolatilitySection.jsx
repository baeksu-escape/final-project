import { useEffect, useState } from 'react'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Card, Chip } from '../../../common/components/index.js'
import { getIncomeVolatility } from '../api/incomeVolatilityApi.js'
import '../styles/incomeVolatility.css'

const VOLATILITY_WARNING_PCT = 12

// N-22 원 단위 금액을 읽기 쉬운 화면 문자열로 만든다.
function formatWon(value) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—'
}

// N-22 변동계수 값을 퍼센트 한 자리로 보여 준다.
function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '—'
}

// N-22 연월 키를 안내 문구에 쓰는 한국어 월로 바꾼다.
function formatMonth(value) {
  if (!value) return '—'
  const [year, month] = value.split('-')
  return `${year}년 ${Number(month)}월`
}

// N-22 NULL 또는 형식 오류를 0원 소득으로 오해하지 않게 안내 문구를 고른다(응답의 사유 코드 기준).
function getIncomeUnavailableMessage(reason) {
  if (reason === 'INCOME_MISSING') return '월 소득이 미입력된 달이 있어 소득 지표를 계산할 수 없습니다.'
  return '월 소득 자료를 확인할 수 없어 지표를 계산할 수 없습니다.'
}

// N-22-6 월별 소득 표는 기준 자료가 있으면 표시하고, 최고는 표에서 계산하며 최저·부족 표시는 변동성 응답이 있을 때 붙인다.
// 급여소득자는 월급 1건이 같은 금액 12개월로 내려오므로, 금액이 모두 같으면 최고·최저 배지와 제목의 최고·최저를 숨기고 "매달 ○○원"으로 보여 준다.
function MonthlyIncomeCard({ months, lowestBaseMonth, deficitMonths }) {
  const rows = Array.isArray(months) ? months : []
  const incomes = rows.filter((row) => Number.isFinite(row.incomeAmount))
  const varies = incomes.some((row) => row.incomeAmount !== incomes[0].incomeAmount)
  const highest = varies ? incomes.reduce((top, row) => (row.incomeAmount > top.incomeAmount ? row : top)) : null
  const lowest = varies ? rows.find((row) => row.baseMonth === lowestBaseMonth) ?? null : null
  // 접힌 제목 요약: 이어 읽히지 않게 괄호로 묶는다.
  const summaryParts = []
  if (highest) summaryParts.push(`최고 ${formatMonth(highest.baseMonth)} ${formatWon(highest.incomeAmount)}`)
  if (lowest && Number.isFinite(lowest.incomeAmount)) summaryParts.push(`최저 ${formatMonth(lowest.baseMonth)} ${formatWon(lowest.incomeAmount)}`)
  if (incomes.length && !varies) summaryParts.push(`매달 ${formatWon(incomes[0].incomeAmount)}`)
  const hasDeficit = Boolean(deficitMonths) && rows.some((row) => deficitMonths.includes(row.baseMonth))
  return (
    <Card title="최근 12개월 소득">
      {rows.length === 0 ? <p>소득 기록이 없어요.</p> : (
        <details>
          <summary>
            {`월별 소득 12개월 보기${summaryParts.length ? ` (${summaryParts.join(', ')})` : ''}`}
          </summary>
          <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">월</th><th scope="col">소득</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.baseMonth}>
                  <td>
                    {formatMonth(row.baseMonth)}
                    {highest?.baseMonth === row.baseMonth && <> <Chip accent>최고</Chip></>}
                    {/* N-22-1 최저·부족은 공통 Chip이 className을 받지 않아 같은 chip 모양에 색 수식 클래스를 단 span을 쓴다. */}
                    {lowestBaseMonth && lowest?.baseMonth === row.baseMonth && <> <span className="chip iv-badge--low">최저</span></>}
                    {deficitMonths && deficitMonths.includes(row.baseMonth) && <> <span className="chip iv-badge--short">부족</span></>}
                  </td>
                  <td className="num">{formatWon(row.incomeAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {hasDeficit && <p className="hint">부족: 소득이 월 고정지출보다 적은 달</p>}
        </details>
      )}
    </Card>
  )
}

// N-22-1 지표 조회 상태 — 회원·직군·기준 자료가 바뀌거나 화면을 떠나면 늦은 응답을 버리고, 실패하면 다시 시도할 수 있다.
function useIncomeVolatility(userId, workerTypeCode, baseline) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ scope: null, result: null, error: '' })
  const sameScope = (other) => other && other.userId === userId && other.workerTypeCode === workerTypeCode
    && other.baseline === baseline && other.revision === revision

  useEffect(() => {
    let active = true
    const current = { userId, workerTypeCode, baseline, revision }
    getIncomeVolatility({ userId, baseline }).then(
      (result) => { if (active) setState({ scope: current, result, error: '' }) },
      (error) => { if (active) setState({ scope: current, result: null, error: error.message }) },
    )
    return () => { active = false }
  }, [userId, workerTypeCode, baseline, revision])

  const ready = sameScope(state.scope)
  return { loading: !ready, result: ready ? state.result : null, error: ready ? state.error : '', retry: () => setRevision((value) => value + 1) }
}

// N-22-3·4·5·6 변동성 요약 — 서버(DIAG-07-1) 결과만 받아 최근 12개월 소득 지표와 월 고정지출 기준의 부족 달을 표시한다.
// data는 현금흐름 화면이 이미 받은 기준 자료(getCashFlowData 응답)이며, 이 컴포넌트는 직접 계산하지 않는다.
export default function IncomeVolatilitySection({ data }) {
  const { user } = useAuth()
  const query = useIncomeVolatility(user?.userId, user?.jobType, data)
  const response = query.result
  const stats = response?.stats ?? null
  const deficits = response?.deficits ?? null
  const hasIncomeStats = Boolean(stats)
  // 12% 초과 강조는 화면 표시 기준(시연 설정 상수)이다.
  const highVolatility = stats?.coefficientOfVariationPct != null
    && stats.coefficientOfVariationPct > VOLATILITY_WARNING_PCT
  const recentDirection = stats?.recentThreeVsAnnualAverageAmount
  const fixedExpenseRatio = response?.fixedExpenseRatio
  let volatilityLabel = '소득 자료를 확인해 주세요.'
  if (stats) {
    if (stats.coefficientOfVariationPct == null) volatilityLabel = '평균 소득이 0원이라 계산할 수 없습니다.'
    else volatilityLabel = highVolatility ? '변동이 큼 (12% 초과)' : '12% 이하'
  }
  const lowMonthComparison = Number.isFinite(fixedExpenseRatio) ? `최저 소득 대비 ${formatPercent(fixedExpenseRatio)}` : '비율을 확인할 수 없습니다.'

  return (
    <section className="iv-section" aria-labelledby="iv-title">
      <h2 className="iv-title" id="iv-title">소득 변동성 요약</h2>
      {query.loading && <p className="iv-unavailable" role="status">소득 변동성 지표를 불러오는 중입니다.</p>}
      {query.error && <p className="iv-unavailable" role="status">{query.error} <Button size="sm" onClick={query.retry}>다시 시도</Button></p>}
      {response && !hasIncomeStats && <p className="iv-unavailable" role="status">{getIncomeUnavailableMessage(response.unavailableReason)}</p>}

      <div className="iv-kpis">
        <article className="iv-kpi">
          <h3>월평균 소득</h3>
          <p className="iv-kpi__value">{formatWon(stats?.averageAmount)}</p>
          <span>최근 12개월</span>
        </article>
        <article className={`iv-kpi${highVolatility ? ' iv-kpi--high' : ''}`}>
          <h3>소득 변동계수</h3>
          <p className="iv-kpi__value">{formatPercent(stats?.coefficientOfVariationPct)}</p>
          <span>{volatilityLabel}</span>
        </article>
        <article className="iv-kpi">
          <h3>고정지출 미달 월</h3>
          <p className="iv-kpi__value">{deficits == null ? '—' : `${deficits.length}개월`}</p>
          <span>소득이 월 고정지출보다 적은 달</span>
        </article>
        <article className="iv-kpi">
          <h3>가장 적게 번 달</h3>
          <p className="iv-kpi__value">{formatWon(stats?.lowestMonth.incomeAmount)}</p>
          <span>{formatMonth(stats?.lowestMonth.baseMonth)}</span>
        </article>
      </div>

      {hasIncomeStats && (
        <Card title="최근 12개월 소득 지표" className="iv-details">
          <dl className="iv-details__grid">
            <div><dt>소득 중앙값</dt><dd>{formatWon(stats.medianAmount)}</dd></div>
            <div><dt>소득 표준편차</dt><dd>{formatWon(stats.standardDeviation)}</dd></div>
            <div><dt>소득 0원인 달</dt><dd>{stats.zeroIncomeMonthCount}개월</dd></div>
            <div>
              <dt>최근 3개월 월평균</dt>
              <dd>{formatWon(stats.recentThreeAverageAmount)}</dd>
              <span>12개월 평균보다 {recentDirection > 0 ? '높습니다' : recentDirection < 0 ? '낮습니다' : '같습니다'} ({formatWon(Math.abs(recentDirection))})</span>
            </div>
            <div>
              <dt>가장 적게 번 달과 월 고정지출</dt>
              <dd>{lowMonthComparison}</dd>
            </div>
            <div><dt>가장 많이 번 달과 적게 번 달의 차이</dt><dd>{formatWon(stats.gapAmount)}</dd></div>
          </dl>
        </Card>
      )}

      {Array.isArray(data?.months) && data.months.length > 0 && (
        <MonthlyIncomeCard
          months={data.months}
          lowestBaseMonth={stats?.lowestMonth?.baseMonth}
          deficitMonths={deficits?.map((item) => item.baseMonth)}
        />
      )}

      <Card title="소득 부족 달 미리 보기" className="iv-deficits">
        {!response ? (
          <p className="iv-unavailable">{query.loading ? '불러오는 중입니다.' : '지표를 불러오지 못했습니다.'}</p>
        ) : deficits == null ? (
          <p className="iv-unavailable">{getIncomeUnavailableMessage(response.unavailableReason)}</p>
        ) : deficits.length === 0 ? (
          <p>최근 12개월 중 월 고정지출보다 소득이 적은 달이 없습니다.</p>
        ) : (
          <>
          {/* N-22-5 가장 가까운 부족 달 앞에 월 고정지출 기준을 알려 준다. */}
          <p className="hint">월 고정지출보다 소득이 적었던 달 기준</p>
          {/* N-22-5 가장 가까운 소득 부족 달 — 다시 올 달·남은 개월 수와 미리 모아 둘 금액을 한 줄로 안내한다. */}
          {response.nearestDeficit && (
            <p>가장 가까운 부족 달: {response.nearestDeficit.dueMonth ? `${formatMonth(response.nearestDeficit.dueMonth)}(${response.nearestDeficit.monthsUntil}개월 뒤)` : `${response.nearestDeficit.monthsUntil}개월 뒤`}, 미리 모아 둘 금액 {formatWon(response.nearestDeficit.reserveAmount)}</p>
          )}
          {/* N-22-6 부족한 달 카드 — 다시 올 때가 가까운 순서(최근 12개월 안에서는 오래된 달부터)로 그린다. */}
          <ul className="iv-deficits__list">
            {[...deficits].sort((a, b) => a.monthsUntilNextOccurrence - b.monthsUntilNextOccurrence).map((item) => (
              <li key={item.baseMonth} className="panel-sunk">
                <strong>{formatMonth(item.baseMonth)}</strong>
                <span>소득 <b className="num">{formatWon(item.incomeAmount)}</b></span>
                <span>부족액 <b className="num">{formatWon(item.shortageAmount)}</b></span>              </li>
            ))}
          </ul>
          </>
        )}
      </Card>
    </section>
  )
}
