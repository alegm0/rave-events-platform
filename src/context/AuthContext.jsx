import { createContext, useContext, useState, useEffect } from 'react'
import { createUser, loginUser, getUser, updateUser, seedData } from '../lib/db'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    seedData() // Seed sample events on first load
    const savedUserId = localStorage.getItem('rave_currentUser')
    if (savedUserId) {
      const user = getUser(savedUserId)
      if (user) {
        setCurrentUser(user)
        setUserProfile(user)
      }
    }
    setLoading(false)
  }, [])

  const register = async (email, password, displayName, role = 'user') => {
    const user = createUser({
      email, password, displayName, role,
      favorites: [],
      stats: { eventsAttended: 0, totalSpent: 0 }
    })
    localStorage.setItem('rave_currentUser', user.id)
    setCurrentUser(user)
    setUserProfile(user)
    return user
  }

  const login = async (email, password) => {
    const user = loginUser(email, password)
    localStorage.setItem('rave_currentUser', user.id)
    setCurrentUser(user)
    setUserProfile(user)
    return user
  }

  const logout = async () => {
    localStorage.removeItem('rave_currentUser')
    setCurrentUser(null)
    setUserProfile(null)
  }

  const updateProfile = (data) => {
    if (!currentUser) return
    const updated = updateUser(currentUser.id, data)
    setCurrentUser(updated)
    setUserProfile(updated)
  }

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loading,
      register, login, logout, updateProfile
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
