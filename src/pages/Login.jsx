import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiMail, FiLock } from 'react-icons/fi'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import './Auth.css'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, currentUser, userProfile } = useAuth()
  const navigate = useNavigate()

  if (currentUser) return <Navigate to={userProfile?.role === 'organizer' ? '/organizer/dashboard' : '/events'} replace />

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(formData.email, formData.password)
      navigate(user.role === 'organizer' ? '/organizer/dashboard' : '/events')
    } catch (error) {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg"></div>
      <div className="container">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h1 className="auth-title">
                Bienvenido <span className="text-gradient">de Vuelta</span>
              </h1>
              <p className="auth-subtitle">Inicia sesión para acceder a tu cuenta</p>
            </div>

            {error && (
              <div className="error-alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <Input label="Correo Electrónico" type="email" name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                icon={<FiMail />}
                required
              />

              <Input label="Contraseña" type="password" name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                icon={<FiLock />}
                required
              />

              <Button 
                type="submit" 
                fullWidth 
                size="lg"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="auth-footer">
              <p>¿No tienes cuenta?</p>
              <Link to="/register" className="auth-link">Regístrate aquí</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
