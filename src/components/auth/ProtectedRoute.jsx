import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ProtectedRoute = ({ children, requireOrganizer = false }) => {
  const { currentUser, userProfile, loading } = useAuth()

  // While Firebase Auth is still restoring the session, don't decide anything:
  // redirecting here would bounce a logged-in user to /login on every reload.
  if (loading) return null

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (requireOrganizer && userProfile?.role !== 'organizer') {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
