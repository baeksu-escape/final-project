import { Button, Card, MoneyInput, NumberInput, Slider } from '../../../common/components/index.js'
import { Link } from 'react-router-dom'
import { PATHS } from '../../../common/config/navigation.js'
import { EASY_PRESETS, SCENARIO_FIELDS, amountFromPct, amountRange, baseAmountOf, pctFromAmount } from './scenarioConfig.js'

const signed = (value, unit, digits = 0) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${unit}`
const won = (value) => `${Math.round(value).toLocaleString('ko-KR')}원`
// 큰 금액을 읽기 쉽게 만 원 단위로 보여 준다(소수 첫째 자리까지). 1만 원보다 작으면 원 단위 그대로.
const manwon = (value) => (Math.abs(value) >= 10000 ? `${(Math.round(value / 1000) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}만 원` : won(value))
// 변화 퍼센트를 말로 — "20% 줄어듦", "10% 늘어남", "그대로"
const changeText = (pct) => {
  if (!Number.isFinite(pct)) return '미입력'
  const rounded = Math.round(Math.abs(pct) * 10) / 10
  if (rounded === 0) return '그대로'
  return `${rounded}% ${pct < 0 ? '줄어듦' : '늘어남'}`
}

// N-17-2 베스트·워스트 버튼과 금리·소득·지출 입력을 한 카드에 보여 준다.
// 월 소득·월 지출: 슬라이더 + 금액(원) 직접 입력 — 금액을 넣으면 지금 금액 대비 퍼센트로 바꿔 서버에 보낸다(서버는 퍼센트를 받는다).
// 대출 금리: 슬라이더 + %p 칸, 아래에 이자가 한 달에 얼마 바뀌는지 미리보기(정확한 값은 결과 카드의 서버 계산).
// 슬라이더를 움직이면 상황 선택이 풀린다.
// N-17-2 초기화는 제목 줄에, 베스트·워스트 선택은 계산 버튼 위에 배치한다.
// N-17-2 조건을 입력한 뒤 계산 버튼을 눌러 서버 재계산을 요청한다.
export default function ScenarioControls({ values, presetId, inputError, calcError, variableLoanBalanceAmount, baseline, stale, calculating, onChange, onSelect, onReset, onRetry, onCalculate }) {
  return (
    <Card title="예상 시나리오" className="sc-controls">
      {/* N-17-2 초기화 버튼은 조건을 기본 상태로 돌린다. */}
      <button type="button" className="sc-reset" onClick={onReset}>초기화</button>
      {SCENARIO_FIELDS.map((field) => {
        const value = values[field.key]
        const valid = Number.isFinite(value)
        const base = baseAmountOf(field, baseline)
        const slider = (
          <Slider label={field.label} min={field.sliderMin} max={field.sliderMax} step={field.step}
            value={valid ? Math.min(field.sliderMax, Math.max(field.sliderMin, value)) : field.sliderMin}
            formatValue={() => (base ? changeText(value) : valid ? signed(value, field.unit, field.step < 1 ? 1 : 0) : '미입력')}
            onChange={(v) => onChange(field.key, v)} />
        )
        // 월 소득·월 지출 — 금액 칸. 입력 중에는 값을 자르지 않고, 범위를 넘으면 아래 안내와 칸 오류로 알린다(계산은 화면 검사가 막는다).
        if (base) {
          const [min, max] = amountRange(field, base)
          const amount = valid ? amountFromPct(base, value) : null
          const outOfRange = valid && (value < field.inputMin || value > field.inputMax)
          return (
            <div key={field.key} className="sc-row-field">
              {slider}
              <MoneyInput label="금액 직접 입력" value={amount}
                error={outOfRange ? `${won(min)}~${won(max)}` : undefined}
                onChange={(v) => onChange(field.key, v === null ? null : pctFromAmount(base, v))} />
              <span className="sc-hint sc-row-field__help">
                지금 {manwon(base)} → <strong>{amount === null ? '—' : manwon(amount)}</strong>
              </span>
            </div>
          )
        }
        // 대출 금리(또는 지금 금액을 모르는 항목) — %p·% 칸. 금리는 이자 미리보기를 붙인다.
        const interest = field.key === 'ratePctPoint' && valid && Number.isFinite(variableLoanBalanceAmount)
          ? Math.round(variableLoanBalanceAmount * value / 100 / 12) : null
        return (
          <div key={field.key} className="sc-row-field">
            {/* 직접 입력 값이 슬라이더 범위를 넘으면 슬라이더는 끝에 두고 실제 값은 숫자 칸에 그대로 둔다. */}
            {slider}
            <NumberInput label={`직접 입력 (${field.inputMin}~${field.inputMax}${field.unit})`} min={field.inputMin} max={field.inputMax} step={field.step} unit={field.unit}
              value={value} onChange={(v) => {
                // N-17-2 직접 입력이 범위를 넘으면 경계값으로 맞추고, 빈칸은 다시 입력할 수 있도록 허용한다.
                if (v === null) onChange(field.key, null)
                else if (Number.isFinite(v)) onChange(field.key, Math.min(field.inputMax, Math.max(field.inputMin, v)))
              }} />
            <span className="sc-hint sc-row-field__help">
              {field.key !== 'ratePctPoint' ? field.help
                : !Number.isFinite(variableLoanBalanceAmount) || variableLoanBalanceAmount === 0 ? '변동금리 대출이 없어 이자는 그대로예요.'
                  : interest === null || interest === 0 ? '이자는 그대로예요.'
                    : <>이자가 한 달에 약 <strong>{manwon(Math.abs(interest))}</strong> {interest > 0 ? '늘어요' : '줄어요'}.</>}
            </span>
            {field.key === 'ratePctPoint' && <div className="sc-row-field">
              <Link className="text-link" to={PATHS.ASSET_DEBT}>보유 대출 전체 보기</Link>
            </div>}
          </div>
        )
      })}
      {/* 입력 안내는 늘 같은 자리·높이에 둔다. */}
      <p className={inputError ? 'sc-status sc-status--warn' : 'sc-status'} role="status" aria-live="polite">
        {inputError || (!Number.isSafeInteger(variableLoanBalanceAmount)
          ? '변동금리 대출 정보가 없어 대출 갚는 돈과 여유 자금은 계산하지 않아요.'
          : variableLoanBalanceAmount === 0
            ? '금리는 변동금리 대출에만 적용돼요. 지금 대출은 모두 고정금리라 금리를 바꿔도 결과는 그대로예요.'
            : `금리 변화는 변동금리 대출 ${variableLoanBalanceAmount.toLocaleString('ko-KR')}원에만 적용돼요.`)}
        {calcError && <> <Button size="sm" onClick={onRetry}>다시 시도</Button></>}
      </p>
      <div className="sc-calc">
        {/* N-17-2 베스트·워스트 버튼은 계산 버튼 바로 위에 둔다. */}
        <div className="sc-chips" role="group" aria-label="상황 고르기">
          {EASY_PRESETS.map((preset) => {
            const [label, englishLabel] = preset.label.split(' (')
            return (
              <button key={preset.id} type="button" className="sc-preset" aria-pressed={presetId === preset.id} onClick={() => onSelect(preset)}>
                {label}<br />({englishLabel}
              </button>
            )
          })}
        </div>
        <Button variant="primary" onClick={onCalculate} disabled={Boolean(inputError) || calculating}>
          {calculating ? '계산하는 중…' : '예상 시나리오 계산하기'}
        </Button>
        <span className={stale ? 'sc-hint sc-warn' : 'sc-hint'} role="status" aria-live="polite">
          {inputError ? '입력값을 고치면 계산할 수 있어요.' : stale ? '조건이 바뀌었어요. 버튼을 눌러 계산해 보세요.' : '지금 조건으로 계산한 결과예요.'}
        </span>
      </div>
    </Card>
  )
}
