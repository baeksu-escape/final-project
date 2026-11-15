import { useState } from 'react'
import { Button, Modal, Notice } from '../../../common/components/index.js'

// N-27-4 임시 비밀번호 1회 표시 모달 — 관리자 계정을 만든 직후에만 보여 주고, 닫으면 부르는 쪽이 값을 지운다.
// 임시 비밀번호는 console·localStorage·sessionStorage에 남기지 않는다. [복사]는 클립보드에만 넣는다.
// 사용 예: <TemporaryPasswordModal result={created} onClose={() => setCreated(null)} />   // result: { loginId, temporaryPassword } | null
export default function TemporaryPasswordModal({ result, onClose }) {
  return (
    <Modal open={Boolean(result)} title="임시 비밀번호 발급" onClose={onClose}>
      {result && <TemporaryPasswordBody result={result} onClose={onClose} />}
    </Modal>
  )
}

// 모달 안쪽 — 열 때마다 복사 안내를 새로 시작한다.
function TemporaryPasswordBody({ result, onClose }) {
  const [copyMessage, setCopyMessage] = useState('')

  // 클립보드에 복사한다. 브라우저가 막으면 직접 옮겨 적도록 안내한다.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.temporaryPassword)
      setCopyMessage('복사했습니다.')
    } catch {
      setCopyMessage('복사하지 못했습니다. 직접 옮겨 적어 주세요.')
    }
  }

  return (
    <div>
      <p>
        <strong>{result.loginId}</strong> 관리자 계정을 만들었습니다. 임시 비밀번호를 새 관리자에게 안전한 방법으로 전달해 주세요.
      </p>
      <p>
        임시 비밀번호: <strong>{result.temporaryPassword}</strong>
      </p>
      <Notice type="warn">이 창을 닫으면 임시 비밀번호를 다시 볼 수 없습니다.</Notice>
      <p>새 관리자는 첫 로그인 때 2단계 인증을 거친 뒤 비밀번호를 새로 정해야 합니다.</p>
      <Button onClick={handleCopy}>복사</Button>
      {copyMessage && <p role="status">{copyMessage}</p>}
      <Button variant="primary" onClick={onClose}>
        확인했습니다
      </Button>
    </div>
  )
}
