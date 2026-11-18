import { useId, useRef, useState } from 'react'
import { FieldError, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { requestPhoneCode, verifyPhoneCode } from '../api/authFeatureApi.js'
import { MOCK_PHONE_CODE } from '../mocks/authMockData.js'
import { PHONE_PREFIX, joinPhone, validatePhoneParts } from '../validation.js'

// 숫자만 남기고 4자리까지 자른다(휴대폰 가운데·끝 칸).
const toFourDigits = (value) => value.replace(/\D/g, '').slice(0, 4)

// N-02 휴대폰 입력·인증(11/18 1차 시연 후속) — `010 - [가운데 4자리] - [끝 4자리] [인증번호 받기]` 한 줄과, 받은 뒤 열리는 6자리 확인 칸.
// 구조는 EmailVerification과 같다: 번호 칸 값은 부모가 갖고, 이 컴포넌트는 발송 → 코드 입력 → [확인]을 맡는다. 회원가입에서만 쓴다.
// 사용 예:
//   <PhoneVerification
//     middle={form.phoneMiddle} last={form.phoneLast}
//     onChange={({ middle, last }) => ...}                  // 숫자만 4자리까지 넘어온다
//     purpose={PHONE_PURPOSES.SIGNUP}
//     verified={phoneVerification?.phone === phone}          // 인증받은 번호와 지금 번호가 같을 때만 완료
//     onVerified={setPhoneVerification}                      // { phone, verificationToken }
//     error={errors.phone}
//   />
//   번호가 바뀌면 발송 전 상태로 돌아간다(인증 상태는 부모의 verified 계산으로 풀린다).
export default function PhoneVerification({ middle, last, onChange, purpose, verified = false, onVerified, error }) {
  const id = useId()
  const middleRef = useRef(null)
  const lastRef = useRef(null)
  const [sentTo, setSentTo] = useState(null)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState(false)

  const phone = joinPhone(middle, last)
  const sent = sentTo !== null && sentTo === phone
  const canSend = !verified && !pending && validatePhoneParts(middle, last) === ''

  // 가운데 칸을 4자리 채우면 끝 칸으로 넘어간다.
  const handleMiddleChange = (event) => {
    const next = toFourDigits(event.target.value)
    onChange({ middle: next, last })
    if (next.length === 4 && middle.length < 4) lastRef.current?.focus()
  }

  // 끝 칸이 빈 채로 Backspace를 누르면 가운데 칸으로 돌아간다.
  const handleLastKeyDown = (event) => {
    if (event.key === 'Backspace' && last === '') middleRef.current?.focus()
  }

  const handleSend = async () => {
    setPending(true)
    setActionError('')
    setNotice('')
    try {
      const { expiresInSeconds } = await requestPhoneCode({ phone, purpose })
      setSentTo(phone)
      setCode('')
      setNotice(`인증번호를 보냈습니다. ${Math.ceil(expiresInSeconds / 60)}분 안에 입력해 주세요.`)
    } catch (sendError) {
      setActionError(sendError.message)
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setActionError('6자리 인증번호를 입력해 주세요.')
      return
    }
    setPending(true)
    setActionError('')
    try {
      const { verificationToken } = await verifyPhoneCode({ phone, code, purpose })
      onVerified({ phone, verificationToken })
    } catch (verifyError) {
      setActionError(verifyError.message)
    } finally {
      setPending(false)
    }
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
          placeholder="1234"
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
          onChange={(event) => onChange({ middle, last: toFourDigits(event.target.value) })}
          onKeyDown={handleLastKeyDown}
          placeholder="5678"
          inputMode="numeric"
          maxLength={4}
          autoComplete="tel-local-suffix"
          aria-label="휴대폰 끝 4자리"
          aria-invalid={invalid}
        />
        {!verified && (
          <button type="button" className="signup-form__check" onClick={handleSend} disabled={!canSend}>
            {sent ? '인증번호 다시 받기' : '인증번호 받기'}
          </button>
        )}
      </div>
      {verified ? (
        <p className="phone-verification__done" role="status">
          휴대폰 인증이 완료되었습니다.
        </p>
      ) : (
        sent && (
          <>
            {notice && (
              <p className="phone-verification__notice" role="status">
                {notice}
              </p>
            )}
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
        )
      )}
      <FieldError message={error} />
      <FieldError message={actionError} />
    </div>
  )
}
