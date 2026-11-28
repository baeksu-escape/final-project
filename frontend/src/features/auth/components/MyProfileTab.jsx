import { useEffect, useState } from 'react'
import { fetchMyProfile, requestUnmaskProfile } from '../api/myPageApi.js'
import AccountManageCard from './AccountManageCard.jsx'
import MyProfileCard from './MyProfileCard.jsx'
import ProfileUnlockCard from './ProfileUnlockCard.jsx'

// FP-222 v2 마이 페이지 [내정보] 탭 — 먼저 비밀번호를 확인하고(기존 MEM-02 가림 해제), 맞으면 내 정보(N-04-1·N-04-2)·계정 관리(N-04-3, 회원 탈퇴 N-04-7 포함)를 연다.
// FP-259 확인 상태(unlocked)와 원래 값(unmasked)은 MyPage가 들고 있어, 마이페이지 안에서 탭을 오가도 다시 묻지 않는다.
export default function MyProfileTab({ unlocked, onUnlock, unmasked, onUnmaskedChange }) {
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // 처음 들어올 때와 계정 정보를 저장한 뒤(reloadKey 증가) 내 정보를 불러온다.
  useEffect(() => {
    let cancelled = false
    fetchMyProfile()
      .then(({ profile: next }) => {
        if (cancelled) return
        setProfile(next)
        setLoadError('')
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // 계정 정보(이메일·닉네임 등)를 저장하면 원래 값이 바뀌었을 수 있으니, 다시 불러오기를 기다리지 않고 MyPage가 든 원래 값을 바로 지운다.
  // 다시 불러오기 중에 탭을 옮겨도 옛 값이 [표시]로 되살아나지 않는다. 다음 [표시]는 가림 해제로 새 값을 받는다(FP-259 16차).
  const handleSaved = () => {
    onUnmaskedChange(null)
    setReloadKey((key) => key + 1)
  }

  // N-04-2 가림 해제(MEM-02) — 서버가 비밀번호를 확인하면 원래 값을 화면 상태에만 둔다. 틀리면 오류를 그대로 던진다(카드가 보여 준다).
  const handleUnmask = async (password) => {
    const { profile: original } = await requestUnmaskProfile(password)
    onUnmaskedChange(original)
  }

  // 탭 잠금 해제 — 가림 해제와 같은 확인이다.
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
        {/* N-04-7 회원 탈퇴는 계정 관리 카드 안에 있다(FP-259). */}
        <AccountManageCard currentNickname={profile.nickname} onSaved={handleSaved} />
      </div>
    </>
  )
}
