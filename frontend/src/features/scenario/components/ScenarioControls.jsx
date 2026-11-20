import { Button, Card, NumberInput, Slider } from '../../../common/components/index.js'
import { BASE_PRESET, BETTER_PRESETS, SCENARIO_FIELDS, WORSE_PRESETS } from './scenarioConfig.js'

const signed = (value, unit, digits = 0) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${unit}`

// N-17-2 상황 버튼 9개와 금리·소득·지출 슬라이더+직접 입력. 슬라이더를 움직이면 상황 선택이 풀린다.
export default function ScenarioControls({ values, presetId, inputError, calcError, variableLoanBalanceAmount, onChange, onSelect, onRetry }) {
  const presetButton = (preset) => (
    <button key={preset.id} type="button" className="sc-preset" aria-pressed={presetId === preset.id} onClick={() => onSelect(preset)}>
      {preset.label}
    </button>
  )
  return (
    <Card title="상황 고르기" className="sc-controls">
      {presetButton(BASE_PRESET)}
      <div className="sc-preset-groups">
        <div className="sc-group"><span className="sc-group__title sc-neg">▼ 나빠지는 경우</span>{WORSE_PRESETS.map(presetButton)}</div>
        <div className="sc-group"><span className="sc-group__title sc-pos">▲ 좋아지는 경우</span>{BETTER_PRESETS.map(presetButton)}</div>
      </div>
      {SCENARIO_FIELDS.map((field) => {
        const value = values[field.key]
        const valid = Number.isFinite(value)
        return (
          <div key={field.key} className="sc-field">
            {/* 직접 입력 값이 슬라이더 범위를 넘으면 슬라이더는 끝에 두고 실제 값은 숫자 칸에 그대로 둔다. */}
            <Slider label={field.label} min={field.sliderMin} max={field.sliderMax} step={field.step}
              value={valid ? Math.min(field.sliderMax, Math.max(field.sliderMin, value)) : field.sliderMin}
              formatValue={() => (valid ? signed(value, field.unit, field.step < 1 ? 1 : 0) : '미입력')}
              onChange={(v) => onChange(field.key, v)} />
            <NumberInput label={`${field.label} 직접 입력`} min={field.inputMin} max={field.inputMax} step={field.step} unit={field.unit}
              value={value} onChange={(v) => {
                // N-17-2 직접 입력이 범위를 넘으면 경계값으로 맞추고, 빈칸은 다시 입력할 수 있도록 허용한다.
                if (v === null) onChange(field.key, null)
                else if (Number.isFinite(v)) onChange(field.key, Math.min(field.inputMax, Math.max(field.inputMin, v)))
              }} />
            <span className="sc-hint">슬라이더 {field.sliderMin}~{field.sliderMax}{field.unit} · 칸에 직접 넣으면 {field.inputMin}~{field.inputMax}{field.unit}</span>
          </div>
        )
      })}
      {/* 입력 안내는 늘 같은 자리·높이에 둔다. */}
      <p className={inputError ? 'sc-status sc-status--warn' : 'sc-status'} role="status" aria-live="polite">
        {inputError || (Number.isSafeInteger(variableLoanBalanceAmount)
          ? `변동금리 대출 ${variableLoanBalanceAmount.toLocaleString('ko-KR')}원에 금리 변화를 적용합니다.`
          : '변동금리 대출 잔액 정보가 없어 변경 후 월 원리금과 월 잉여는 계산하지 않습니다.')}
        {calcError && <> <Button size="sm" onClick={onRetry}>다시 시도</Button></>}
      </p>
    </Card>
  )
}
