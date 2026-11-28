import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../common/components/index.js'
import { DATA_INPUT_PATHS } from '../../dataInput/dataInputPaths.js'
import EmailChangeForm from './EmailChangeForm.jsx'
import JobTypeChangeForm from './JobTypeChangeForm.jsx'
import NicknameChangeForm from './NicknameChangeForm.jsx'
import PasswordChangeForm from './PasswordChangeForm.jsx'
import WithdrawalCard from './WithdrawalCard.jsx'

// 계정 관리 카드에서 열 수 있는 폼.
const FORMS = Object.freeze({ NICKNAME: 'nickname', EMAIL: 'email', PASSWORD: 'password', JOB_TYPE: 'jobType', WITHDRAWAL: 'withdrawal' })

// N-04-3 계정 관리 카드 — 닉네임·이메일·비밀번호 변경 폼을 한 번에 하나만 열고, [데이터 다시 입력]은 데이터 입력 화면(N-05)으로 보낸다.
// FP-259 N-04-7 맨 아래 줄 [회원 탈퇴]도 같은 "한 번에 하나" 폼이라 다른 버튼을 누르면 접힌다.
// FP-298 N-04-8 맨 아래 줄은 위 2×2와 같은 2칸 격자 — 왼쪽 [직군 변경하기](11/28 조장 확인: 기존 입력 유지, 소득·기간 재입력 안내), 오른쪽 [회원 탈퇴].
// 바꿀 수 있는 정보는 닉네임(FP-222 MEM-08)·이메일·비밀번호·직군이다. 저장이 끝나면 결과를 안내하고 onSaved로 내 정보를 다시 불러오게 한다.
export default function AccountManageCard({ currentNickname, onSaved }) {
  const navigate = useNavigate()
  const [openForm, setOpenForm] = useState(null)
  const [result, setResult] = useState('')

  // 폼 하나를 연다. 같은 버튼을 다시 누르면 닫는다. 지난 결과 안내는 지운다.
  const toggleForm = (form) => {
    setOpenForm((prev) => (prev === form ? null : form))
    setResult('')
  }

  // 저장이 끝나면 폼을 닫고 결과를 안내한 뒤 내 정보를 다시 불러오게 한다.
  const handleSaved = (message) => {
    setOpenForm(null)
    setResult(message)
    onSaved()
  }

  return (
    <Card title="계정 관리" className="account-manage-card">
      <div className="account-manage-card__actions">
        <button
          type="button"
          className="account-manage-card__nickname"
          aria-expanded={openForm === FORMS.NICKNAME}
          onClick={() => toggleForm(FORMS.NICKNAME)}
        >
          닉네임 변경
        </button>
        <button
          type="button"
          className="account-manage-card__email"
          aria-expanded={openForm === FORMS.EMAIL}
          onClick={() => toggleForm(FORMS.EMAIL)}
        >
          이메일 변경
        </button>
        <button
          type="button"
          className="account-manage-card__password"
          aria-expanded={openForm === FORMS.PASSWORD}
          onClick={() => toggleForm(FORMS.PASSWORD)}
        >
          비밀번호 변경
        </button>
        <button type="button" className="account-manage-card__data-input" onClick={() => navigate(DATA_INPUT_PATHS.DATA_INPUT)}>
          데이터 다시 입력
        </button>
      </div>
      {result && (
        <p className="account-manage-card__result" role="status">
          {result}
        </p>
      )}
      {openForm === FORMS.NICKNAME && (
        <NicknameChangeForm currentNickname={currentNickname} onSaved={handleSaved} onCancel={() => setOpenForm(null)} />
      )}
      {openForm === FORMS.EMAIL && <EmailChangeForm onSaved={handleSaved} onCancel={() => setOpenForm(null)} />}
      {openForm === FORMS.PASSWORD && <PasswordChangeForm onSaved={handleSaved} onCancel={() => setOpenForm(null)} />}
      <div className="account-manage-card__actions">
        <button
          type="button"
          className="account-manage-card__job-type"
          aria-expanded={openForm === FORMS.JOB_TYPE}
          onClick={() => toggleForm(FORMS.JOB_TYPE)}
        >
          직군 변경하기
        </button>
        <button
          type="button"
          className="withdrawal-card__open"
          aria-expanded={openForm === FORMS.WITHDRAWAL}
          onClick={() => toggleForm(FORMS.WITHDRAWAL)}
        >
          회원 탈퇴
        </button>
      </div>
      {openForm === FORMS.JOB_TYPE && <JobTypeChangeForm onSaved={handleSaved} onCancel={() => setOpenForm(null)} />}
      {openForm === FORMS.WITHDRAWAL && <WithdrawalCard onCancel={() => setOpenForm(null)} />}
    </Card>
  )
}
