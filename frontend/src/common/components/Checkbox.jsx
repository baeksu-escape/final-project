import { useId } from 'react'
import FieldError from './FieldError.jsx'

// 체크박스 — onChange에는 true/false를 넘긴다. 필수 동의처럼 오류 문구가 필요하면 error를 준다.
// 사용 예: <Checkbox label="(필수) 개인신용정보 수집·이용 동의" checked={agreed} onChange={setAgreed} error={errors.agreed} />
export default function Checkbox({ label, checked, onChange, error, name, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="form-field checkbox">
      <input
        id={id}
        name={name}
        type="checkbox"
        className="checkbox__control"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <label htmlFor={id} className="checkbox__label">
        {label}
      </label>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
