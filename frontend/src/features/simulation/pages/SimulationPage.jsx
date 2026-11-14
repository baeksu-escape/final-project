import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Card, MoneyInput, Notice, NumberInput, Slider, Toast } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { getLoanProducts, matchesLoanScore } from '../../loans/api/loanCatalog.js'
import LoanProductCard from '../../loans/components/LoanProductCard.jsx'
import { MONEY_FIELDS, SLIDER_FIELDS, sameInputs, selectRecommendations } from '../adapters/simulationAdapter.js'
import { useSimulation } from '../api/useSimulation.js'
import DeductionList from '../components/DeductionList.jsx'
import SimulationResult from '../components/SimulationResult.jsx'
import '../styles/simulation.css'

// N-18 신용케어 시뮬레이터 — 조건 10개를 바꾸면 입력이 멈춘 뒤 자동으로 예상 점수와 같은 점수대 참고 상품을 보여 준다.
export default function SimulationPage() {
  const { user } = useAuth()
  const sim = useSimulation(user?.userId)
  const products = useLoanProducts()
  const [focusKeys, setFocusKeys] = useState([])
  const [toast, setToast] = useState('')

  if (sim.loading) return <p role="status">시뮬레이터 값을 불러오는 중입니다.</p>
  if (sim.error) return <Notice type="warn">{sim.error} <Button onClick={sim.reload}>다시 시도</Button></Notice>

  const values = sim.values ?? {}
  // 결과가 지금 입력과 다른 조건으로 계산된 것인지(대기·계산 중·요청 안 함·실패 포함).
  const stale = Boolean(sim.result) && !sameInputs(values, sim.applied)
  // N-18-7 추천과 카드의 충족 표시는 같은 점수(계산 전에는 현재 점수, 계산 후에는 예상 점수)를 쓴다.
  const shownScore = sim.result?.changed.score ?? sim.currentScore
  const recommendations = selectRecommendations(products.items, shownScore, user?.jobType, matchesLoanScore)
  const usageRatio = Number.isInteger(values.cardLimitAmount) && values.cardLimitAmount > 0 && Number.isInteger(values.cardMonthlyUsage)
    ? `${Math.round(values.cardMonthlyUsage / values.cardLimitAmount * 100)}%` : '—'

  // N-18-9 예시 값을 칸에 넣고 첫 칸으로 이동한다. 계산은 일반 입력과 같이 0.5초 뒤 자동으로 한다.
  const handleFill = (example) => {
    sim.fillValues(example)
    const keys = Object.keys(example)
    setFocusKeys(keys)
    setToast('예시 값을 넣었습니다. 잠시 뒤 자동으로 예상 점수를 다시 계산합니다.')
    setTimeout(() => {
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
        <p>조건을 바꾸면 입력이 멈춘 뒤 자동으로 점수와 알아볼 수 있는 대출이 어떻게 바뀌는지 보여 줍니다. 실제 점수에는 반영되지 않습니다.</p>
      </header>
      {sim.currentScore === null && <Notice type="warn">저장된 대안 점수가 없어 예상 점수를 계산할 수 없습니다.</Notice>}

      <DeductionList deductions={sim.deductions} onFill={handleFill} />

      <div className="sim-layout">
        <Card title="조건 바꾸기" className="sim-inputs">
          <div className="sim-row"><span className="sim-hint">지금 값은 저장된 내 실제 값입니다.</span><Button size="sm" onClick={handleReset}>내 실제 값으로 되돌리기</Button></div>
          <div className="sim-slider-grid">
            {SLIDER_FIELDS.map((field) => (
              <div key={field.key} id={`sim-field-${field.key}`} className={fieldClass(field.key)}>
                {/* 슬라이더와 숫자 칸이 같은 값을 함께 바꾼다. 미입력(null)이나 범위 밖 값이면 슬라이더는 숨겨 0으로 보이지 않게 한다. */}
                {inSliderRange(values[field.key], field)
                  ? <Slider label={field.label} min={field.min} max={field.max} unit={field.unit}
                    value={values[field.key]} onChange={(v) => sim.setValue(field.key, v)} />
                  : <p className="sim-hint">{field.label}: {values[field.key] === null || values[field.key] === undefined ? '미입력 · 아래 칸에 직접 입력해 주세요.' : '범위 밖 값입니다.'}</p>}
                <NumberInput label={`${field.label} 직접 입력`} min={field.min} max={field.max} step={1} unit={field.unit}
                  value={values[field.key] ?? null} onChange={(v) => sim.setValue(field.key, v)} />
                <span className="sim-hint">{field.min}{field.unit} ~ {field.max}{field.unit} · 지금 {sim.baseline?.[field.key] ?? '미입력'}{sim.baseline?.[field.key] === null ? '' : field.unit}</span>
              </div>
            ))}
          </div>
          <div className="sim-money-grid">
            {MONEY_FIELDS.map((field) => (
              <div key={field.key} id={`sim-field-${field.key}`} className={fieldClass(field.key)}>
                <MoneyInput label={field.label} value={values[field.key]} onChange={(v) => sim.setValue(field.key, v)} placeholder="미입력" />
              </div>
            ))}
          </div>
          <p className="sim-hint">카드 사용 비율 {usageRatio}</p>
          <div className="sim-row">
            <span className={sim.status === 'invalid' || sim.status === 'error' ? 'sim-warn' : 'sim-hint'} role="status">{statusText(sim.status, Boolean(sim.result))}</span>
          </div>
          {sim.calcError && <Notice type="warn">{sim.calcError}{sim.status === 'error' && <> <Button size="sm" onClick={sim.retry}>다시 계산</Button></>}</Notice>}
        </Card>
        <SimulationResult currentScore={sim.currentScore} result={sim.result} stale={stale} />
      </div>

      <Card title="이 점수로 알아볼 수 있는 대출 상품" className="sim-products">
        <div className="sim-row"><span className="sim-hint">더미 상품 · 실제 상품 아님. 같은 점수대의 참고 정보이며 대출 승인을 뜻하지 않습니다.</span><Link to={PATHS.LOANS}>상품 페이지 가기 ›</Link></div>
        {products.error ? <Notice type="warn">{products.error}</Notice>
          : recommendations.length ? <div className="sim-product-grid">{recommendations.map((product) => <LoanProductCard key={product.productId} product={product} score={shownScore} workerTypeCode={user?.jobType} />)}</div>
            : <p className="sim-hint">{shownScore === null ? '점수가 없어 상품을 고를 수 없습니다.' : '이 점수와 직군에 맞는 상품이 없습니다.'}</p>}
      </Card>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}

// 슬라이더로 보여 줄 수 있는 값인지(0 이상 정수, 범위 안) 본다.
function inSliderRange(value, field) {
  return Number.isInteger(value) && value >= field.min && value <= field.max
}

// N-18-4 자동 계산 상태 안내 문구.
function statusText(status, hasResult) {
  if (status === 'waiting') return '입력이 멈추면 0.5초 뒤 자동으로 계산합니다.'
  if (status === 'calculating') return '예상 점수를 계산하는 중입니다.'
  if (status === 'invalid') return '입력값을 확인해 주세요. 올바른 값이 될 때까지 계산을 요청하지 않습니다.'
  if (status === 'error') return '계산하지 못했습니다.'
  return hasResult ? '지금 조건으로 계산한 결과입니다.' : '값을 바꾸면 자동으로 예상 점수를 계산합니다.'
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
