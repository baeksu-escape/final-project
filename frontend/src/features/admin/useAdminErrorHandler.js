import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../common/auth/useAuth.js'
import { PATHS } from '../../common/config/navigation.js'
import { ADMIN_ERROR_CODES } from './adminConstants.js'

// 첫 비밀번호를 정하지 않은 관리자가 관리자 API를 불렀을 때 로그인 화면에 띄울 알림.
const PASSWORD_CHANGE_REQUIRED_NOTICE = '비밀번호를 새로 정해야 합니다. 다시 로그인해 주세요.'

// FP-80 관리자 API 공통 오류 처리 훅 — 403 PASSWORD_CHANGE_REQUIRED면 로그아웃 후 로그인 화면으로 보내고 true를 돌려준다.
// 그 밖의 오류는 false를 돌려주므로 화면이 직접 문구를 보여 준다.
// 사용 예: catch (error) { if (await handleAdminError(error)) return; setError(error.message) }
export function useAdminErrorHandler() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(
    async (error) => {
      if (error?.data?.code !== ADMIN_ERROR_CODES.PASSWORD_CHANGE_REQUIRED) return false
      await logout({ notice: PASSWORD_CHANGE_REQUIRED_NOTICE })
      navigate(PATHS.LOGIN, { replace: true })
      return true
    },
    [logout, navigate],
  )
}
