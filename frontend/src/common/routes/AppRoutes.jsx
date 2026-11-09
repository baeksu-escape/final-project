import { Route, Routes } from 'react-router-dom'
import RouteGuard from '../auth/RouteGuard.jsx'
import { PATHS } from '../config/navigation.js'
import { ROLES } from '../config/roles.js'
import AppLayout from '../layout/AppLayout.jsx'
import DiagnosisPage from '../pages/DiagnosisPage.jsx'
import ForbiddenPage from '../pages/ForbiddenPage.jsx'
import HomeRedirect from '../pages/HomeRedirect.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import PlaceholderPage from '../pages/PlaceholderPage.jsx'
import { AUTH_PATHS } from '../../features/auth/authPaths.js'
import GuestOnlyRoute from '../../features/auth/components/GuestOnlyRoute.jsx'
import FindIdPage from '../../features/auth/pages/FindIdPage.jsx'
import FindPasswordPage from '../../features/auth/pages/FindPasswordPage.jsx'
import LoginPage from '../../features/auth/pages/LoginPage.jsx'
import SignupPage from '../../features/auth/pages/SignupPage.jsx'
import { DATA_INPUT_PATHS } from '../../features/dataInput/dataInputPaths.js'
import DataInputPage from '../../features/dataInput/pages/DataInputPage.jsx'
import JobSelectPage from '../../features/dataInput/pages/JobSelectPage.jsx'

// N-08 직군별 재무 진단 서브탭 내용. 담당 팀은 해당 PlaceholderPage를 자기 화면으로 바꾼다.
const DIAGNOSIS_CONTENTS = {
  'asset-debt': <PlaceholderPage title="자산·부채 건전성" nId="N-16" headingLevel={2} />,
  'income-volatility': <PlaceholderPage title="소득 변동성" nId="N-22" headingLevel={2} />,
  'cash-flow': <PlaceholderPage title="현금흐름" nId="N-21" headingLevel={2} />,
  market: <PlaceholderPage title="상권 지표" nId="N-24" headingLevel={2} />,
}

// 앱 전체 라우트. 다른 팀은 자기 화면의 element 한 줄만 바꾼다(가드·경로 구조는 그대로 둔다).
export default function AppRoutes() {
  return (
    <Routes>
      {/* 로그인 전 (FP-87 N-01~N-03) — 이미 로그인했으면 첫 화면으로 보낸다 */}
      <Route element={<GuestOnlyRoute />}>
        <Route path={AUTH_PATHS.LOGIN} element={<LoginPage />} />
        <Route path={AUTH_PATHS.SIGNUP} element={<SignupPage />} />
        <Route path={AUTH_PATHS.FIND_ID} element={<FindIdPage />} />
        <Route path={AUTH_PATHS.FIND_PASSWORD} element={<FindPasswordPage />} />
      </Route>

      {/* 로그인 필요 */}
      <Route element={<RouteGuard />}>
        <Route element={<AppLayout />}>
          <Route path={PATHS.HOME} element={<HomeRedirect />} />
          <Route path={PATHS.FORBIDDEN} element={<ForbiddenPage />} />
          {/* 직군 선택 (FP-85 N-05-1) — 직군이 없는 사용자만 머문다 */}
          <Route path={PATHS.SELECT_JOB} element={<JobSelectPage />} />

          {/* 일반 사용자 전용 + 직군 선택 완료 */}
          <Route element={<RouteGuard requiredRole={ROLES.USER} requireJobType />}>
            <Route path={PATHS.REPORT} element={<PlaceholderPage title="신용 리포트" nId="N-12" />} />
            <Route path={`${PATHS.DIAGNOSIS}/:subTab?`} element={<DiagnosisPage contents={DIAGNOSIS_CONTENTS} />} />
            <Route path={PATHS.SIMULATOR} element={<PlaceholderPage title="점수·금리 시뮬레이터" nId="N-18" />} />
            <Route path={PATHS.MY_PAGE} element={<PlaceholderPage title="마이 페이지" nId="N-04" />} />
            <Route path={DATA_INPUT_PATHS.DATA_INPUT} element={<DataInputPage />} />
          </Route>

          {/* 관리자 전용 */}
          <Route element={<RouteGuard requiredRole={ROLES.ADMIN} />}>
            <Route path={PATHS.ADMIN_MODEL} element={<PlaceholderPage title="모형 성능 비교" nId="N-25" />} />
            <Route path={PATHS.ADMIN_STATS} element={<PlaceholderPage title="직군·연령별 통계" nId="N-26" />} />
            <Route path={PATHS.ADMIN_ACCOUNTS} element={<PlaceholderPage title="계정·권한 관리" nId="N-27" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
