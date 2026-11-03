import { useId } from 'react'
import FieldError from './FieldError.jsx'

// 슬라이더(input type="range") — 현재 값을 옆에 함께 보여 주고, onChange에는 숫자를 넘긴다.
// 사용 예: <Slider label="최근 1년 연체 횟수" unit="회" value={count} onChange={setCount} min={0} max={12} />
//   formatValue: 표시 형식을 바꿀 때 쓴다. 예) formatValue={(v) => `${v}%`}
export default function Slider({ label, value, onChange, min = 0, max = 100, step = 1, unit = '', formatValue, error, name, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  const display = formatValue ? formatValue(value) : `${value}${unit}`
  return (
    <div className="form-field slider">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="range"
        className="slider__control"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <output htmlFor={id} className="slider__value">
        {display}
      </output>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
