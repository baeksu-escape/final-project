import { useEffect, useState } from 'react'
import { fetchMyProfile, requestUnmaskProfile } from '../api/myPageApi.js'
import AccountManageCard from './AccountManageCard.jsx'
import MyProfileCard from './MyProfileCard.jsx'
import ProfileUnlockCard from './ProfileUnlockCard.jsx'

// FP-222 v2 마이 페이지 [내정보] 탭 — 먼저 비밀번호를 확인하고(기존 MEM-02 가림 해제), 맞으면 내 정보(N-04-1·N-04-2)·계정 관리(N-04-3, 회원 탈퇴 N-04-7 포함)를 연다.
// FP-259 4차 확인 상태(unlocked)와 원래 값(unmasked)은 MyPage가 들고 있어, 마이페이지 안에서 탭을 오가도 다시 묻지 않는다.
// 다른 페이지·새로고침·로그아웃으로 MyPage가 사라지면 함께 지워져 다시 묻는다.
// 내 정보(넓게)·계정 관리(좁게)는 탭 안의 격자(.my-profile-tab)에 나란히 두고 윗선·높이를 맞춘다.
export default function MyProfileTab({ unlocked, onUnlock, unmasked, onUnmaskedChange }) {
  const [profile, setProfile] = useState(null)
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
        if (reloadKey > 0) onUnmaskedChange(null)
        setLoadError('')
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, onUnmaskedChange])

  // N-04-2 가림 해제(MEM-02) — 서버가 비밀번호를 확인하면 원래 값을 화면 상태에만 둔다. 틀리면 오류를 그대로 던진다(카드가 보여 준다).
  const handleUnmask = async (password) => {
    const { profile: original } = await requestUnmaskProfile(password)
    onUnmaskedChange(original)
  }

  // 탭 잠금 해제 — 가림 해제와 같은 확인이다. FP-259 4차 확인 뒤에도 가린 값부터 보여 주고, 원래 값은 [표시]를 눌러야 보인다.
  const handleUnlock = async (password) => {
    await handleUnmask(password)
    onUnlock()
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
      <div className="my-profile-tab">
        <MyProfileCard profile={profile} unmasked={unmasked} onUnmask={handleUnmask} />
        {/* N-04-7 회원 탈퇴는 계정 관리 카드 맨 아래로 옮겼다(FP-259). */}
        <AccountManageCard currentNickname={profile.nickname} onSaved={() => setReloadKey((key) => key + 1)} />
      </div>
    </>
  )
}
