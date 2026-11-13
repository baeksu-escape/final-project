import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Card, TextInput } from '../../../common/components/index.js'
import { requestWithdrawal } from '../api/myPageApi.js'
import { AUTH_PATHS } from '../authPaths.js'

// N-04-7 탈퇴 확인 폼의 안내문.
const WITHDRAWAL_NOTICE =
  '탈퇴하면 계정이 탈퇴 상태로 바뀌고 이름·이메일·휴대폰 같은 개인정보는 지워집니다. 진단 내역은 서비스 기록으로 보관되고, 동의로 불러온 대안 데이터와 간편 로그인 연결은 삭제됩니다. 되돌릴 수 없습니다.'
// 탈퇴를 마친 뒤 로그인 화면에 띄울 알림.
const WITHDRAWAL_DONE_MESSAGE = '탈퇴를 마쳤습니다.'

// N-04-7 회원 탈퇴 카드 — [회원 탈퇴]를 누르면 안내문과 비밀번호 확인 폼을 연다. 비밀번호가 맞아야 [탈퇴하기]가 동작한다.
// 탈퇴는 상태 변경 방식이다(DDL v0.3.2 W1). 성공하면 로그아웃하고, 로그아웃 상태의 메인인 로그인 화면으로 보낸다. 알림 문구는 logout({ notice })로 맡긴다.
export default function WithdrawalCard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  // 폼을 닫고 입력·오류를 비운다.
  const close = () => {
    setOpen(false)
    setPassword('')
    setPasswordError('')
    setFormError('')
  }

  // 비밀번호를 보내 탈퇴를 요청한다. 비밀번호가 틀리면(400 fieldErrors password) 칸 옆에, 그 밖의 오류는 폼 아래에 보여 준다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    if (!password) {
      setPasswordError('비밀번호를 입력해 주세요.')
      return
    }
    setPasswordError('')
    setPending(true)
    try {
      await requestWithdrawal(password)
    } catch (error) {
      const fieldError = error.data?.fieldErrors?.find((item) => item.field === 'password')
      if (fieldError) setPasswordError(fieldError.message ?? error.message)
      else setFormError(error.message)
      setPending(false)
      return
    }
    // 알림은 로그아웃 상태와 함께 AuthProvider에 맡긴다. 라우트 가드가 먼저 로그인 화면으로 보내도 알림이 남는다.
    await logout({ notice: WITHDRAWAL_DONE_MESSAGE })
    navigate(AUTH_PATHS.LOGIN, { replace: true })
  }

  return (
    <Card title="회원 탈퇴" className="withdrawal-card">
      {!open && (
        <button type="button" className="withdrawal-card__open" onClick={() => setOpen(true)}>
          회원 탈퇴
        </button>
      )}
      {open && (
        <form className="account-form withdrawal-form" onSubmit={handleSubmit} noValidate>
          <p className="withdrawal-form__notice">{WITHDRAWAL_NOTICE}</p>
          <TextInput
            label="비밀번호 확인"
            type="password"
            value={password}
            onChange={(value) => {
              setPassword(value)
              setPasswordError('')
            }}
            error={passwordError}
            autoComplete="current-password"
          />
          {formError && (
            <p className="account-form__error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="account-form__submit" disabled={pending}>
            {pending ? '탈퇴 처리 중…' : '탈퇴하기'}
          </button>
          <button type="button" className="account-form__cancel" onClick={close} disabled={pending}>
            취소
          </button>
        </form>
      )}
    </Card>
  )
}
