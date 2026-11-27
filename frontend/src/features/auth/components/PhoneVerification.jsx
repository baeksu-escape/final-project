import { useId, useRef, useState } from 'react'
import { FieldError, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { requestPhoneCode, verifyPhoneCode } from '../api/authFeatureApi.js'
import { MOCK_PHONE_CODE } from '../mocks/authMockData.js'
import { PHONE_PREFIX, joinPhone, validatePhoneParts } from '../validation.js'

// 숫자만 남기고 4자리까지 자른다(휴대폰 가운데·끝 칸).
const toFourDigits = (value) => value.replace(/\D/g, '').slice(0, 4)

// 발송·확인 흐름의 처음 상태. target은 이 상태가 가리키는 번호이고, status는 'idle'(발송 전)·'sent'(번호 보냄)·'error'(실패) 중 하나다.
// codeOpen은 인증번호를 한 번 보내서 확인 칸이 열려 있는지다(실패해도 다시 입력할 수 있게 남긴다). SplitEmailField와 같은 구조다.
const IDLE_FLOW = { target: null, status: 'idle', message: '', codeOpen: false }

// N-02 휴대폰 입력·인증(11/18 1차 시연 후속) — `010 - [가운데 4자리] - [끝 4자리] [인증번호 받기]` 한 줄과, 받은 뒤 열리는 6자리 확인 칸.
// 구조는 EmailVerification과 같다: 번호 칸 값은 부모가 갖고, 이 컴포넌트는 발송 → 코드 입력 → [확인]을 맡는다. 회원가입과 아이디 찾기(FP-258)에서 쓴다.
// 사용 예:
//   <PhoneVerification
//     middle={form.phoneMiddle} last={form.phoneLast}
//     onChange={({ middle, last }) => ...}                  // 숫자만 4자리까지 넘어온다
//     purpose={PHONE_PURPOSES.SIGNUP}
//     verified={phoneVerification?.phone === phone}          // 인증받은 번호와 지금 번호가 같을 때만 완료
//     onVerified={setPhoneVerification}                      // { phone, verificationToken }
//     error={errors.phone}
//   />
//   번호가 바뀌면 발송·코드·오류·안내를 모두 비운다(인증 상태는 부모의 verified 계산으로 풀린다).
//   FP-258 beforeRequest: [받기]·[확인] 요청 전에 부른다. false를 돌려주면 보내지 않는다(아이디·비밀번호 찾기의 이름 검사). 없으면 그대로 보낸다.
//   문구는 한 번에 하나만 보인다: 완료 / (실패 > 부모 오류 > 발송 안내).
export default function PhoneVerification({ middle, last, onChange, purpose, verified = false, onVerified, error, beforeRequest }) {
  const id = useId()
  const middleRef = useRef(null)
  const lastRef = useRef(null)
  const [flow, setFlow] = useState(IDLE_FLOW)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)

  const phone = joinPhone(middle, last)
  // 지금 번호에 대한 상태만 쓴다. 다른 번호에서 남은 안내·오류는 보이지 않는다.
  const current = flow.target === phone ? flow : IDLE_FLOW
  const canSend = !verified && !pending && validatePhoneParts(middle, last) === ''

  // 번호 칸을 고치면 발송·코드·오류·안내를 모두 비운다.
  const changePhone = (parts) => {
    setFlow(IDLE_FLOW)
    setCode('')
    onChange(parts)
  }

  // 가운데 칸을 4자리 채우면 끝 칸으로 넘어간다.
  const handleMiddleChange = (event) => {
    const next = toFourDigits(event.target.value)
    changePhone({ middle: next, last })
    if (next.length === 4 && middle.length < 4) lastRef.current?.focus()
  }

  // 끝 칸이 빈 채로 Backspace를 누르면 가운데 칸으로 돌아간다.
  const handleLastKeyDown = (event) => {
    if (event.key === 'Backspace' && last === '') middleRef.current?.focus()
  }

  const handleSend = async () => {
    if (beforeRequest && !beforeRequest()) return
    setPending(true)
    try {
      const { expiresInSeconds } = await requestPhoneCode({ phone, purpose })
      setCode('')
      setFlow({
        target: phone,
        status: 'sent',
        message: `인증번호를 보냈습니다. ${Math.ceil(expiresInSeconds / 60)}분 안에 입력해 주세요.`,
        codeOpen: true,
      })
    } catch (sendError) {
      setFlow({ ...current, target: phone, status: 'error', message: sendError.message })
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    if (beforeRequest && !beforeRequest()) return
    if (!/^\d{6}$/.test(code)) {
      setFlow({ ...current, status: 'error', message: '6자리 인증번호를 입력해 주세요.' })
      return
    }
    setPending(true)
    try {
      const { verificationToken } = await verifyPhoneCode({ phone, code, purpose })
      setFlow(IDLE_FLOW)
      setCode('')
      onVerified({ phone, verificationToken })
    } catch (verifyError) {
      setFlow({ ...current, status: 'error', message: verifyError.message })
    } finally {
      setPending(false)
    }
  }

  // 완료가 아닐 때 보일 문구 하나 — 이 칸의 실패가 먼저, 다음은 부모가 준 오류(형식·인증 필요·서버 칸 오류), 마지막이 발송 안내다.
  const renderMessage = () => {
    if (current.status === 'error') return <FieldError message={current.message} />
    if (error) return <FieldError message={error} />
    if (current.status === 'sent') {
      return (
        <p className="auth-message" role="status">
          {current.message}
        </p>
      )
    }
    return null
  }

  const invalid = error ? true : undefined
  return (
    <div className="form-field phone-verification">
      <label htmlFor={`${id}-middle`} className="form-field__label">
        휴대폰
      </label>
      <div className="signup-form__row">
        <span className="signup-form__fixed">{PHONE_PREFIX}</span>
        <span className="signup-form__fixed" aria-hidden="true">
          -
        </span>
        <input
          id={`${id}-middle`}
          ref={middleRef}
          className="text-input__control signup-form__part"
          value={middle}
          onChange={handleMiddleChange}
          placeholder="0000"
          inputMode="numeric"
          maxLength={4}
          autoComplete="tel-local-prefix"
          aria-label="휴대폰 가운데 4자리"
          aria-invalid={invalid}
        />
        <span className="signup-form__fixed" aria-hidden="true">
          -
        </span>
        <input
          ref={lastRef}
          className="text-input__control signup-form__part"
          value={last}
          onChange={(event) => changePhone({ middle, last: toFourDigits(event.target.value) })}
          onKeyDown={handleLastKeyDown}
          placeholder="0000"
          inputMode="numeric"
          maxLength={4}
          autoComplete="tel-local-suffix"
          aria-label="휴대폰 끝 4자리"
          aria-invalid={invalid}
        />
        {!verified && (
          <button type="button" className="signup-form__check" onClick={handleSend} disabled={!canSend}>
            {current.codeOpen ? '인증번호 다시 받기' : '인증번호 받기'}
          </button>
        )}
      </div>
      {verified ? (
        <p className="auth-message auth-message--success" role="status">
          휴대폰 인증이 완료되었습니다.
        </p>
      ) : (
        <>
          {current.codeOpen && (
            <>
              {USE_MOCK && <p className="phone-verification__notice">개발용 mock 인증번호: {MOCK_PHONE_CODE}</p>}
              <div className="signup-form__row">
                <TextInput
                  label="인증번호 6자리"
                  value={code}
                  onChange={(value) => setCode(value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                <button type="button" className="signup-form__check" onClick={handleVerify} disabled={pending}>
                  확인
                </button>
              </div>
            </>
          )}
          {renderMessage()}
        </>
      )}
    </div>
  )
}
