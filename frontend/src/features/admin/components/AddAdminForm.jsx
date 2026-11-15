import { useState } from 'react'
import { Button, TextInput } from '../../../common/components/index.js'
import { isValidEmail } from '../../auth/validation.js'
import { createAdminAccount } from '../api/adminApi.js'
import { ADMIN_ERROR_CODES, ADMIN_LOGIN_ID_PATTERN, ADMIN_LOGIN_ID_RULE_TEXT, adminErrorMessage } from '../adminConstants.js'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'
import StepUpModal from './StepUpModal.jsx'
import TemporaryPasswordModal from './TemporaryPasswordModal.jsx'

const EMPTY_FORM = { loginId: '', name: '', workEmail: '' }

// 서버 칸별 오류 [{ field, message }]를 { 칸 이름: 문구 }로 바꾼다. 칸 이름(loginId·name·workEmail)은 요청 필드와 같다.
function toFieldErrors(fieldErrors = []) {
  return Object.fromEntries(fieldErrors.map(({ field, message }) => [field, message]))
}

// N-27-4 관리자 계정 추가 — 아이디·이름·업무 이메일을 검사한 뒤 재확인(step-up)을 거쳐 ADM-07을 부른다.
// 성공하면 임시 비밀번호를 모달로 한 번만 보여 주고, 닫으면 값을 지운다. onCreated는 목록을 다시 부를 때 쓴다.
export default function AddAdminForm({ onCreated }) {
  const handleAdminError = useAdminErrorHandler()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [pending, setPending] = useState(false)
  // 방금 만든 계정 { loginId, temporaryPassword }. 모달을 닫으면 null로 지운다.
  const [created, setCreated] = useState(null)

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }))

  // 입력을 검사하고, 통과하면 재확인 모달을 연다.
  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!ADMIN_LOGIN_ID_PATTERN.test(form.loginId.trim())) nextErrors.loginId = `아이디는 ${ADMIN_LOGIN_ID_RULE_TEXT}로 넣어 주세요.`
    if (!form.name.trim()) nextErrors.name = '이름을 넣어 주세요.'
    if (!isValidEmail(form.workEmail.trim())) nextErrors.workEmail = '업무 이메일 형식이 올바르지 않습니다. 예) name@avenue.example'
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length === 0) setStepUpOpen(true)
  }

  // 재확인 토큰을 받으면 그 토큰으로 한 번만 계정 추가를 요청한다.
  const handleVerified = async (stepUpToken) => {
    setStepUpOpen(false)
    setPending(true)
    try {
      const result = await createAdminAccount(
        { loginId: form.loginId.trim(), name: form.name.trim(), workEmail: form.workEmail.trim() },
        stepUpToken,
      )
      setForm(EMPTY_FORM)
      setCreated({ loginId: result.loginId, temporaryPassword: result.temporaryPassword })
      onCreated?.()
    } catch (saveError) {
      if (await handleAdminError(saveError)) return
      if (saveError.data?.code === ADMIN_ERROR_CODES.INVALID_INPUT) setErrors(toFieldErrors(saveError.data.fieldErrors))
      else if (saveError.data?.code === ADMIN_ERROR_CODES.STEP_UP_REQUIRED) setFormError('재확인 시간이 지났습니다. 다시 시도해 주세요.')
      else setFormError(adminErrorMessage(saveError))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          label="아이디"
          value={form.loginId}
          onChange={update('loginId')}
          error={errors.loginId}
          hint={`${ADMIN_LOGIN_ID_RULE_TEXT}. 예) admin_park`}
          autoComplete="off"
        />
        <TextInput label="이름" value={form.name} onChange={update('name')} error={errors.name} autoComplete="off" />
        <TextInput
          label="업무 이메일"
          type="email"
          value={form.workEmail}
          onChange={update('workEmail')}
          error={errors.workEmail}
          placeholder="name@avenue.example"
          autoComplete="off"
        />
        {formError && <p role="alert">{formError}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          관리자 계정 만들기
        </Button>
      </form>
      <StepUpModal open={stepUpOpen} purpose="관리자 계정을 만들기 전에" onVerified={handleVerified} onClose={() => setStepUpOpen(false)} />
      <TemporaryPasswordModal result={created} onClose={() => setCreated(null)} />
    </>
  )
}
