import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ProtectedRoute = ({ children, requireOrganizer = false }) => {
  const { currentUser, userProfile } = useAuth()

  if (!currentUser) {
    return <Navigate to="/login" />
  }

  if (requireOrganizer && userProfile?.role !== 'organizer') {
    return <Navigate to="/" />
  }

  return children
}

export default ProtectedRoute
