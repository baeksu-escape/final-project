import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { SegmentedControl } from '../../../common/components/index.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import DiagnosisHistoryPanel from '../components/DiagnosisHistoryPanel.jsx'
import MyCreditSummary from '../components/MyCreditSummary.jsx'
import MyProfileTab from '../components/MyProfileTab.jsx'
import '../auth.css'

// FP-222 v2 마이 페이지 탭 — 지금 탭은 주소 ?tab= 값으로 남겨 새로고침·뒤로 가기에서도 같은 탭을 연다. 첫 탭(진단내역)은 ?tab 없이 연다.
// FP-259 MYPAGE-01 [게시판관리] 탭을 없앴다. 예전 주소 ?tab=board처럼 없는 탭 값이면 진단내역을 연다.
const TABS = Object.freeze({ HISTORY: 'history', PROFILE: 'profile' })
const TAB_OPTIONS = Object.freeze([
  { value: TABS.HISTORY, label: '진단내역' },
  { value: TABS.PROFILE, label: '내정보' },
])

// N-04 마이페이지 — [진단내역 | 내정보] 탭(FP-222 v2, FP-259). 탭 전환은 한 화면 안의 보기 바꾸기라 공통 SegmentedControl을 쓴다
// (공통 TabMenu는 주소 경로로 현재 탭을 고르는 페이지 이동용이라 ?tab 값에는 맞지 않는다).
// 진단내역 = 신용 기록 요약 + 점수 변화 그래프 + 표(N-04-6), 내정보 = 비밀번호 확인 뒤 내 정보·계정 관리(회원 탈퇴 포함).
// FP-259 탭 위에는 인사말(마이 페이지 · 직군, ○○님의 신용 기록)만 두고, 요약 카드는 [진단내역] 탭 안으로 옮겼다.
// 내 정보는 비밀번호 확인 뒤에만 보이므로(FP-222) 인사말은 로그인 정보(이름·직군)로 만든다.
export default function MyPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab = Object.values(TABS).includes(requested) ? requested : TABS.HISTORY

  // 탭을 바꾸면 주소에 남긴다(뒤로 가기로 앞 탭에 돌아갈 수 있게 기록을 쌓는다).
  const changeTab = (next) => setSearchParams(next === TABS.HISTORY ? {} : { tab: next })

  return (
    <section className="my-page">
      <header className="my-summary__hello">
        <p className="my-summary__eyebrow">마이 페이지 · {JOB_TYPE_LABELS[user?.jobType] ?? '직군 미선택'}</p>
        <h1 className="my-summary__title">{user?.name ? `${user.name}님의` : '나의'}<br />신용 기록</h1>
      </header>
      <SegmentedControl label="마이 페이지 메뉴" options={TAB_OPTIONS} value={tab} onChange={changeTab} />
      {/* UI 리뉴얼(FP-252) 신용 기록 요약(점수 링·숫자 타일) — FP-259부터 [진단내역] 탭 안, 진단 내역 표 위에 둔다 */}
      {tab === TABS.HISTORY && <MyCreditSummary />}
      {tab === TABS.HISTORY && <DiagnosisHistoryPanel />}
      {/* 내정보 탭을 떠나면 MyProfileTab이 사라지며 잠금·원래 값도 함께 지워진다. */}
      {tab === TABS.PROFILE && <MyProfileTab />}
    </section>
  )
}
