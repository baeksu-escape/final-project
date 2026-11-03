import { useId } from 'react'
import FieldError from './FieldError.jsx'

// 선택 상자 — options는 [{ value, label }] 배열. placeholder를 주면 빈 선택지가 생기고, 그걸 고르면 onChange(null)이다.
// 사용 예: <Select label="직군" options={JOB_TYPE_OPTIONS} value={jobType} onChange={setJobType} placeholder="선택하세요" />
export default function Select({ label, value, onChange, options, placeholder, error, name, disabled = false }) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="form-field select">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="select__control"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
