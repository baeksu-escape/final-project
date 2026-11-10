// v3 삭제(N-08-3, 11/06) — 연결하지 않음. 팀 확인 후 지운다. 안의 4개 기능은 사용자 주 메뉴로 올라갔다(N-08-1).
import { Navigate, NavLink, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { getVisibleDiagnosisTabs } from '../config/diagnosisTabs.js'
import { PATHS } from '../config/navigation.js'

// N-08 직군별 재무 진단 — 내 직군에서 보이는 서브탭만 보여 주고, 숨김 대상 탭 주소로 들어오면 첫 서브탭으로 보낸다.
// contents: { [서브탭 key]: 화면 요소 } — AppRoutes.jsx에서 넘긴다.
export default function DiagnosisPage({ contents }) {
  const { user } = useAuth()
  const { subTab } = useParams()
  const tabs = getVisibleDiagnosisTabs(user?.jobType)

  if (tabs.length === 0) {
    return (
      <section className="diagnosis-page">
        <h1 className="diagnosis-page__title">직군별 재무 진단</h1>
        <p className="diagnosis-page__empty">직군 정보가 없어 진단 화면을 보여 줄 수 없습니다.</p>
      </section>
    )
  }

  const current = tabs.find((tab) => tab.key === subTab)
  if (!current) {
    return <Navigate to={`${PATHS.DIAGNOSIS}/${tabs[0].key}`} replace />
  }

  return (
    <section className="diagnosis-page">
      <h1 className="diagnosis-page__title">직군별 재무 진단</h1>
      <nav className="sub-tab-menu" aria-label="재무 진단 서브탭">
        <ul className="sub-tab-menu__list">
          {tabs.map((tab) => (
            <li key={tab.key} className="sub-tab-menu__item">
              <NavLink to={`${PATHS.DIAGNOSIS}/${tab.key}`} className="sub-tab-menu__link">
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="diagnosis-page__content">{contents?.[current.key]}</div>
    </section>
  )
}
