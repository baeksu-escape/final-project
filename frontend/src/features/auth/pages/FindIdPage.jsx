import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SegmentedControl, TextInput } from '../../../common/components/index.js'
import { requestFindId } from '../api/authFeatureApi.js'
import { EMAIL_PURPOSES, FIND_ID_METHODS, PHONE_PURPOSES } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PhoneVerification from '../components/PhoneVerification.jsx'
import SplitEmailField from '../components/SplitEmailField.jsx'
import useBlurCheck from '../useBlurCheck.js'
import useExistingEmailParts from '../useExistingEmailParts.js'
import useFindNameField from '../useFindNameField.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import { joinPhone, normalizePhone, validateName, validatePhoneParts } from '../validation.js'
import '../auth.css'

// 아이디 찾기 방법 선택지(공통 SegmentedControl).
const METHOD_OPTIONS = [
  { value: FIND_ID_METHODS.PHONE, label: '휴대폰' },
  { value: FIND_ID_METHODS.EMAIL, label: '이메일' },
]

// N-03-1 아이디 찾기 화면(FP-258) — 이름과 [휴대폰 | 이메일] 중 하나로 본인 인증(FIND_ID 목적)을 마치면 가리지 않은 아이디를 보여 준다.
// 인증코드는 가입 여부와 상관없이 보내고, 일치하는 계정이 없으면 [아이디 찾기] 때 서버가 같은 404 문구로 알린다.
export default function FindIdPage() {
  const [method, setMethod] = useState(FIND_ID_METHODS.PHONE)
  const [phoneParts, setPhoneParts] = useState({ middle: '', last: '' })
  // 인증 결과 { method, target, verificationToken } — target은 인증한 휴대폰(숫자) 또는 이메일이다.
  const [verification, setVerification] = useState(null)
  const [formError, setFormError] = useState('')
  const [loginId, setLoginId] = useState(null)
  const [pending, setPending] = useState(false)
  const nameField = useFindNameField(useImeSafeFilter())
  const { name, check: checkName } = nameField
  const emailField = useExistingEmailParts()
  const { email } = emailField

  const phone = joinPhone(phoneParts.middle, phoneParts.last)
  // FP-258 휴대폰 묶음을 벗어날 때 가입과 같은 검사 함수로 보고, 틀리면 묶음 테두리와 칸 아래 문구로 알린다.
  const phoneCheck = useBlurCheck(() => validatePhoneParts(phoneParts.middle, phoneParts.last), () => Boolean(phoneParts.middle || phoneParts.last))
  const target = method === FIND_ID_METHODS.PHONE ? normalizePhone(phone) : email
  // 방법을 바꾸거나 인증한 뒤 번호·이메일을 고치면 인증이 풀린 것으로 본다.
  const verified = verification !== null && verification.method === method && verification.target === target

  const changeMethod = (next) => {
    setMethod(next)
    setFormError('')
    setLoginId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nameError = validateName(name)
    nameField.setError(nameError)
    setFormError('')
    setLoginId(null)
    if (nameError) return
    if (!verified) {
      setFormError(method === FIND_ID_METHODS.PHONE ? '휴대폰 인증을 먼저 완료해 주세요.' : '이메일 인증을 먼저 완료해 주세요.')
      return
    }

    setPending(true)
    try {
      const result = await requestFindId({
        method,
        name: name.trim(),
        ...(method === FIND_ID_METHODS.PHONE ? { phone: target } : { email: target }),
        verificationToken: verification.verificationToken,
      })
      setLoginId(result.loginId)
      // FP-258 서버가 인증 토큰을 사용 처리했으므로 인증을 비운다. 결과는 남기고, 다시 찾으려면 [받기]부터 다시 한다.
      setVerification(null)
    } catch (error) {
      const nameError = error?.data?.fieldErrors?.find((item) => item.field === 'name')
      if (nameError) nameField.setError(nameError.message)
      else setFormError(error.message)
      // FP-258 토큰 오류(없음·만료·이미 씀)는 400이다. 다시 인증할 수 있게 비운다(계정 없음 404는 토큰이 남아 그대로 둔다).
      if (!nameError && error?.status === 400) setVerification(null)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="auth-page find-id-page">
      <h1 className="auth-page__title">아이디 찾기</h1>
      <form className="auth-form find-id-form" onSubmit={handleSubmit} noValidate>
        <SegmentedControl label="아이디 찾기 방법" options={METHOD_OPTIONS} value={method} onChange={changeMethod} />
        <div {...nameField.compositionProps} onBlur={nameField.onBlur}>
          <TextInput
            label="이름"
            value={name}
            onChange={nameField.onChange}
            error={nameField.error}
            autoComplete="name"
            hint="가입할 때 입력한 이름"
          />
        </div>
        {method === FIND_ID_METHODS.PHONE ? (
          <div onBlur={phoneCheck.onBlur}>
            <PhoneVerification
              middle={phoneParts.middle}
              last={phoneParts.last}
              onChange={setPhoneParts}
              purpose={PHONE_PURPOSES.FIND_ID}
              verified={verified}
              error={phoneCheck.error}
              beforeRequest={() => checkName()}
              onVerified={({ verificationToken }) => setVerification({ method, target, verificationToken })}
            />
          </div>
        ) : (
          <div onBlur={emailField.onBlur}>
            <SplitEmailField
              {...emailField.fieldProps}
              purpose={EMAIL_PURPOSES.FIND_ID}
              verified={verified}
              beforeRequest={() => checkName()}
              onVerified={({ verificationToken }) => setVerification({ method, target, verificationToken })}
            />
          </div>
        )}
        {formError && (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="auth-form__submit" disabled={pending || !verified}>
          아이디 찾기
        </button>
      </form>
      {loginId && (
        <div className="find-id-result" role="status">
          <p className="find-id-result__message">
            가입된 아이디는 <strong className="find-id-result__login-id">{loginId}</strong> 입니다.
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
