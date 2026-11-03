import { useId } from 'react'
import { formatWithComma, parseDigits } from '../utils/number.js'
import FieldError from './FieldError.jsx'

// 금액 입력(원 단위) — 화면에는 천 단위 쉼표로 보이고, onChange에는 숫자(원)를, 비우면 null을 넘긴다. 숫자 외 문자는 무시한다.
// 사용 예: <MoneyInput label="월 소득" value={income} onChange={setIncome} error={errors.income} />
export default function MoneyInput({ label, value, onChange, error, name, placeholder, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="form-field money-input">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="money-input__control"
        value={formatWithComma(value)}
        onChange={(event) => onChange(parseDigits(event.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <span className="money-input__unit">원</span>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
