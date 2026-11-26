import { useSearchParams } from 'react-router-dom'
import { Card, Notice, SegmentedControl } from '../../../common/components/index.js'
import DiagnosisHistoryPanel from '../components/DiagnosisHistoryPanel.jsx'
import MyCreditSummary from '../components/MyCreditSummary.jsx'
import MyProfileTab from '../components/MyProfileTab.jsx'
import '../auth.css'

// FP-222 v2 마이 페이지 탭 — 지금 탭은 주소 ?tab= 값으로 남겨 새로고침·뒤로 가기에서도 같은 탭을 연다. 첫 탭(진단내역)은 ?tab 없이 연다.
const TABS = Object.freeze({ HISTORY: 'history', PROFILE: 'profile', BOARD: 'board' })
const TAB_OPTIONS = Object.freeze([
  { value: TABS.HISTORY, label: '진단내역' },
  { value: TABS.PROFILE, label: '내정보' },
  { value: TABS.BOARD, label: '게시판관리' },
])

// N-04 마이페이지 — [진단내역 | 내정보 | 게시판관리] 탭(FP-222 v2). 탭 전환은 한 화면 안의 보기 바꾸기라 공통 SegmentedControl을 쓴다
// (공통 TabMenu는 주소 경로로 현재 탭을 고르는 페이지 이동용이라 ?tab 값에는 맞지 않는다).
// 진단내역 = 점수 변화 그래프 + 표(N-04-6), 내정보 = 비밀번호 확인 뒤 내 정보·계정 관리·회원 탈퇴, 게시판관리 = 준비 중 안내.
export default function MyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab = Object.values(TABS).includes(requested) ? requested : TABS.HISTORY

  // 탭을 바꾸면 주소에 남긴다(뒤로 가기로 앞 탭에 돌아갈 수 있게 기록을 쌓는다).
  const changeTab = (next) => setSearchParams(next === TABS.HISTORY ? {} : { tab: next })

  return (
    <section className="my-page">
      {/* UI 리뉴얼(FP-252) — 탭 위에 신용 기록 요약(점수 링·숫자 타일). 점수 변화 그래프는 [진단내역] 탭에 있다 */}
      <MyCreditSummary />
      <SegmentedControl label="마이 페이지 메뉴" options={TAB_OPTIONS} value={tab} onChange={changeTab} />
      {tab === TABS.HISTORY && <DiagnosisHistoryPanel />}
      {/* 내정보 탭을 떠나면 MyProfileTab이 사라지며 잠금·원래 값도 함께 지워진다. */}
      {tab === TABS.PROFILE && <MyProfileTab />}
      {tab === TABS.BOARD && (
        <Card title="게시판 관리" className="my-board-card">
          <Notice>내가 쓴 글·댓글 모아 보기는 준비 중입니다. 글과 댓글은 신용 라운지에서 볼 수 있습니다.</Notice>
        </Card>
      )}
    </section>
  )
}
