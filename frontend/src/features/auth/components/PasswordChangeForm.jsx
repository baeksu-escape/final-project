import { useState } from 'react'
import { TextInput } from '../../../common/components/index.js'
import { requestPasswordChange } from '../api/myPageApi.js'
import { validateNewPassword } from '../validation.js'
import PasswordRuleList from './PasswordRuleList.jsx'

// N-04-3 비밀번호 바꾸기 폼 — 현재 비밀번호와 새 비밀번호를 받는다. 새 비밀번호 규칙은 FP-87 가입과 같은 validateNewPassword로 검사한다.
// 저장에 성공하면 onSaved(안내 문구)를 부르고, [취소]는 onCancel을 부른다.
export default function PasswordChangeForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ currentPassword: '', password: '', passwordConfirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  // 항목 하나를 바꾸는 함수를 만든다.
  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))

  // 입력을 검사한 뒤 저장을 요청한다. 현재 비밀번호가 틀리면 서버 안내를 그대로 보여 준다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateNewPassword(form.password, form.passwordConfirm)
    if (!form.currentPassword) nextErrors.currentPassword = '현재 비밀번호를 입력해 주세요.'
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      await requestPasswordChange({ currentPassword: form.currentPassword, newPassword: form.password })
      onSaved('비밀번호를 바꿨습니다.')
    } catch (saveError) {
      setFormError(saveError.message)
      setPending(false)
    }
  }

  return (
    <form className="account-form password-change-form" onSubmit={handleSubmit} noValidate>
      <TextInput
        label="현재 비밀번호"
        type="password"
        value={form.currentPassword}
        onChange={update('currentPassword')}
        error={errors.currentPassword}
        autoComplete="current-password"
      />
      <TextInput
        label="새 비밀번호"
        type="password"
        value={form.password}
        onChange={update('password')}
        error={errors.password}
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
        <p className="account-form__error" role="alert">
          {formError}
        </p>
      )}
      <button type="submit" className="account-form__submit" disabled={pending}>
        비밀번호 저장
      </button>
      <button type="button" className="account-form__cancel" onClick={onCancel}>
        취소
      </button>
    </form>
  )
}
