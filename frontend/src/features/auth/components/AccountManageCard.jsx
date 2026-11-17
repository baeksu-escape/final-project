import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../common/components/index.js'
import { DATA_INPUT_PATHS } from '../../dataInput/dataInputPaths.js'
import EmailChangeForm from './EmailChangeForm.jsx'
import PasswordChangeForm from './PasswordChangeForm.jsx'

// 계정 관리 카드에서 열 수 있는 폼.
const FORMS = Object.freeze({ EMAIL: 'email', PASSWORD: 'password' })

// N-04-3 계정 관리 카드 — 이메일·비밀번호 변경 폼을 한 번에 하나만 열고, [데이터 다시 입력]은 데이터 입력 화면(N-05)으로 보낸다.
// 바꿀 수 있는 정보는 이메일과 비밀번호뿐이다. 저장이 끝나면 결과를 안내하고 onSaved로 내 정보를 다시 불러오게 한다.
// N-04-8 [직군 바꾸기]는 우선순위 미정(decisions.md D-27)이라 만들지 않는다. 직군은 처음 직군 선택(N-05-1)에서만 정한다.
export default function AccountManageCard({ onSaved }) {
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
          className="account-manage-card__email"
          aria-expanded={openForm === FORMS.EMAIL}
          onClick={() => toggleForm(FORMS.EMAIL)}
        >
          이메일 바꾸기
        </button>
        <button
          type="button"
          className="account-manage-card__password"
          aria-expanded={openForm === FORMS.PASSWORD}
          onClick={() => toggleForm(FORMS.PASSWORD)}
        >
          비밀번호 바꾸기
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
      {openForm === FORMS.EMAIL && <EmailChangeForm onSaved={handleSaved} onCancel={() => setOpenForm(null)} />}
      {openForm === FORMS.PASSWORD && <PasswordChangeForm onSaved={handleSaved} onCancel={() => setOpenForm(null)} />}
    </Card>
  )
}
