import { PASSWORD_RULES } from '../validation.js'

// N-02 비밀번호 규칙 표시 — 입력하는 동안 규칙마다 충족 여부를 글자로 보여 준다(가입·비밀번호 재설정 화면에서 사용).
// FP-259 12차 listed: false인 규칙(64자 이하)은 목록에 보이지 않는다 — 넘으면 칸 오류(passwordTooLongError)로 알린다.
// 사용 예: <PasswordRuleList password={form.password} />
export default function PasswordRuleList({ password }) {
  return (
    <ul className="password-rules" aria-label="비밀번호 규칙">
      {PASSWORD_RULES.filter((rule) => rule.listed !== false).map((rule) => {
        const met = rule.test(password ?? '')
        return (
          <li key={rule.key} className={met ? 'password-rules__item password-rules__item--met' : 'password-rules__item'}>
            {rule.label}: {met ? '충족' : '미충족'}
          </li>
        )
      })}
    </ul>
  )
}
