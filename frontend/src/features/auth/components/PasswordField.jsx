import { useId } from 'react'
import { FieldError } from '../../../common/components/index.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import { filterPassword, hangulToQwerty } from '../validation.js'

// FP-258 5차 조합이 끝난 한글은 두벌식 영문 키로 바꾼 뒤 거른다(가린 칸에 같은 키를 친 값과 같아진다).
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

// FP-258 2차·3차 N-01-1 비밀번호 칸 — 칸 안 오른쪽의 눈 모양 버튼을 누르면 type이 password ↔ text로 바뀐다.
// 보이는지(visible)는 부모(usePasswordReveal)가 들고 있어서 값을 고치거나 포커스가 나가도 그대로다.
// 공통 TextInput에는 칸 안에 버튼을 둘 자리가 없어, 같은 공통 클래스(form-field·text-input__control·FieldError)로 직접 그린다.
// 브라우저(Edge) 기본 눈 모양은 숨기고, 버튼 위치는 auth.css의 .password-field 규칙이 정한다(오류 문구가 떠도 칸 안에 머문다).
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
  // FP-258 4차 한글 등 ASCII 밖 글자는 붙여넣을 때·조합 없이 입력될 때 걸러 낸다(filterPassword).
  // FP-258 5차 보기 상태(type=text)에서 한글 자판으로 조합한 글자는 조합이 끝날 때 영문 키로 바꾼다(finishPassword).
  const passwordInput = useImeSafeFilter()(onChange, filterPassword, finishPassword)
  // FP-258 4차 값이 있을 때만 눈 버튼과 오른쪽 여백을 둔다. 보기 상태는 부모가 들고 있어 다시 치면 직전 상태로 나타난다.
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
