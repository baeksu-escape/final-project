import { Button, Card, MoneyInput, NumberInput, Slider } from '../../../common/components/index.js'
import { EASY_PRESETS, SCENARIO_FIELDS, amountFromPct, amountRange, baseAmountOf, pctFromAmount } from './scenarioConfig.js'

const signed = (value, unit, digits = 0) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${unit}`
const won = (value) => `${Math.round(value).toLocaleString('ko-KR')}원`
// 큰 금액을 읽기 쉽게 '210만 원'처럼 보여 준다(만 원 아래는 반올림). 1만 원보다 작으면 원 단위 그대로.
const manwon = (value) => (Math.abs(value) >= 10000 ? `${Math.round(value / 10000).toLocaleString('ko-KR')}만 원` : won(value))
// 변화 퍼센트를 말로 — "20% 줄어듦", "10% 늘어남", "그대로"
const changeText = (pct) => {
  if (!Number.isFinite(pct)) return '미입력'
  const rounded = Math.round(Math.abs(pct) * 10) / 10
  if (rounded === 0) return '그대로'
  return `${rounded}% ${pct < 0 ? '줄어듦' : '늘어남'}`
}

// N-17-2 (시안·쉬운 화면 2차) 상황 칩 5개 + 항목마다 한 줄.
// 월 소득·월 지출: 슬라이더 + 금액(원) 직접 입력 — 금액을 넣으면 지금 금액 대비 퍼센트로 바꿔 서버에 보낸다(서버는 퍼센트를 받는다).
// 대출 금리: 슬라이더 + %p 칸, 아래에 이자가 한 달에 얼마 바뀌는지 미리보기(정확한 값은 결과 카드의 서버 계산).
// 슬라이더를 움직이면 상황 선택이 풀린다.
export default function ScenarioControls({ values, presetId, inputError, calcError, variableLoanBalanceAmount, baseline, onChange, onSelect, onRetry }) {
  return (
    <Card title="예상 시나리오" className="sc-controls">
      <div className="sc-chips" role="group" aria-label="상황 고르기">
        {EASY_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="sc-preset" aria-pressed={presetId === preset.id} onClick={() => onSelect(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
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
              <MoneyInput label={`${field.label} 금액으로 입력`} value={amount}
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
            <NumberInput label={`${field.label} 숫자로 입력 (${field.inputMin}~${field.inputMax}${field.unit})`} min={field.inputMin} max={field.inputMax} step={field.step} unit={field.unit}
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
          </div>
        )
      })}
      {/* 입력 안내는 늘 같은 자리·높이에 둔다. */}
      <p className={inputError ? 'sc-status sc-status--warn' : 'sc-status'} role="status" aria-live="polite">
        {inputError || (Number.isSafeInteger(variableLoanBalanceAmount)
          ? `금리 변화는 변동금리 대출 ${variableLoanBalanceAmount.toLocaleString('ko-KR')}원에만 적용돼요.`
          : '변동금리 대출 정보가 없어 대출 갚는 돈과 남는 돈은 계산하지 않아요.')}
        {calcError && <> <Button size="sm" onClick={onRetry}>다시 시도</Button></>}
      </p>
    </Card>
  )
}
