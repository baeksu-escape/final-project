import { Card } from '../../../common/components/index.js'
import { calculateIncomeDeficitMonths, calculateIncomeStats } from '../utils/incomeStats.js'
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

// N-22 NULL 또는 형식 오류를 0원 소득으로 오해하지 않게 안내 문구를 고른다.
function getIncomeUnavailableMessage(months) {
  if (!Array.isArray(months) || months.length !== 12) return '최근 12개월 소득 자료를 확인할 수 없습니다.'
  if (months.some((item) => item?.incomeAmount === null)) return '월 소득이 미입력된 달이 있어 소득 지표를 계산할 수 없습니다.'
  return '월 소득 자료를 확인할 수 없어 지표를 계산할 수 없습니다.'
}

// N-22-3·4·5·6 변동성 요약 — 최근 12개월 소득 지표와 월 고정지출 기준의 부족 달을 표시한다.
export default function IncomeVolatilitySection({ data }) {
  const months = data?.months
  const stats = calculateIncomeStats(months)
  const fixedExpenseAmount = data?.fixedExpenseAmount
  const deficits = calculateIncomeDeficitMonths(months, fixedExpenseAmount)
  const hasIncomeStats = Boolean(stats)
  const validFixedExpense = Number.isSafeInteger(fixedExpenseAmount) && fixedExpenseAmount >= 0
  const highVolatility = stats?.coefficientOfVariationPct != null
    && stats.coefficientOfVariationPct > VOLATILITY_WARNING_PCT
  const recentDirection = stats?.recentThreeVsAnnualAverageAmount
  const lowMonthMargin = hasIncomeStats && validFixedExpense ? stats.lowestMonth.incomeAmount - fixedExpenseAmount : null
  let volatilityLabel = '소득 자료를 확인해 주세요.'
  if (stats) {
    if (stats.coefficientOfVariationPct == null) volatilityLabel = '평균 소득이 0원이라 계산할 수 없습니다.'
    else volatilityLabel = highVolatility ? '변동이 큼 (12% 초과)' : '12% 이하'
  }
  let lowMonthComparison = '월 고정지출을 확인해 주세요.'
  if (lowMonthMargin != null) {
    if (lowMonthMargin < 0) lowMonthComparison = `고정지출이 ${formatWon(Math.abs(lowMonthMargin))} 더 큽니다`
    else if (lowMonthMargin === 0) lowMonthComparison = '소득과 고정지출이 같습니다.'
    else lowMonthComparison = `소득이 ${formatWon(lowMonthMargin)} 더 큽니다`
  }

  return (
    <section className="iv-section" aria-labelledby="iv-title">
      <h2 className="iv-title" id="iv-title">소득 변동성 요약</h2>
      {!hasIncomeStats && <p className="iv-unavailable" role="status">{getIncomeUnavailableMessage(months)}</p>}

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
          <span>{validFixedExpense ? '소득이 월 고정지출보다 적은 달' : '월 고정지출 미입력'}</span>
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
            <div><dt>성수기·비수기 소득 차이</dt><dd>{formatWon(stats.gapAmount)}</dd></div>
          </dl>
        </Card>
      )}

      <Card title="소득 부족 달 미리 보기" className="iv-deficits">
        {deficits == null ? (
          <p className="iv-unavailable">{validFixedExpense ? getIncomeUnavailableMessage(months) : '월 고정지출이 미입력되어 부족 달을 확인할 수 없습니다.'}</p>
        ) : deficits.length === 0 ? (
          <p>최근 12개월 중 월 고정지출보다 소득이 적은 달이 없습니다.</p>
        ) : (
          <ul className="iv-deficits__list">
            {deficits.map((item) => (
              <li key={item.baseMonth}>
                <strong>{formatMonth(item.baseMonth)}</strong>
                <span>소득 {formatWon(item.incomeAmount)} · 부족액 {formatWon(item.shortageAmount)}</span>
                <span>다시 올 시점: {formatMonth(item.nextOccurrenceMonth)} ({item.monthsUntilNextOccurrence}개월 뒤)</span>
                <span>미리 준비할 금액: {formatWon(item.shortageAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}
