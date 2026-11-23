import { useEffect, useState } from 'react'
import { fetchMyProfile, requestUnmaskProfile } from '../api/myPageApi.js'
import AccountManageCard from './AccountManageCard.jsx'
import MyProfileCard from './MyProfileCard.jsx'
import ProfileUnlockCard from './ProfileUnlockCard.jsx'
import WithdrawalCard from './WithdrawalCard.jsx'

// FP-222 v2 마이 페이지 [내정보] 탭 — 먼저 비밀번호를 확인하고(기존 MEM-02 가림 해제), 맞으면 내 정보(N-04-1·N-04-2)·계정 관리(N-04-3)·회원 탈퇴(N-04-7)를 연다.
// 잠금 상태와 원래 값은 이 컴포넌트 상태에만 있어서, 다른 탭이나 화면으로 가면(컴포넌트가 사라지면) 함께 지워지고 다시 들어오면 잠겨 있다.
// 카드들은 Fragment로 돌려줘 .my-page 격자의 바로 아래 칸이 되게 한다(내 정보 2칸 + 계정 관리 1칸 배치를 그대로 쓴다).
export default function MyProfileTab() {
  const [unlocked, setUnlocked] = useState(false)
  const [profile, setProfile] = useState(null)
  const [unmasked, setUnmasked] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // 처음 들어올 때와 계정 정보를 저장한 뒤(reloadKey 증가) 내 정보를 불러온다. 저장 뒤에는 값이 바뀌었을 수 있으니 가림 해제 값도 지운다.
  // 처음 불러오기는 지우지 않는다 — 응답이 잠금 해제보다 늦게 와도 방금 받은 원래 값이 지워지지 않게 하려는 것이다.
  useEffect(() => {
    let cancelled = false
    fetchMyProfile()
      .then(({ profile: next }) => {
        if (cancelled) return
        setProfile(next)
        if (reloadKey > 0) setUnmasked(null)
        setLoadError('')
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // N-04-2 가림 해제(MEM-02) — 서버가 비밀번호를 확인하면 원래 값을 상태에만 둔다. 틀리면 오류를 그대로 던진다(카드가 보여 준다).
  const handleUnmask = async (password) => {
    const { profile: original } = await requestUnmaskProfile(password)
    setUnmasked(original)
  }

  // 탭 잠금 해제 — 가림 해제와 같은 확인이다. 성공하면 받은 원래 값을 바로 보여 준다.
  const handleUnlock = async (password) => {
    await handleUnmask(password)
    setUnlocked(true)
  }

  if (!unlocked) return <ProfileUnlockCard onUnlock={handleUnlock} />
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
    <>
      {loadError && (
        <p className="my-page__error" role="alert">
          {loadError}
        </p>
      )}
      <MyProfileCard profile={profile} unmasked={unmasked} onUnmask={handleUnmask} />
      <AccountManageCard currentNickname={profile.nickname} onSaved={() => setReloadKey((key) => key + 1)} />
      {/* N-04-7 회원 탈퇴 — 상태 변경 방식(FP-93), 비밀번호를 한 번 더 받는다. */}
      <WithdrawalCard />
    </>
  )
}
