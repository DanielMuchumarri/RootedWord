import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--green-deep)' }}>
        <div className="text-5xl animate-bounce">🌿</div>
      </div>
    )
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}
