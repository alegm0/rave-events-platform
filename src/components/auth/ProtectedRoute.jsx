import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ui/Toast'
import { useEffect } from 'react'

const ProtectedRoute = ({ children, requireOrganizer = false }) => {
  const { currentUser, userProfile, loading } = useAuth()
  const location = useLocation()
  const toast = useToast()

  // Tell the user WHY they were bounced out of an organizer-only page, instead
  // of silently dropping them on the home page. Runs as an effect so we don't
  // fire a toast during render.
  const blockedFromOrganizer = !loading && currentUser && requireOrganizer && userProfile?.role !== 'organizer'
  useEffect(() => {
    if (blockedFromOrganizer) toast.info('Esa sección es solo para organizadores.')
  }, [blockedFromOrganizer])

  // While Firebase Auth is still restoring the session, don't decide anything:
  // redirecting here would bounce a logged-in user to /login on every reload.
  if (loading) return null

  if (!currentUser) {
    // Remember where the user was heading so Login can send them back.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (blockedFromOrganizer) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
