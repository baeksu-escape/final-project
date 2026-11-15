import { useState } from 'react'
import { Button, Card, TextInput, Toast } from '../../../common/components/index.js'
import PasswordRuleList from '../../auth/components/PasswordRuleList.jsx'
import { validateNewPassword } from '../../auth/validation.js'
import { changeAdminPassword } from '../api/adminAuthApi.js'
import { ADMIN_ERROR_CODES, adminErrorMessage } from '../adminConstants.js'
import StepUpModal from '../components/StepUpModal.jsx'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'

const EMPTY_FORM = { currentPassword: '', password: '', passwordConfirm: '' }

// FP-80 관리자 비밀번호 변경(/admin/password) — 현재·새 비밀번호를 검사한 뒤 재확인(step-up)을 거쳐 PUT /api/admin/me/password를 부른다.
// 새 비밀번호 규칙은 회원가입·마이페이지와 같은 validateNewPassword로 검사한다.
export default function AdminPasswordPage() {
  const handleAdminError = useAdminErrorHandler()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))

  // 입력을 검사하고, 통과하면 재확인 모달을 연다.
  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validateNewPassword(form.password, form.passwordConfirm)
    if (!form.currentPassword) nextErrors.currentPassword = '현재 비밀번호를 입력해 주세요.'
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length === 0) setStepUpOpen(true)
  }

  // 재확인 토큰을 받으면 그 토큰으로 한 번만 비밀번호 변경을 요청한다.
  const handleVerified = async (stepUpToken) => {
    setStepUpOpen(false)
    setPending(true)
    try {
      await changeAdminPassword({ currentPassword: form.currentPassword, newPassword: form.password }, stepUpToken)
      setForm(EMPTY_FORM)
      setToastMessage('비밀번호를 바꿨습니다.')
    } catch (saveError) {
      if (await handleAdminError(saveError)) return
      const code = saveError.data?.code
      if (code === 'INVALID_PASSWORD') setErrors({ currentPassword: saveError.message })
      else if (code === ADMIN_ERROR_CODES.INVALID_INPUT) setErrors({ password: saveError.message })
      else if (code === ADMIN_ERROR_CODES.SAME_PASSWORD) setErrors({ password: adminErrorMessage(saveError) })
      else if (code === ADMIN_ERROR_CODES.STEP_UP_REQUIRED) setFormError('재확인 시간이 지났습니다. 다시 시도해 주세요.')
      else setFormError(adminErrorMessage(saveError))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h1>비밀번호 변경</h1>
      <p>관리자 비밀번호를 바꾸려면 저장 전에 업무 이메일로 받은 번호로 본인을 한 번 더 확인합니다.</p>
      <Card>
        <form onSubmit={handleSubmit} noValidate>
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
          {formError && <p role="alert">{formError}</p>}
          <Button type="submit" variant="primary" disabled={pending}>
            비밀번호 저장
          </Button>
        </form>
      </Card>
      <StepUpModal open={stepUpOpen} purpose="비밀번호를 바꾸기 전에" onVerified={handleVerified} onClose={() => setStepUpOpen(false)} />
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </section>
  )
}
