import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TextInput } from '../../../common/components/index.js'
import { requestFindId } from '../api/authFeatureApi.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import { isValidPhone, normalizePhone } from '../validation.js'

// N-03 아이디 찾기 화면 — 가입할 때 입력한 이름·휴대폰으로 계정을 찾아 일부를 가린 아이디를 보여 준다.
export default function FindIdPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [maskedLoginId, setMaskedLoginId] = useState(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!name.trim()) errors.name = '이름을 입력해 주세요.'
    if (!phone) errors.phone = '휴대폰 번호를 입력해 주세요.'
    else if (!isValidPhone(phone)) errors.phone = '휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678'
    setFieldErrors(errors)
    setFormError('')
    setMaskedLoginId(null)
    if (Object.keys(errors).length > 0) return

    setPending(true)
    try {
      const result = await requestFindId({ name: name.trim(), phone: normalizePhone(phone) })
      setMaskedLoginId(result.maskedLoginId)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="auth-page find-id-page">
      <h1 className="auth-page__title">아이디 찾기</h1>
      <form className="auth-form find-id-form" onSubmit={handleSubmit} noValidate>
        <TextInput label="이름" value={name} onChange={setName} error={fieldErrors.name} autoComplete="name" />
        <TextInput
          label="휴대폰"
          type="tel"
          value={phone}
          onChange={setPhone}
          error={fieldErrors.phone}
          autoComplete="tel"
          inputMode="numeric"
        />
        {formError && (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="auth-form__submit" disabled={pending}>
          아이디 찾기
        </button>
      </form>
      {maskedLoginId && (
        <div className="find-id-result" role="status">
          <p className="find-id-result__message">
            가입된 아이디는 <strong className="find-id-result__login-id">{maskedLoginId}</strong> 입니다.
          </p>
          <Link to={AUTH_PATHS.LOGIN} className="auth-page__primary-link">
            로그인하러 가기
          </Link>
        </div>
      )}
      <AuthLinks />
    </section>
  )
}
