import { useId } from 'react'
import FieldError from './FieldError.jsx'

// 텍스트 입력 — type으로 text·email·password·tel을 고르고, onChange에는 입력한 문자열을 그대로 넘긴다.
// 사용 예: <TextInput label="이메일" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
//   hint: 입력 칸 아래에 보조 안내 문구를 붙일 때 쓴다(예: "하이픈 없이 입력해도 됩니다").
export default function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  name,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  disabled = false,
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="form-field text-input">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className="text-input__control"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={hintId} className="form-field__hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
