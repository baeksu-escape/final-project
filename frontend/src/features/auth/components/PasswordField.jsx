import { useId } from 'react'
import { FieldError } from '../../../common/components/index.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import { filterPassword, hangulToQwerty } from '../validation.js'

// FP-258 조합이 끝난 한글은 두벌식 영문 키로 바꾼 뒤 거른다(가린 칸에 같은 키를 친 값과 같아진다).
const finishPassword = (raw) => filterPassword(hangulToQwerty(raw))

// 눈 모양 아이콘(인라인 SVG). 가려져 있을 때는 눈, 보일 때는 사선 그은 눈(Edge 기본 모양과 같은 뜻).
function EyeIcon({ crossed }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  )
}

// FP-258 N-01-1 비밀번호 칸 — 칸 안 오른쪽 눈 버튼으로 type을 password ↔ text로 바꾼다. 보이는지(visible)는 부모(usePasswordReveal)가 들고 있다.
// 공통 TextInput에는 칸 안에 버튼 자리가 없어 같은 공통 클래스(form-field·text-input__control·FieldError)로 직접 그린다.
// 사용 예: <PasswordField label="비밀번호" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" {...reveal('password')} />
export default function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  name,
  placeholder,
  autoComplete,
  disabled = false,
  visible = false,
  onToggleVisible,
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  // ASCII 밖 글자는 걸러 내고(filterPassword), 보기 상태에서 조합한 한글은 조합이 끝날 때 영문 키로 바꾼다(finishPassword).
  const passwordInput = useImeSafeFilter()(onChange, filterPassword, finishPassword)
  // 값이 있을 때만 눈 버튼과 오른쪽 여백을 둔다.
  const filled = (value ?? '') !== ''
  return (
    <div className={filled ? 'form-field text-input password-field password-field--filled' : 'form-field text-input password-field'}>
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <div className="password-field__box">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          className="text-input__control"
          value={value ?? ''}
          onChange={(event) => passwordInput.onChange(event.target.value)}
          {...passwordInput.compositionProps}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {filled && (
          <button
            type="button"
            className="password-field__toggle"
            aria-pressed={visible}
            aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
            onClick={onToggleVisible}
            disabled={disabled}
          >
            <EyeIcon crossed={visible} />
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="form-field__hint">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
