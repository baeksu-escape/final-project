import { Button, Card, NumberInput, Slider } from '../../../common/components/index.js'
import { EASY_PRESETS, SCENARIO_FIELDS } from './scenarioConfig.js'

const signed = (value, unit, digits = 0) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${unit}`

// N-17-2 (시안·쉬운 화면) 상황 버튼 5개를 한 줄 칩으로, 금리·소득·지출은 항목마다 한 줄(슬라이더 + 숫자 칸)로 바꾼다.
// 슬라이더를 움직이면 상황 선택이 풀린다. 숫자 칸은 슬라이더보다 넓은 범위를 받는다(범위는 칸 안내로만 남김).
export default function ScenarioControls({ values, presetId, inputError, calcError, variableLoanBalanceAmount, onChange, onSelect, onRetry }) {
  return (
    <Card title="상황 바꾸기" className="sc-controls">
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
        return (
          <div key={field.key} className="sc-row-field">
            {/* 직접 입력 값이 슬라이더 범위를 넘으면 슬라이더는 끝에 두고 실제 값은 숫자 칸에 그대로 둔다. */}
            <Slider label={field.label} min={field.sliderMin} max={field.sliderMax} step={field.step}
              value={valid ? Math.min(field.sliderMax, Math.max(field.sliderMin, value)) : field.sliderMin}
              formatValue={() => (valid ? signed(value, field.unit, field.step < 1 ? 1 : 0) : '미입력')}
              onChange={(v) => onChange(field.key, v)} />
            <NumberInput label={`${field.label} 숫자로 입력 (${field.inputMin}~${field.inputMax}${field.unit})`} min={field.inputMin} max={field.inputMax} step={field.step} unit={field.unit}
              value={value} onChange={(v) => {
                // N-17-2 직접 입력이 범위를 넘으면 경계값으로 맞추고, 빈칸은 다시 입력할 수 있도록 허용한다.
                if (v === null) onChange(field.key, null)
                else if (Number.isFinite(v)) onChange(field.key, Math.min(field.inputMax, Math.max(field.inputMin, v)))
              }} />
            <span className="sc-hint sc-row-field__help">{field.help}</span>
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
