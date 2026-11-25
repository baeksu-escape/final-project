import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Card, MoneyInput, Notice, NumberInput, Slider, Toast } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { getLoanProducts, matchesLoanScore } from '../../loans/api/loanCatalog.js'
import LoanProductCard from '../../loans/components/LoanProductCard.jsx'
import { MONEY_FIELDS, SLIDER_FIELDS, HIDDEN_INVALID_MESSAGES, getInputErrors, sameInputs, selectRecommendations } from '../adapters/simulationAdapter.js'
import { useSimulation } from '../api/useSimulation.js'
import DeductionList from '../components/DeductionList.jsx'
import SimulationResult from '../components/SimulationResult.jsx'
import '../styles/simulation.css'

// N-18 신용케어 시뮬레이터 — 바꾼 조건을 버튼으로 계산해 예상 점수와 참고 상품을 보여 준다.
export default function SimulationPage() {
  const { user } = useAuth()
  const sim = useSimulation(user?.userId)
  const products = useLoanProducts()
  const [focusKeys, setFocusKeys] = useState([])
  const [toast, setToast] = useState('')
  const focusTimer = useRef(null)

  useEffect(() => () => clearTimeout(focusTimer.current), [])

  if (sim.loading) return <p role="status">시뮬레이터 값을 불러오는 중입니다.</p>
  if (sim.error) return <Notice type="warn">{sim.error} <Button onClick={sim.reload}>다시 시도</Button></Notice>

  const values = sim.values ?? {}
  // 결과가 지금 입력과 다른 조건으로 계산된 것인지(대기·계산 중·요청 안 함·실패 포함).
  const stale = Boolean(sim.result) && !sameInputs(values, sim.applied)
  // N-18-7 추천과 카드의 충족 표시는 같은 점수(계산 전에는 현재 점수, 계산 후에는 예상 점수)를 쓴다.
  const shownScore = sim.result?.changed.score ?? sim.currentScore
  const recommendations = selectRecommendations(products.items, shownScore, user?.jobType, matchesLoanScore)
  // N-18 문제가 있는 항목만 해당 칸 옆에 오류를 보여 준다(슬라이더에는 넘기지 않는다).
  const inputErrors = getInputErrors(values, sim.baseline)
  const usageRatio = Number.isInteger(values.cardLimitAmount) && values.cardLimitAmount > 0 && Number.isInteger(values.cardMonthlyUsage)
    ? `${Math.round(values.cardMonthlyUsage / values.cardLimitAmount * 100)}%` : '—'

  // N-18-9 예시 값을 칸에 넣고 첫 칸으로 이동한다. 계산은 버튼을 눌러 요청한다.
  const handleFill = (example) => {
    sim.fillValues(example)
    const keys = Object.keys(example)
    setFocusKeys(keys)
    setToast(sameInputs({ ...values, ...example }, sim.applied ?? sim.baseline)
      ? '이미 계산한 조건입니다. 결과를 확인해 보세요.'
      : '예시 값을 넣었습니다. [예상 점수 계산하기]를 눌러 확인해 보세요.')
    clearTimeout(focusTimer.current)
    focusTimer.current = setTimeout(() => {
      const input = document.querySelector(`#sim-field-${keys[0]} input`)
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      input?.focus({ preventScroll: true })
    }, 30)
  }
  const handleReset = () => { setFocusKeys([]); sim.reset() }
  const fieldClass = (key) => (focusKeys.includes(key) ? 'sim-field sim-field--focus' : 'sim-field')

  return (
    <div className="sim-page">
      <header className="sim-heading">
        <h1>신용케어 시뮬레이터</h1>
        <p>조건을 바꾸고 [예상 점수 계산하기]를 누르면 점수와 알아볼 수 있는 대출이 어떻게 바뀌는지 보여 줍니다.<br />금리·한도는 더미 데이터입니다. 여기서 계산한 점수는 저장되지 않으며 내 실제 점수에는 영향을 주지 않습니다.</p>
      </header>
      {sim.currentScore === null && <Notice type="warn">저장된 대안 점수가 없어 예상 점수를 계산할 수 없습니다.</Notice>}

      <DeductionList deductions={sim.deductions} onFill={handleFill} />

      <div className="sim-layout">
        <Card title="조건 바꾸기" className="sim-inputs">
          <div className="sim-row"><span className="sim-hint">지금 값은 저장된 내 현재 값입니다.</span><Button size="sm" onClick={handleReset}>내 현재 값으로 되돌리기</Button></div>
          <div className="sim-slider-grid">
            {SLIDER_FIELDS.map((field) => (
              <div key={field.key} id={`sim-field-${field.key}`} className={fieldClass(field.key)}>
                {/* N-18-2 값이 비어 있으면 슬라이더 위치만 최솟값에 두고 직접 입력할 수 있다. */}
                <Slider label={field.label} min={field.min} max={field.max} unit={field.unit}
                  value={sliderValue(values[field.key], field)} onChange={(v) => sim.setValue(field.key, v)}
                  formatValue={() => sliderText(values[field.key], field, values[field.key] == null)} />
                {/* N-18-2 저장된 현재 값이 슬라이더 최대보다 크면 그 값까지 직접 입력을 허용한다. */}
                <NumberInput label={`${field.label} 직접 입력`} min={field.min} max={Math.max(field.max, sim.baseline?.[field.key] ?? field.max)} step={1} unit={field.unit}
                  value={values[field.key] ?? null} onChange={(v) => sim.setValue(field.key, v)} error={inputErrors[field.key]} />
                <span className="sim-hint">{field.min}{field.unit} ~ {field.max}{field.unit} · 내 현재 값 {sim.baseline?.[field.key] ?? '없음'}{sim.baseline?.[field.key] == null ? '' : field.unit}{sim.baseline?.[field.key] > field.max ? ` (슬라이더 범위 밖 · 현재 값 ${sim.baseline[field.key]}${field.unit})` : ''}</span>
              </div>
            ))}
          </div>
          <div className="sim-money-grid">
            {MONEY_FIELDS.map((field) => (
              <div key={field.key} id={`sim-field-${field.key}`} className={fieldClass(field.key)}>
                <MoneyInput label={field.label} value={values[field.key]} onChange={(v) => sim.setValue(field.key, v)}
                  error={inputErrors[field.key]} placeholder="미입력" />
              </div>
            ))}
          </div>
          <p className="sim-hint">카드 사용 비율 {usageRatio}</p>
          <div className="sim-row">
            <Button variant="primary" onClick={sim.calculate} disabled={!sim.canCalculate}>예상 점수 계산하기</Button>
            <span className={sim.status === 'invalid' || sim.status === 'error' || (sim.status === 'idle' && sim.canCalculate) ? 'sim-warn sim-status' : 'sim-hint sim-status'} role="status">{statusText(sim.status, Boolean(sim.result), sim.canCalculate)}</span>
          </div>
          {sim.calcError && !(sim.status === 'invalid' && HIDDEN_INVALID_MESSAGES.includes(sim.calcError)) && <Notice type="warn">{sim.calcError}{sim.status === 'error' && <> <Button size="sm" onClick={sim.retry}>다시 계산</Button></>}</Notice>}
        </Card>
        <SimulationResult currentScore={sim.currentScore} currentGradeCode={sim.currentGradeCode} initialMetrics={sim.initialMetrics} result={sim.result} stale={stale} />
      </div>

      <Card title="이 점수로 알아볼 수 있는 대출 상품" className="sim-products">
        <div className="sim-row"><span className="sim-hint">더미 상품 · 실제 상품 아님. 같은 점수대의 참고 정보이며 대출 승인을 뜻하지 않습니다.</span><Link to={PATHS.LOANS}>상품 페이지 가기 ›</Link></div>
        <p className={stale ? 'sim-warn' : 'sim-warn sim-reserve'}>위 상품은 이전 조건으로 계산한 점수 기준입니다. 지금 입력으로 다시 계산되면 바뀝니다.</p>
        {products.error ? <Notice type="warn">{products.error}</Notice>
          : recommendations.length ? <div className="sim-product-grid">{recommendations.map((product) => <LoanProductCard key={product.productId} product={product} score={shownScore} workerTypeCode={user?.jobType} />)}</div>
            : <p className="sim-hint">{shownScore === null ? '점수가 없어 상품을 고를 수 없습니다.' : '이 점수와 직군에 맞는 상품이 없습니다.'}</p>}
      </Card>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}

// 슬라이더 위치: 범위 안 정수는 그대로, 범위 밖은 끝값, 비어 있거나 올바르지 않으면 0(최소값)에 둔다. 화면 위치일 뿐 실제 값은 바꾸지 않는다.
function sliderValue(value, field) {
  return Number.isInteger(value) ? Math.min(field.max, Math.max(field.min, value)) : field.min
}

// 슬라이더 옆 값 표시: 저장값 없음, 비었거나 올바르지 않음, 범위 밖 실제 값을 구분해 0으로 보이지 않게 한다.
function sliderText(value, field, missing) {
  if (missing) return '값 없음'
  if (!Number.isInteger(value) || value < field.min) return '—'
  return value > field.max ? `현재 값 ${value}${field.unit}` : `${value}${field.unit}`
}

// N-18-4 버튼 계산 상태 안내 문구.
function statusText(status, hasResult, canCalculate) {
  if (status === 'calculating') return '예상 점수를 계산하는 중입니다.'
  if (status === 'invalid') return '입력값을 확인해 주세요. 올바른 값이 될 때까지 계산을 요청하지 않습니다.'
  if (status === 'error') return '계산하지 못했습니다.'
  if (canCalculate) return '조건이 바뀌었습니다. 계산하기를 눌러 주세요.'
  return hasResult ? '지금 조건으로 계산한 결과입니다.' : '조건을 바꾸고 계산하기를 눌러 주세요.'
}

// N-18-7 대출 상품 화면과 같은 카탈로그(getLoanProducts)를 읽는다. 상품을 따로 정의하지 않는다.
function useLoanProducts() {
  const [state, setState] = useState({ items: [], error: '' })
  useEffect(() => {
    let active = true
    getLoanProducts().then(
      (items) => { if (active) setState({ items, error: '' }) },
      (error) => { if (active) setState({ items: [], error: error.message }) },
    )
    return () => { active = false }
  }, [])
  return state
}
