import { useEffect, useState } from 'react'
import { Card } from '../../../common/components/index.js'
import { fetchMyProfile, requestUnmaskProfile } from '../api/myPageApi.js'
import AccountManageCard from '../components/AccountManageCard.jsx'
import DiagnosisHistoryTable from '../components/DiagnosisHistoryTable.jsx'
import MyProfileCard from '../components/MyProfileCard.jsx'
import WithdrawalCard from '../components/WithdrawalCard.jsx'

// N-04 마이페이지 — 내 정보(N-04-1·N-04-2), 계정 관리(N-04-3) 카드와 진단 내역(FP-92) 자리, 맨 아래 회원 탈퇴(N-04-7)를 보여 준다.
// 가림 해제한 원래 값은 이 화면의 상태에만 두므로, 다른 화면으로 가면 사라지고 다시 들어오면 가린 값부터 보인다.
export default function MyPage() {
  const [profile, setProfile] = useState(null)
  const [unmasked, setUnmasked] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // 처음 들어올 때와 계정 정보를 저장한 뒤(reloadKey 증가) 내 정보를 불러온다. 값이 바뀌었을 수 있으니 가림 해제 값도 지운다.
  useEffect(() => {
    let cancelled = false
    fetchMyProfile()
      .then(({ profile: next }) => {
        if (cancelled) return
        setProfile(next)
        setUnmasked(null)
        setLoadError('')
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // N-04-2 가림 해제 — 서버가 비밀번호를 확인하면 원래 값을 화면 상태에만 둔다. 틀리면 오류를 카드로 그대로 던진다.
  const handleUnmask = async (password) => {
    const { profile: original } = await requestUnmaskProfile(password)
    setUnmasked(original)
  }

  if (!profile) {
    return loadError ? (
      <p className="my-page__error" role="alert">
        {loadError}
      </p>
    ) : (
      <p className="my-page__loading">내 정보를 불러오는 중입니다.</p>
    )
  }

  return (
    <section className="my-page">
      <h1 className="my-page__title">마이 페이지</h1>
      {loadError && (
        <p className="my-page__error" role="alert">
          {loadError}
        </p>
      )}
      <MyProfileCard profile={profile} unmasked={unmasked} onUnmask={handleUnmask} />
      <AccountManageCard onSaved={() => setReloadKey((key) => key + 1)} />
      {/* N-04-6 진단 내역 — 지난 평가를 최신순 표로 보여 준다(FP-92). */}
      <Card title="진단 내역" className="my-page-history-card">
        <DiagnosisHistoryTable />
      </Card>
      {/* N-04-7 회원 탈퇴 — 상태 변경 방식(FP-93). */}
      <WithdrawalCard />
    </section>
  )
}
