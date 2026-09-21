import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../firebase/config'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import {
  createUser, getUser, updateUser, seedData, backfillVenues, ensureFeaturedEvents,
  processSubscriptionReminders, loginDemoUser, purgeStoredPasswords
} from '../lib/db'

const AuthContext = createContext()

// Firebase Auth error codes mapped to messages the user can act on.
const REGISTER_ERRORS = {
  'auth/email-already-in-use': 'El correo ya está registrado. Intenta iniciar sesión.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'El registro con correo y contraseña está desactivado en Firebase.'
}

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
      // Strip any plaintext `password` field left behind by older versions. The
      // users collection is world-readable (see firestore.rules), so this runs
      // on every boot until no document carries the field.
      .then(() => purgeStoredPasswords())
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
      // Registration goes through Firebase Auth only. There used to be a
      // Firestore-only fallback here, but it wrote the password in plaintext to
      // a world-readable document, so it is gone: a failed signup is now a
      // failed signup rather than a silently insecure account.
      throw new Error(REGISTER_ERRORS[firebaseError.code] || 'Error al crear la cuenta. Inténtalo de nuevo.')
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

    // Fallback login for seeded demo accounts (flagged `demo: true` in Firestore)
    const user = await loginDemoUser(email, password)
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
