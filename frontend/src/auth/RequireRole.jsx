import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, workspacePaths } from './context.js'
import RequestState from '../components/RequestState.jsx'

export default function RequireRole({ role }) {
  const { user, loading, error, refresh } = useAuth()
  if ((loading && !user) || error) return <section className="page-width section"><RequestState loading={loading} error={error} retry={refresh} /></section>
  if (!user) return <Navigate to="/dang-nhap" replace />
  if (role && user.role !== role) return <Navigate to={workspacePaths[user.role] || '/'} replace />
  return <Outlet />
}
