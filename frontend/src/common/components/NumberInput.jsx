import { useId } from 'react'
import FieldError from './FieldError.jsx'

// 숫자 입력 — onChange에는 숫자를, 비우면 null을 넘긴다. unit을 주면 입력 칸 뒤에 단위를 보여 준다.
// 사용 예: <NumberInput label="재직 기간" unit="개월" value={months} onChange={setMonths} min={0} max={600} />
export default function NumberInput({ label, value, onChange, min, max, step, unit, error, name, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="form-field number-input">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        className="number-input__control"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {unit && <span className="number-input__unit">{unit}</span>}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
