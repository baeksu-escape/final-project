import { Route, Routes } from 'react-router-dom'
import RouteGuard from '../auth/RouteGuard.jsx'
import { PATHS } from '../config/navigation.js'
import { ROLES } from '../config/roles.js'
import AppLayout from '../layout/AppLayout.jsx'
import ForbiddenPage from '../pages/ForbiddenPage.jsx'
import HomeRedirect from '../pages/HomeRedirect.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import PlaceholderPage from '../pages/PlaceholderPage.jsx'
import { AUTH_PATHS } from '../../features/auth/authPaths.js'
import GuestOnlyRoute from '../../features/auth/components/GuestOnlyRoute.jsx'
import FindIdPage from '../../features/auth/pages/FindIdPage.jsx'
import FindPasswordPage from '../../features/auth/pages/FindPasswordPage.jsx'
import LoginPage from '../../features/auth/pages/LoginPage.jsx'
import MyPage from '../../features/auth/pages/MyPage.jsx'
import SignupPage from '../../features/auth/pages/SignupPage.jsx'
import SocialCallbackPage from '../../features/auth/pages/SocialCallbackPage.jsx'
import SocialLinkPage from '../../features/auth/pages/SocialLinkPage.jsx'
import { SOCIAL_PATHS } from '../../features/auth/socialLoginConfig.js'
import { DATA_INPUT_PATHS } from '../../features/dataInput/dataInputPaths.js'
import DataInputPage from '../../features/dataInput/pages/DataInputPage.jsx'
import JobSelectPage from '../../features/dataInput/pages/JobSelectPage.jsx'

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
        {/* 소셜 로그인 (FP-145 N-01-6) */}
        <Route path={SOCIAL_PATHS.CALLBACK} element={<SocialCallbackPage />} />
        <Route path={SOCIAL_PATHS.LINK} element={<SocialLinkPage />} />
      </Route>

      {/* 로그인 필요 */}
      <Route element={<RouteGuard />}>
        <Route element={<AppLayout />}>
          <Route path={PATHS.HOME} element={<HomeRedirect />} />
          <Route path={PATHS.FORBIDDEN} element={<ForbiddenPage />} />
          {/* 직군 선택 (FP-85 N-05-1) — 직군이 없는 사용자만 머문다 */}
          <Route path={PATHS.SELECT_JOB} element={<JobSelectPage />} />

          {/* 일반 사용자 전용 + 직군 선택 완료 — N-08-1 주 메뉴 9개와 헤더의 마이 페이지 */}
          <Route element={<RouteGuard requiredRole={ROLES.USER} requireJobType />}>
            {/* 점수가 있어야 보는 화면 — 점수가 없으면 데이터 입력으로 보낸다(11/06 확정 UI) */}
            <Route element={<RouteGuard requireScore />}>
              <Route path={PATHS.REPORT} element={<PlaceholderPage title="신용 리포트" nId="N-12" />} />
              <Route path={PATHS.ASSET_DEBT} element={<PlaceholderPage title="자산·부채 건전성" nId="N-16" />} />
              <Route path={PATHS.SCENARIO} element={<PlaceholderPage title="시나리오 테스트" nId="N-17" />} />
              <Route path={PATHS.CASH_FLOW} element={<PlaceholderPage title="현금흐름·소득 변동성" nId="N-21·N-22" />} />
              <Route path={PATHS.MARKET} element={<PlaceholderPage title="상권 분석" nId="N-24" />} />
              <Route path={PATHS.SIMULATOR} element={<PlaceholderPage title="신용케어 시뮬레이터" nId="N-18" />} />
            </Route>
            {/* 점수 없이도 여는 화면 */}
            <Route path={PATHS.LOANS} element={<PlaceholderPage title="대출 상품" nId="N-37" />} />
            <Route path={PATHS.COMPARISON} element={<PlaceholderPage title="비교 분석" nId="N-13·N-26" />} />
            <Route path={PATHS.LOUNGE} element={<PlaceholderPage title="신용 라운지" nId="N-06" />} />
            <Route path={PATHS.MY_PAGE} element={<MyPage />} />
            <Route path={DATA_INPUT_PATHS.DATA_INPUT} element={<DataInputPage />} />
          </Route>

          {/* 관리자 전용 — N-08-1 관리자 탭 5개 */}
          <Route element={<RouteGuard requiredRole={ROLES.ADMIN} />}>
            <Route path={PATHS.ADMIN_MODEL} element={<PlaceholderPage title="모형 성능 비교" nId="N-25" />} />
            <Route path={PATHS.ADMIN_STATS} element={<PlaceholderPage title="직군·연령별 통계" nId="N-26" />} />
            <Route path={PATHS.ADMIN_ACCOUNTS} element={<PlaceholderPage title="계정·권한 관리" nId="N-27" />} />
            <Route path={PATHS.ADMIN_REPORTS} element={<PlaceholderPage title="신고 접수" nId="N-34" />} />
            <Route path={PATHS.ADMIN_AUDIT} element={<PlaceholderPage title="접근·감사 로그" nId="N-28·N-35" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
