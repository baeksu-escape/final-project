import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { PATHS } from '../../../common/config/navigation.js'
import { Checkbox, DateSelect, FieldError, TextInput } from '../../../common/components/index.js'
import { checkLoginIdAvailability, checkNicknameAvailability, requestSignup } from '../api/authFeatureApi.js'
import { AUTH_ERROR_CODES, EMAIL_PURPOSES, PHONE_PURPOSES, SIGNUP_CONSENT_ITEMS, toAgeGroup } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PasswordField from '../components/PasswordField.jsx'
import PasswordRuleList from '../components/PasswordRuleList.jsx'
import PhoneVerification from '../components/PhoneVerification.jsx'
import SplitEmailField from '../components/SplitEmailField.jsx'
import { resolveEmailDomain, splitEmail } from '../emailParts.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import usePasswordReveal from '../usePasswordReveal.js'
import {
  NICKNAME_MAX,
  SIGNUP_PENDING_MESSAGES,
  filterName,
  filterNickname,
  filterSignupLoginId,
  joinEmail,
  joinPhone,
  normalizePhone,
  validateLoginId,
  validateNickname,
  validateSignup,
} from '../validation.js'
import '../auth.css'

// 가입 화면 입력값의 처음 상태. 휴대폰은 010 뒤 가운데·끝 4자리, 이메일은 앞부분 + 도메인(선택 또는 직접 입력), 생일은 'YYYY-MM-DD'.
const EMPTY_FORM = {
  loginId: '',
  name: '',
  nickname: '',
  phoneMiddle: '',
  phoneLast: '',
  emailLocal: '',
  emailDomainChoice: '',
  emailCustomDomain: '',
  password: '',
  passwordConfirm: '',
  birthDate: '',
  // FP-258 13차 N-02-2 필수 동의 2개(이용약관·개인정보 수집·이용)와 선택 동의 1개(점수 변동 알림·혜택 안내)
  agreeTerms: false,
  agreePrivacy: false,
  agreeMarketing: false,
}

// 칸 순서(validateSignup 오류 키). [가입하기]에서 오류가 있으면 이 순서로 첫 오류 칸을 찾아 옮겨 간다.
const FIELD_ORDER = ['loginId', 'name', 'nickname', 'phone', 'email', 'password', 'passwordConfirm', 'birthDate', 'agreements']
// 폼 값 키 → 검사 오류 키(휴대폰·이메일은 여러 칸이 오류 하나를 같이 쓴다).
const ERROR_KEY_OF = {
  phoneMiddle: 'phone',
  phoneLast: 'phone',
  emailLocal: 'email',
  emailDomainChoice: 'email',
  emailCustomDomain: 'email',
}
// 서버 칸별 오류 field → 화면 오류 키. 서버는 생일 대신 출생연도(birthYear)로 검사한다.
// FP-258 13차 필수 동의 칸 오류(agreeTerms·agreePrivacy, 예전 agreeCreditInfo)는 동의 묶음(agreements) 아래에 보인다.
const SERVER_FIELD_KEY = { birthYear: 'birthDate', agreeTerms: 'agreements', agreePrivacy: 'agreements', agreeCreditInfo: 'agreements' }

// 칸을 감싸는 요소의 id. 첫 오류 칸으로 옮겨 갈 때 이 id로 찾는다.
const fieldWrapperId = (key) => `signup-field-${key}`

// 단계형 가입(토스 방식) — 한 화면에 한 가지 일. 제목은 질문형 두 줄, 칸은 그 단계에 필요한 것만.
// fields는 검사 오류 키(FIELD_ORDER와 같은 이름)이고, [다음]은 그 단계 칸만 검사한다. 가입 요청은 마지막 단계에서 한 번만 보낸다.
const SIGNUP_STEPS = [
  { key: 'terms', title: ['Avenue를 시작하려면', '동의가 필요해요'], fields: ['agreements'], next: '동의하고 시작하기' },
  { key: 'identity', title: ['본인 확인을 위해', '휴대폰 인증을 시작할게요'], fields: ['name', 'birthDate', 'phone'], next: '다음' },
  { key: 'email', title: ['계정 안내를 받을', '이메일을 인증해 주세요'], fields: ['email'], next: '다음' },
  { key: 'account', title: ['로그인에 사용할', '아이디와 닉네임을 정해 주세요'], fields: ['loginId', 'nickname'], next: '다음' },
  { key: 'password', title: ['로그인에 사용할', '비밀번호를 입력해 주세요'], fields: ['password', 'passwordConfirm'], next: '가입하기' },
]
const stepIndexOf = (key) => SIGNUP_STEPS.findIndex((item) => item.fields.includes(key))

// N-02 회원가입 화면 — 형식 검사·아이디·닉네임 중복 확인·휴대폰 인증·이메일 인증·필수 동의를 거쳐 계정을 만든다. 직군은 가입 후 직군 선택 화면(FP-85)에서 받는다.
// 11/18 1차 시연 후속: 칸마다 한 번 입력했거나 칸을 벗어난 뒤부터 입력할 때마다 검사해 칸 아래에 바로 보여 준다(손대지 않은 칸은 [가입하기] 전까지 조용하다).
//   중복 확인·인증을 아직 안 했다는 문구(SIGNUP_PENDING_MESSAGES)는 [가입하기]를 누른 뒤에만 보인다.
export default function SignupPage() {
  // N-01-6 소셜 계정으로 새로 가입하면 화면 이동 상태로 이름·이메일·임시 연결 키를 받는다. 칸은 사용자가 고칠 수 있고, 인증은 그대로 거친다.
  // 미리 채운 칸은 처음부터 검사 문구를 보여 준다(예: 영문 이름이면 한글로 고쳐 쓰라는 안내). 값을 자동으로 바꾸지는 않는다.
  const socialSignup = useLocation().state?.socialSignup
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: socialSignup?.name ?? '',
    ...(socialSignup?.email ? splitEmail(socialSignup.email) : {}),
  }))
  const [touched, setTouched] = useState(() => ({ name: Boolean(socialSignup?.name), email: Boolean(socialSignup?.email) }))
  const [emailVerification, setEmailVerification] = useState(null)
  const [phoneVerification, setPhoneVerification] = useState(null)
  // 닉네임 중복 확인 결과 { nickname, available }. 닉네임을 고치면 nickname이 달라져 확인이 풀린 것으로 본다.
  const [nicknameCheck, setNicknameCheck] = useState(null)
  const [nicknameCheckError, setNicknameCheckError] = useState('')
  const [nicknameChecking, setNicknameChecking] = useState(false)
  // FP-258 12차 아이디 중복 확인 결과 { loginId, available }. 닉네임과 같이 아이디를 고치면 확인이 풀린 것으로 본다.
  const [loginIdCheck, setLoginIdCheck] = useState(null)
  const [loginIdCheckError, setLoginIdCheckError] = useState('')
  const [loginIdChecking, setLoginIdChecking] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)
  // 지금 단계(0부터)와, [다음]을 눌러 오류를 보여 주기로 한 칸들(검사 문구는 손댄 칸이거나 [다음]·[가입하기]를 누른 칸에만 보인다)
  const [step, setStep] = useState(0)
  const [shownKeys, setShownKeys] = useState([])
  // 단계를 옮길 때 포커스를 줄 칸(없으면 그 단계 첫 입력)
  const [focusKey, setFocusKey] = useState(null)
  // FP-258 13차 [보기]로 펼친 동의 항목(약관 전문 자리)
  const [openConsent, setOpenConsent] = useState(null)
  // FP-258 비밀번호 보기·숨기기는 칸마다 따로 바뀐다(usePasswordReveal). 실패하면 보기 상태를 그대로 둔다.
  const { reveal, hideAll } = usePasswordReveal()
  const bindFilter = useImeSafeFilter()

  const email = joinEmail(form.emailLocal, resolveEmailDomain(form.emailDomainChoice, form.emailCustomDomain))
  const phone = joinPhone(form.phoneMiddle, form.phoneLast)
  const nickname = form.nickname.trim()
  const emailVerified = emailVerification !== null && emailVerification.email === email
  const phoneVerified = phoneVerification !== null && phoneVerification.phone === phone
  const nicknameChecked = nicknameCheck?.nickname === nickname && nicknameCheck.available
  const nicknameTaken = nicknameCheck?.nickname === nickname && !nicknameCheck.available
  const loginIdChecked = loginIdCheck?.loginId === form.loginId && loginIdCheck.available
  const loginIdTaken = loginIdCheck?.loginId === form.loginId && !loginIdCheck.available
  const checkContext = { emailVerified, phoneVerified, nicknameChecked, loginIdChecked }
  const validation = validateSignup(
    { ...form, emailDomain: resolveEmailDomain(form.emailDomainChoice, form.emailCustomDomain) },
    checkContext,
  )

  // 칸 하나에 보여 줄 오류. 서버 오류(중복 등)가 먼저이고, 검사 오류는 손댄 칸이거나 [가입하기]를 누른 뒤에만 보인다.
  const errorOf = (key) => {
    if (serverErrors[key]) return serverErrors[key]
    if (key === 'nickname' && nicknameTaken) return '이미 사용 중인 닉네임입니다.'
    if (key === 'loginId' && loginIdTaken) return '이미 사용 중인 아이디입니다.'
    const forced = submitted || shownKeys.includes(key)
    if (!touched[key] && !forced) return ''
    const message = validation[key] ?? ''
    if (!forced && message === SIGNUP_PENDING_MESSAGES[key]) return ''
    return message
  }

  const markTouched = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))

  // 칸 값을 바꾼다. 값이 비어 있지 않으면 손댄 칸으로 표시하고, 그 칸의 서버 오류(중복 등)는 지워서 형식 검사 오류를 가리지 않게 한다.
  const patchForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    Object.entries(patch).forEach(([field, value]) => {
      const key = ERROR_KEY_OF[field] ?? field
      if (value !== '' && value !== false) markTouched(key)
      setServerErrors((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    })
  }
  const update = (field) => (value) => patchForm({ [field]: value })
  // FP-258 칸별 걸러내기(validation.js)를 거친 값만 넣는다(한글 조합은 끝날 때, useImeSafeFilter).
  const filteredInput = (field, filter) => bindFilter((value) => patchForm({ [field]: value }), filter)
  // 아이디를 고치면 지난 [중복 확인]의 요청 오류(형식 400 등)도 지운다.
  const loginIdInput = bindFilter((value) => {
    setLoginIdCheckError('')
    patchForm({ loginId: value })
  }, filterSignupLoginId)
  const nameInput = filteredInput('name', filterName)
  const nicknameInput = filteredInput('nickname', filterNickname)

  // 칸을 감싼 요소. 안쪽 입력에서 포커스가 빠져나가면(blur는 감싼 요소까지 올라온다) 손댄 칸으로 표시한다.
  const fieldProps = (key) => ({ id: fieldWrapperId(key), onBlur: () => markTouched(key) })

  // 오류가 있는 첫 칸의 단계로 옮기고, 그려진 뒤 그 칸에 포커스를 준다
  const moveToFirstError = (errors) => {
    const key = FIELD_ORDER.find((item) => errors[item])
    if (!key) return
    setStep(Math.max(0, stepIndexOf(key)))
    setFocusKey(key)
  }

  useEffect(() => {
    const wrapper = focusKey ? document.getElementById(fieldWrapperId(focusKey)) : document.querySelector('.signup-form')
    wrapper?.querySelector('input:not([disabled]), select, button:not([type="submit"])')?.focus()
  }, [step, focusKey])

  // [이전] — 검사 없이 앞 단계로
  const handlePrev = () => {
    setFormError('')
    setFocusKey(null)
    setStep((prev) => Math.max(0, prev - 1))
  }

  // N-02-1 [중복 확인] — 형식 검사를 통과한 닉네임만 서버에 묻는다. 결과는 그 닉네임에만 유효하다.
  const handleNicknameCheck = async () => {
    setNicknameChecking(true)
    setNicknameCheckError('')
    try {
      const { available } = await checkNicknameAvailability(nickname)
      setNicknameCheck({ nickname, available })
    } catch (error) {
      setNicknameCheck(null)
      setNicknameCheckError(error.message)
    } finally {
      setNicknameChecking(false)
    }
  }

  // FP-258 12차 N-02-1 아이디 [중복 확인](AUTH-16) — 닉네임과 같이 형식이 맞는 아이디만 서버에 묻고, 결과는 그 아이디에만 유효하다.
  const handleLoginIdCheck = async () => {
    const loginId = form.loginId
    setLoginIdChecking(true)
    setLoginIdCheckError('')
    try {
      const { available } = await checkLoginIdAvailability(loginId)
      setLoginIdCheck({ loginId, available })
    } catch (error) {
      setLoginIdCheck(null)
      setLoginIdCheckError(error.message)
    } finally {
      setLoginIdChecking(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    // 마지막 단계 전에는 이 단계 칸만 검사하고 다음 단계로 넘어간다
    if (step < SIGNUP_STEPS.length - 1) {
      const keys = SIGNUP_STEPS[step].fields
      setShownKeys((prev) => [...new Set([...prev, ...keys])])
      const stepErrors = Object.fromEntries(keys.filter((key) => validation[key]).map((key) => [key, validation[key]]))
      if (Object.keys(stepErrors).length > 0) {
        moveToFirstError(stepErrors)
        return
      }
      setFocusKey(null)
      setStep(step + 1)
      return
    }
    setSubmitted(true)
    if (Object.keys(validation).length > 0) {
      moveToFirstError(validation)
      return
    }

    const birthYear = Number(form.birthDate.slice(0, 4))
    setPending(true)
    try {
      await requestSignup({
        loginId: form.loginId,
        name: form.name.trim(),
        nickname,
        phone: normalizePhone(phone),
        email,
        password: form.password,
        birthYear,
        ageGroup: toAgeGroup(birthYear),
        agreeTerms: form.agreeTerms,
        agreePrivacy: form.agreePrivacy,
        agreeMarketing: form.agreeMarketing,
        emailVerificationToken: emailVerification.verificationToken,
        phoneVerificationToken: phoneVerification.verificationToken,
        ...(socialSignup?.linkKey ? { socialLinkKey: socialSignup.linkKey } : {}),
      })
      // FP-258 가입이 성공했으니 자동 로그인·화면 이동 전에 비밀번호를 가린다.
      hideAll()
      // 가입하자마자 같은 아이디·비밀번호로 로그인해 직군 선택(가입 여정 2단계)으로 보낸다. 소셜 가입은 비밀번호 로그인 대상이 아니라 완료 화면을 그대로 보여 준다.
      if (!socialSignup?.linkKey) {
        try {
          await login(form.loginId, form.password)
          // 가입 여정 2단계(직군 선택)로 바로 이어 간다
          navigate(PATHS.SELECT_JOB, { replace: true })
          return
        } catch {
          // 자동 로그인이 안 되면 완료 화면의 [로그인하러 가기]로 직접 로그인하게 한다
        }
      }
      setCompleted(true)
    } catch (error) {
      const code = error?.data?.code
      const fieldErrors = error?.data?.fieldErrors
      let nextErrors = null
      if (code === AUTH_ERROR_CODES.DUPLICATE_LOGIN_ID) {
        // FP-258 12차 확인한 뒤 다른 사람이 같은 아이디로 먼저 가입한 경우 — 닉네임처럼 확인 결과를 풀어 다시 확인하게 한다.
        setLoginIdCheck(null)
        nextErrors = { loginId: error.message }
      } else if (code === AUTH_ERROR_CODES.DUPLICATE_EMAIL) nextErrors = { email: error.message }
      else if (code === AUTH_ERROR_CODES.DUPLICATE_NICKNAME) {
        // 확인한 뒤 다른 사람이 같은 닉네임으로 먼저 가입한 경우 — 확인 결과도 풀어서 다시 확인하게 한다.
        setNicknameCheck(null)
        nextErrors = { nickname: error.message }
      }
      // 서버가 칸별 오류(fieldErrors [{ field, message }])를 주면 그 칸 아래에 보여 준다(예: 출생연도 → 생일 칸).
      else if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        nextErrors = Object.fromEntries(fieldErrors.map(({ field, message }) => [SERVER_FIELD_KEY[field] ?? field, message]))
      } else setFormError(error.message)
      if (nextErrors) {
        // 휴대폰·이메일 칸 오류(인증 토큰 만료 등)면 그 인증 결과를 비워서, 완료 문구 대신 오류와 [받기] 버튼이 보이게 한다.
        if (nextErrors.phone) setPhoneVerification(null)
        if (nextErrors.email) setEmailVerification(null)
        setServerErrors(nextErrors)
        moveToFirstError(nextErrors)
      }
    } finally {
      setPending(false)
    }
  }

  const current = SIGNUP_STEPS[step]
  const last = step === SIGNUP_STEPS.length - 1
  // 이 단계 칸을 다 채우고 검사·인증·중복 확인까지 통과해야 버튼이 켜진다(마지막 단계는 전체 검사)
  const stepReady = last ? Object.keys(validation).length === 0 : current.fields.every((key) => !validation[key])

  // 단계 칸 하나를 그린다(칸 모양·검사·인증은 예전 한 화면 가입과 같다)
  const renderField = (key) => {
    switch (key) {
      case 'agreements': {
        const allAgreed = SIGNUP_CONSENT_ITEMS.every((item) => form[item.key])
        return (
          <>
            {/* FP-258 13차 N-02-2 가입 동의 — [전체 동의] + 필수 2·선택 1. 필수 둘을 모두 체크해야 [동의하고 시작하기]가 켜진다.
                칸을 오가는 중에는 안내를 띄우지 않으려고 손댄 칸 표시(onBlur)를 달지 않는다. 약관 전문은 아직 없어 [보기]는 자리만 있다. */}
            <div id={fieldWrapperId('agreements')} className="signup-consent">
              <div className="signup-consent__all">
                <Checkbox
                  label="전체 동의"
                  checked={allAgreed}
                  onChange={(checked) => patchForm(Object.fromEntries(SIGNUP_CONSENT_ITEMS.map((item) => [item.key, checked])))}
                />
              </div>
              {SIGNUP_CONSENT_ITEMS.map((item) => (
                <div key={item.key} className="signup-consent__item">
                  <div className="signup-consent__row">
                    <Checkbox label={item.label} checked={form[item.key]} onChange={update(item.key)} />
                    <button
                      type="button"
                      className="signup-consent__view"
                      aria-expanded={openConsent === item.key}
                      onClick={() => setOpenConsent((prev) => (prev === item.key ? null : item.key))}
                    >
                      보기
                    </button>
                  </div>
                  {openConsent === item.key && <p className="form-field__hint">약관 전문은 준비 중입니다.</p>}
                </div>
              ))}
              <FieldError message={errorOf('agreements')} />
            </div>
          </>
        )
      }
      case 'name':
        return (
          <>
            <div {...fieldProps('name')} {...nameInput.compositionProps}>
              <TextInput
                label="이름"
                value={form.name}
                onChange={nameInput.onChange}
                error={errorOf('name')}
                placeholder="한글 이름"
                autoComplete="name"
                maxLength={20}
              />
            </div>
          </>
        )
      case 'birthDate':
        return (
          <>
            {/* N-02-1 생일 — 연·월·일을 숫자로 직접 입력한다. 서버에는 연도(birthYear)만 보내고 월·일은 저장하지 않는다. */}
            <div {...fieldProps('birthDate')}>
              <DateSelect
                label="생일"
                parts="ymd"
                value={form.birthDate}
                onChange={update('birthDate')}
                hint="연령대별 비교 기준을 정하는 데 씁니다."
                error={errorOf('birthDate')}
              />
            </div>
          </>
        )
      case 'phone':
        return (
          <>
            <div {...fieldProps('phone')}>
              <PhoneVerification
                middle={form.phoneMiddle}
                last={form.phoneLast}
                onChange={({ middle, last }) => patchForm({ phoneMiddle: middle, phoneLast: last })}
                purpose={PHONE_PURPOSES.SIGNUP}
                verified={phoneVerified}
                onVerified={setPhoneVerification}
                error={errorOf('phone')}
              />
            </div>
          </>
        )
      case 'email':
        return (
          <>
            <div {...fieldProps('email')}>
              <SplitEmailField
                local={form.emailLocal}
                domainChoice={form.emailDomainChoice}
                customDomain={form.emailCustomDomain}
                onChange={patchForm}
                purpose={EMAIL_PURPOSES.SIGNUP}
                verified={emailVerified}
                onVerified={setEmailVerification}
                error={errorOf('email')}
              />
            </div>
          </>
        )
      case 'loginId':
        return (
          <>
            {/* FP-258 12차 N-02-1 아이디 — 닉네임과 같은 [중복 확인](AUTH-16). 형식이 맞을 때만 눌리고, 중복이면 칸 테두리와 칸 아래 문구로 알린다. */}
            <div {...fieldProps('loginId')} {...loginIdInput.compositionProps} className="auth-field">
              <div className="signup-form__row">
                <TextInput
                  label="아이디"
                  value={form.loginId}
                  onChange={loginIdInput.onChange}
                  error={errorOf('loginId') || loginIdCheckError}
                  placeholder="영문 소문자로 시작, 4~20자"
                  autoComplete="username"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="signup-form__check"
                  onClick={handleLoginIdCheck}
                  disabled={loginIdChecking || validateLoginId(form.loginId) !== ''}
                >
                  중복 확인
                </button>
              </div>
              {loginIdChecked && (
                <p className="auth-message auth-message--success" role="status">
                  사용할 수 있는 아이디입니다.
                </p>
              )}
            </div>
          </>
        )
      case 'nickname':
        return (
          <>
            {/* N-02-1 닉네임 — 한글·영문·숫자 2~7자(DDL 2~12자보다 좁게, 새 가입에만), 중복 불가. [중복 확인]은 형식이 맞을 때만 눌린다. 가입할 때 서버가 한 번 더 막는다. */}
            {/* auth-field: 칸 밖의 성공·오류 문구가 TextInput 안 오류와 같은 간격(5px)에 놓이게 묶는다. */}
            <div {...fieldProps('nickname')} {...nicknameInput.compositionProps} className="auth-field">
              <div className="signup-form__row">
                <TextInput
                  label="닉네임"
                  value={form.nickname}
                  onChange={nicknameInput.onChange}
                  placeholder={`2~${NICKNAME_MAX}자`}
                  autoComplete="nickname"
                  maxLength={NICKNAME_MAX}
                />
                <button
                  type="button"
                  className="signup-form__check"
                  onClick={handleNicknameCheck}
                  disabled={nicknameChecking || validateNickname(form.nickname) !== ''}
                >
                  중복 확인
                </button>
              </div>
              <p className="form-field__hint">한글·영문·숫자, 신용 라운지에 작성자로 보입니다</p>
              {nicknameChecked && (
                <p className="auth-message auth-message--success" role="status">
                  사용할 수 있는 닉네임입니다.
                </p>
              )}
              <FieldError message={errorOf('nickname')} />
              <FieldError message={nicknameCheckError} />
            </div>
          </>
        )
      case 'password':
        return (
          <>
            <div {...fieldProps('password')}>
              <PasswordField
                label="비밀번호"
                rule="new"
                value={form.password}
                onChange={update('password')}
                error={errorOf('password')}
                placeholder="비밀번호"
                autoComplete="new-password"
                {...reveal('password')}
              />
            </div>
            <PasswordRuleList password={form.password} />
          </>
        )
      case 'passwordConfirm':
        return (
          <>
            <div {...fieldProps('passwordConfirm')} className="auth-field">
              <PasswordField
                label="비밀번호 확인"
                rule="new"
                value={form.passwordConfirm}
                onChange={update('passwordConfirm')}
                error={errorOf('passwordConfirm')}
                placeholder="비밀번호 다시 입력"
                autoComplete="new-password"
                {...reveal('passwordConfirm')}
              />
              {form.passwordConfirm && form.password === form.passwordConfirm && (
                <p className="auth-message auth-message--success" role="status">
                  비밀번호가 일치합니다.
                </p>
              )}
            </div>
          </>
        )
      default:
        return null
    }
  }

  if (completed) {
    return (
      <section className="auth-page signup-page signup-page--completed">
        <h1 className="auth-page__title">회원가입 완료</h1>
        <p className="auth-page__message" role="status">
          가입이 완료되었습니다. 로그인한 뒤 직군을 선택해 주세요.
        </p>
        <Link to={AUTH_PATHS.LOGIN} className="auth-page__primary-link">
          로그인하러 가기
        </Link>
      </section>
    )
  }

  return (
    <section className="auth-page signup-page">
      <header className="signup-page__head step-head">
        <div className="step-head__nav">
          {step > 0 ? (
            <button type="button" className="step-head__back" onClick={handlePrev}>
              ← 이전
            </button>
          ) : (
            <span />
          )}
          <span className="step-head__count" aria-label={`회원가입 ${SIGNUP_STEPS.length}단계 중 ${step + 1}단계`}>
            {step + 1} / {SIGNUP_STEPS.length}
          </span>
        </div>
        <h1 className="step-head__title">
          {current.title[0]}
          <br />
          {current.title[1]}
        </h1>
      </header>
      <form className="auth-form signup-form" onSubmit={handleSubmit} noValidate>
        {current.fields.map((key) => (
          <div key={key} className="signup-form__slot">
            {renderField(key)}
          </div>
        ))}
        {formError && (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="auth-form__submit" disabled={pending || !stepReady}>
          {last && pending ? '가입 처리 중…' : current.next}
        </button>
      </form>
      {step === 0 && <AuthLinks />}
    </section>
  )
}
