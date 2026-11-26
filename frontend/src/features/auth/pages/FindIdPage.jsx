import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SegmentedControl, TextInput } from '../../../common/components/index.js'
import { requestFindId } from '../api/authFeatureApi.js'
import { EMAIL_PURPOSES, FIND_ID_METHODS, PHONE_PURPOSES } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PhoneVerification from '../components/PhoneVerification.jsx'
import SplitEmailField from '../components/SplitEmailField.jsx'
import { resolveEmailDomain } from '../emailParts.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import { filterName, joinEmail, joinPhone, normalizePhone, validateName } from '../validation.js'
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
  const [name, setName] = useState('')
  const [phoneParts, setPhoneParts] = useState({ middle: '', last: '' })
  const [emailParts, setEmailParts] = useState({ emailLocal: '', emailDomainChoice: '', emailCustomDomain: '' })
  // 인증 결과 { method, target, verificationToken } — target은 인증한 휴대폰(숫자) 또는 이메일이다.
  const [verification, setVerification] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loginId, setLoginId] = useState(null)
  const [pending, setPending] = useState(false)
  // FP-258 3차 한글 조합 중에는 거르지 않고 조합이 끝날 때 한 번 거른다(useImeSafeFilter). 공통 TextInput 대신 감싼 div가 조합 이벤트를 받는다.
  const nameInput = useImeSafeFilter()((value) => {
    setName(value)
    setFieldErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev))
  }, filterName)
  // FP-258 4차 다음 단계 요청([받기]·[확인]·[찾기]·[다음]) 전과 칸을 벗어날 때 이름을 가입과 같은 규칙(validateName)으로 본다.
  // "홍길ㄷ"처럼 자모가 남았거나 형식이 틀리면 이름 칸 아래에 오류를 보여 주고 요청을 보내지 않는다. 고치면 오류를 지운다.
  const checkName = (value = name) => {
    const nameError = validateName(value)
    setFieldErrors((prev) => ({ ...prev, name: nameError || undefined }))
    return nameError === ''
  }
  // 칸을 벗어날 때는 친 값이 있을 때만 알린다(빈 칸은 버튼을 누를 때 알린다).
  const handleNameBlur = (event) => {
    if (event.target.value) checkName(event.target.value)
  }

  const phone = joinPhone(phoneParts.middle, phoneParts.last)
  const email = joinEmail(emailParts.emailLocal, resolveEmailDomain(emailParts.emailDomainChoice, emailParts.emailCustomDomain))
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
    const errors = {}
    // FP-258 2차 이름은 가입과 같은 규칙(완성형 한글 2~20자)으로 본다. 서버도 같은 규칙으로 400(name 칸)을 준다.
    const nameError = validateName(name)
    if (nameError) errors.name = nameError
    setFieldErrors(errors)
    setFormError('')
    setLoginId(null)
    if (Object.keys(errors).length > 0) return
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
    } catch (error) {
      const nameError = error?.data?.fieldErrors?.find((item) => item.field === 'name')
      if (nameError) setFieldErrors({ name: nameError.message })
      else setFormError(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="auth-page find-id-page">
      <h1 className="auth-page__title">아이디 찾기</h1>
      <form className="auth-form find-id-form" onSubmit={handleSubmit} noValidate>
        <SegmentedControl label="아이디 찾기 방법" options={METHOD_OPTIONS} value={method} onChange={changeMethod} />
        <div {...nameInput.compositionProps} onBlur={handleNameBlur}>
          <TextInput
            label="이름"
            value={name}
            onChange={nameInput.onChange}
            error={fieldErrors.name}
            autoComplete="name"
            hint="가입할 때 입력한 이름"
          />
        </div>
        {method === FIND_ID_METHODS.PHONE ? (
          <PhoneVerification
            middle={phoneParts.middle}
            last={phoneParts.last}
            onChange={setPhoneParts}
            purpose={PHONE_PURPOSES.FIND_ID}
            verified={verified}
            beforeRequest={() => checkName()}
            onVerified={({ verificationToken }) => setVerification({ method, target, verificationToken })}
          />
        ) : (
          <SplitEmailField
            local={emailParts.emailLocal}
            domainChoice={emailParts.emailDomainChoice}
            customDomain={emailParts.emailCustomDomain}
            onChange={(patch) => setEmailParts((prev) => ({ ...prev, ...patch }))}
            purpose={EMAIL_PURPOSES.FIND_ID}
            verified={verified}
            beforeRequest={() => checkName()}
            onVerified={({ verificationToken }) => setVerification({ method, target, verificationToken })}
          />
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
