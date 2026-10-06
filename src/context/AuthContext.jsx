import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../firebase/config'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { createUser, getUser, updateUser, processSubscriptionReminders } from '../lib/db'

const AuthContext = createContext()

// The only roles the app recognises. Anything else falls back to 'user' so the
// role can never be a free-form value coming from the client.
const ALLOWED_ROLES = ['user', 'organizer']

// Firebase Auth error codes mapped to messages the user can act on.
const REGISTER_ERRORS = {
  'auth/email-already-in-use': 'El correo ya está registrado. Intenta iniciar sesión.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'El registro con correo y contraseña está desactivado en Firebase.'
}

const LOGIN_ERRORS = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.'
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
    // Listen to Firebase Auth state. Seeding the database is NOT done here: it
    // is a one-off task run locally with the Admin SDK (see scripts/seed.mjs),
    // never on every visitor's page load.
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
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const register = async (email, password, displayName, role = 'user') => {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password)
      const userData = {
        id: firebaseUser.uid,
        email,
        displayName,
        role: ALLOWED_ROLES.includes(role) ? role : 'user',
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
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password)
      const profile = await getUser(firebaseUser.uid)
      if (profile) {
        setCurrentUser(profile)
        setUserProfile(profile)
        return profile
      }
      // Authenticated but no Firestore profile yet — treat the Auth record as the
      // minimal profile so the session is still valid.
      const minimal = { id: firebaseUser.uid, email: firebaseUser.email }
      setCurrentUser(minimal)
      setUserProfile(minimal)
      return minimal
    } catch (firebaseError) {
      throw new Error(LOGIN_ERRORS[firebaseError.code] || 'No se pudo iniciar sesión. Inténtalo de nuevo.')
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (e) {
      // ignore
    }
    setCurrentUser(null)
    setUserProfile(null)
  }

  const updateProfile = async (data) => {
    if (!currentUser) return
    // `role` is not editable from the profile: promoting yourself to organizer
    // must not be a matter of sending a different field.
    const { role, password, ...safe } = data
    const updated = await updateUser(currentUser.id, safe)
    setCurrentUser(updated)
    setUserProfile(updated)
  }

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loading,
      register, login, logout, updateProfile
    }}>
      {loading ? (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0d0d0d'
        }}>
          <div className="loader" />
        </div>
      ) : children}
    </AuthContext.Provider>
  )
}
