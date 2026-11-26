import { TextInput } from '../../../common/components/index.js'

// FP-258 2차 N-01-1 비밀번호 칸 + [보기]/[숨기기] 버튼 — 버튼을 누르면 칸의 type이 password ↔ text로 바뀐다.
// 보이는지(visible)는 부모(usePasswordReveal)가 들고 있어서 값을 고치거나 포커스가 나가도 그대로다.
// 브라우저(Edge) 기본 눈 모양은 auth.css의 .password-field 규칙으로 숨긴다. 버튼 모양은 기존 공통 클래스 그대로다(디자인은 UI 담당).
// 사용 예: <PasswordField label="비밀번호" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" {...reveal('password')} />
export default function PasswordField({ visible = false, onToggleVisible, ...inputProps }) {
  return (
    <div className="signup-form__row password-field">
      <TextInput {...inputProps} type={visible ? 'text' : 'password'} />
      <button type="button" className="button button--sm" aria-pressed={visible} aria-label="비밀번호 보기" onClick={onToggleVisible}>
        {visible ? '숨기기' : '보기'}
      </button>
    </div>
  )
}
