import { Navigate } from 'react-router-dom'
import { getHomePath } from '../auth/accessRules.js'
import { useAuth } from '../auth/useAuth.js'

// '/'에 들어오면 역할·직군에 맞는 첫 화면으로 보낸다.
export default function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={getHomePath(user)} replace />
}
