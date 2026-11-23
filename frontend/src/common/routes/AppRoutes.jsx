import { Route, Routes } from 'react-router-dom'
import RouteGuard from '../auth/RouteGuard.jsx'
import { PATHS } from '../config/navigation.js'
import { ROLES } from '../config/roles.js'
import AppLayout from '../layout/AppLayout.jsx'
import PublicLayout from '../layout/PublicLayout.jsx'
import ForbiddenPage from '../pages/ForbiddenPage.jsx'
import GroupHubPage from '../pages/GroupHubPage.jsx'
import HomePage from '../pages/HomePage.jsx'
import LandingPage from '../pages/LandingPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import { ADMIN_PATHS } from '../../features/admin/adminConstants.js'
import AdminAccountsPage from '../../features/admin/pages/AdminAccountsPage.jsx'
import AdminAuditLogsPage from '../../features/admin/pages/AdminAuditLogsPage.jsx'
import AdminPasswordPage from '../../features/admin/pages/AdminPasswordPage.jsx'
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
import CreditReportPage from '../../features/credit/pages/CreditReportPage.jsx'
import SimulationPage from '../../features/simulation/pages/SimulationPage.jsx'
import MarketPage from '../../features/market/pages/MarketPage.jsx'
import AssetDebtPage from '../../features/diagnosis/pages/AssetDebtPage.jsx'
import CashFlowPage from '../../features/diagnosis/pages/CashFlowPage.jsx'
import ScenarioPage from '../../features/scenario/pages/ScenarioPage.jsx'
import AdminReportsPage from '../../features/admin/pages/AdminReportsPage.jsx'
import ModelPerformancePage from '../../features/admin/pages/ModelPerformancePage.jsx'
import AdminStatsPage from '../../features/admin/pages/AdminStatsPage.jsx'
import LoungePage from '../../features/community/pages/LoungePage.jsx'
import ComparisonPage from '../../features/comparison/pages/ComparisonPage.jsx'
import LoanProductsPage from '../../features/loans/pages/LoanProductsPage.jsx'
import LoanProductDetailPage from '../../features/loans/pages/LoanProductDetailPage.jsx'

// 앱 전체 라우트. 다른 팀은 자기 화면의 element 한 줄만 바꾼다(가드·경로 구조는 그대로 둔다).
export default function AppRoutes() {
  return (
    <Routes>
      {/* 로그인 전 공통 틀(로고·서비스 메뉴·푸터) — FP-156 공통 레이아웃 */}
      <Route element={<PublicLayout />}>
        {/* N-10 메인(홍보) 첫 화면 — UI 리뉴얼: 로그인한 뒤에도 로고·[메인]으로 다시 볼 수 있다 */}
        <Route path={PATHS.HOME} element={<LandingPage />} />
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
      </Route>

      {/* 로그인 필요 */}
      <Route element={<RouteGuard />}>
        <Route element={<AppLayout />}>
          <Route path={PATHS.FORBIDDEN} element={<ForbiddenPage />} />
          {/* 직군 선택 (FP-85 N-05-1) — 직군이 없는 사용자만 머문다 */}
          <Route path={PATHS.SELECT_JOB} element={<JobSelectPage />} />

          {/* 일반 사용자 전용 + 직군 선택 완료 — N-08-1 기능 9개(위쪽 메뉴는 큰 분류 5개로 묶음) */}
          <Route element={<RouteGuard requiredRole={ROLES.USER} requireJobType />}>
            {/* 점수가 있어야 보는 화면 — 점수가 없으면 데이터 입력으로 보낸다(11/06 확정 UI) */}
            <Route element={<RouteGuard requireScore />}>
              {/* UI 리뉴얼: 홈과 큰 분류 화면 */}
              <Route path={PATHS.DASHBOARD} element={<HomePage />} />
              <Route path={PATHS.MY_CREDIT} element={<GroupHubPage groupKey="credit" />} />
              <Route path={PATHS.FINANCE} element={<GroupHubPage groupKey="finance" />} />
              <Route path={PATHS.REPORT} element={<CreditReportPage />} />
              <Route path={PATHS.ASSET_DEBT} element={<AssetDebtPage />} />
              <Route path={PATHS.SCENARIO} element={<ScenarioPage />} />
              <Route path={PATHS.CASH_FLOW} element={<CashFlowPage />} />
              <Route path={PATHS.MARKET} element={<MarketPage />} />
              <Route path={PATHS.SIMULATOR} element={<SimulationPage />} />
            </Route>
            {/* 점수 없이도 여는 화면 */}
            <Route path={PATHS.LOANS} element={<LoanProductsPage />} />
            <Route path={PATHS.LOAN_DETAIL} element={<LoanProductDetailPage />} />
            <Route path={PATHS.COMPARISON} element={<ComparisonPage />} />
            <Route path={PATHS.LOUNGE} element={<LoungePage />} />
            <Route path={DATA_INPUT_PATHS.DATA_INPUT} element={<DataInputPage />} />
          </Route>

          {/* 일반 사용자 전용, 직군 선택 전에도 연다 — N-08-1 직군 선택·데이터 입력 중에도 헤더의 [마이 페이지]로 들어온다(PR #45 검토) */}
          <Route element={<RouteGuard requiredRole={ROLES.USER} />}>
            <Route path={PATHS.MY_PAGE} element={<MyPage />} />
          </Route>

          {/* 관리자 전용 — N-08-1 관리자 탭 5개 */}
          <Route element={<RouteGuard requiredRole={ROLES.ADMIN} />}>
            <Route path={PATHS.ADMIN_MODEL} element={<ModelPerformancePage />} />
            <Route path={PATHS.ADMIN_STATS} element={<AdminStatsPage />} />
            <Route path={PATHS.ADMIN_ACCOUNTS} element={<AdminAccountsPage />} />
            <Route path={PATHS.ADMIN_REPORTS} element={<AdminReportsPage />} />
            <Route path={PATHS.ADMIN_AUDIT} element={<AdminAuditLogsPage />} />
            {/* FP-80 관리자 비밀번호 변경 — 탭이 아니라 헤더의 [비밀번호 변경]으로 들어온다 */}
            <Route path={ADMIN_PATHS.PASSWORD} element={<AdminPasswordPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
