import { useState } from 'react'
import { Button, Notice, TextInput } from '../../../common/components/index.js'
import PasswordRuleList from '../../auth/components/PasswordRuleList.jsx'
import { passwordTooLongError, validateNewPassword } from '../../auth/validation.js'
import { setupAdminPassword } from '../api/adminAuthApi.js'
import { ADMIN_ERROR_CODES, adminErrorMessage } from '../adminConstants.js'

// 설정 토큰이 만료·사용됐을 때 보여 줄 안내.
const SETUP_EXPIRED_MESSAGE = '비밀번호 설정 시간이 지났습니다. 처음부터 다시 로그인해 주세요.'

// N-27-4 관리자 첫 비밀번호 설정 — 임시 비밀번호로 들어온 관리자가 2단계 인증 뒤 새 비밀번호를 정한다(로그인 화면 안의 단계).
// passwordSetupToken은 부모의 상태에만 있고 저장하지 않는다. 성공하면 onDone(응답 { accessToken|token, user })을 부른다.
// 토큰이 만료되면 "처음부터 다시 로그인" 안내와 [처음으로]를 보여 주고, 누르면 onRestart를 부른다.
export default function AdminPasswordSetupForm({ passwordSetupToken, onDone, onRestart }) {
  const [form, setForm] = useState({ password: '', passwordConfirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [expired, setExpired] = useState(false)
  const [pending, setPending] = useState(false)

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateNewPassword(form.password, form.passwordConfirm)
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      const result = await setupAdminPassword(passwordSetupToken, form.password)
      onDone(result)
    } catch (saveError) {
      setPending(false)
      if (saveError.data?.code === ADMIN_ERROR_CODES.INVALID_INPUT) setErrors({ password: saveError.message })
      else if (saveError.data?.code === ADMIN_ERROR_CODES.SAME_PASSWORD) setErrors({ password: adminErrorMessage(saveError) })
      else if (saveError.status === 400 || saveError.status === 401) setExpired(true)
      else setFormError(adminErrorMessage(saveError))
    }
  }

  if (expired) {
    return (
      <div className="auth-form">
        <p className="auth-form__error" role="alert">
          {SETUP_EXPIRED_MESSAGE}
        </p>
        <Button variant="primary" onClick={onRestart}>
          처음으로
        </Button>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <Notice type="info">임시 비밀번호로 처음 로그인했습니다. 새 비밀번호를 정하면 관리자 화면으로 들어갑니다.</Notice>
      <TextInput
        label="새 비밀번호"
        type="password"
        value={form.password}
        onChange={update('password')}
        error={passwordTooLongError(form.password) || errors.password}
        autoComplete="new-password"
      />
      <PasswordRuleList password={form.password} />
      <TextInput
        label="새 비밀번호 확인"
        type="password"
        value={form.passwordConfirm}
        onChange={update('passwordConfirm')}
        error={errors.passwordConfirm}
        autoComplete="new-password"
      />
      {formError && (
        <p className="auth-form__error" role="alert">
          {formError}
        </p>
      )}
      {/* FP-275 64자를 넘으면 버튼을 끈다(회원 화면과 같음). */}
      <button type="submit" className="auth-form__submit" disabled={pending || passwordTooLongError(form.password) !== ''}>
        비밀번호 정하고 들어가기
      </button>
      <Button onClick={onRestart}>처음으로</Button>
    </form>
  )
}
