import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../firebase/config'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { createUser, getUser, updateUser, seedData, backfillVenues, ensureFeaturedEvents, processSubscriptionReminders, loginUser as loginUserFromDb } from '../lib/db'

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
    // Seed data on first load, backfill venues, then upsert the live + Ibiza events
    seedData()
      .then(() => backfillVenues())
      .then(() => ensureFeaturedEvents())
      .catch(() => {})

    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in — fetch profile from Firestore
        const profile = await getUser(firebaseUser.uid)
        if (profile) {
          setCurrentUser(profile)
          setUserProfile(profile)
          processSubscriptionReminders(profile.id).catch(() => {})
        } else {
          // Profile doesn't exist yet (edge case)
          setCurrentUser({ id: firebaseUser.uid, email: firebaseUser.email })
          setUserProfile({ id: firebaseUser.uid, email: firebaseUser.email })
        }
      } else {
        // Check localStorage fallback for demo accounts
        const savedUserId = localStorage.getItem('rave_currentUser')
        if (savedUserId) {
          const user = await getUser(savedUserId)
          if (user) {
            setCurrentUser(user)
            setUserProfile(user)
            processSubscriptionReminders(user.id).catch(() => {})
          }
        } else {
          setCurrentUser(null)
          setUserProfile(null)
        }
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const register = async (email, password, displayName, role = 'user') => {
    try {
      // Try Firebase Auth first
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password)
      const userData = {
        id: firebaseUser.uid,
        email,
        displayName,
        role,
        favorites: [],
        stats: { eventsAttended: 0, totalSpent: 0 }
      }
      await createUser(userData)
      setCurrentUser(userData)
      setUserProfile(userData)
      return userData
    } catch (firebaseError) {
      // If email already in Firebase Auth, throw a clear error
      if (firebaseError.code === 'auth/email-already-in-use') {
        throw new Error('El correo ya está registrado. Intenta iniciar sesión.')
      }

      // Fallback for demo: create user in Firestore only
      try {
        const userData = {
          email, password, displayName, role,
          favorites: [],
          stats: { eventsAttended: 0, totalSpent: 0 }
        }
        const user = await createUser(userData)
        localStorage.setItem('rave_currentUser', user.id)
        setCurrentUser(user)
        setUserProfile(user)
        return user
      } catch (dbError) {
        // If Firestore also says email exists
        throw new Error(dbError.message || 'Error al crear la cuenta')
      }
    }
  }

  const login = async (email, password) => {
    try {
      // Try Firebase Auth first
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password)
      const profile = await getUser(firebaseUser.uid)
      if (profile) {
        setCurrentUser(profile)
        setUserProfile(profile)
        return profile
      }
    } catch (firebaseError) {
      // Fallback: check Firestore directly (for demo accounts)
    }

    // Fallback login for seeded demo accounts
    const user = await loginUserFromDb(email, password)
    localStorage.setItem('rave_currentUser', user.id)
    setCurrentUser(user)
    setUserProfile(user)
    return user
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('rave_currentUser')
    setCurrentUser(null)
    setUserProfile(null)
  }

  const updateProfile = async (data) => {
    if (!currentUser) return
    const updated = await updateUser(currentUser.id, data)
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
