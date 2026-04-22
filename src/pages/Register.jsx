import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiMail, FiLock, FiUser } from 'react-icons/fi'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import './Auth.css'

const Register = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, currentUser, userProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

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

    if (formData.password !== formData.confirmPassword) {
      return setError('Las contraseñas no coinciden')
    }
    if (formData.password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres')
    }

    setLoading(true)

    try {
      const user = await register(formData.email, formData.password, formData.displayName, formData.role)
      toast.success('¡Cuenta creada exitosamente!')
      navigate(formData.role === 'organizer' ? '/organizer/dashboard' : '/events')
    } catch (error) {
      setError('Error al crear la cuenta. El correo puede estar en uso.')
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
                Únete a la <span className="text-gradient">Escena</span>
              </h1>
              <p className="auth-subtitle">Crea tu cuenta para comenzar</p>
            </div>

            {error && (
              <div className="error-alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <Input label="Nombre Completo" type="text" name="displayName"
                value={formData.displayName} onChange={handleChange}
                placeholder="Tu nombre" icon={<FiUser />} required />
              <Input label="Correo Electrónico" type="email" name="email"
                value={formData.email} onChange={handleChange}
                placeholder="tu@correo.com" icon={<FiMail />} required />
              <Input label="Contraseña" type="password" name="password"
                value={formData.password} onChange={handleChange}
                placeholder="••••••••" icon={<FiLock />} required />
              <Input label="Confirmar Contraseña" type="password" name="confirmPassword"
                value={formData.confirmPassword} onChange={handleChange}
                placeholder="••••••••" icon={<FiLock />} required />

              <div className="role-selector">
                <label className="role-label">Quiero:</label>
                <div className="role-options">
                  <label className={`role-option ${formData.role === 'user' ? 'active' : ''}`}>
                    <input type="radio" name="role" value="user" checked={formData.role === 'user'} onChange={handleChange} />
                    <div className="role-emoji">🎧</div>
                    <span>Ir a Eventos</span>
                    <p className="role-desc">Compra tickets, ve eventos y gestiona tus entradas</p>
                  </label>
                  <label className={`role-option ${formData.role === 'organizer' ? 'active' : ''}`}>
                    <input type="radio" name="role" value="organizer" checked={formData.role === 'organizer'} onChange={handleChange} />
                    <div className="role-emoji">🎛️</div>
                    <span>Organizar Eventos</span>
                    <p className="role-desc">Crea eventos, vende tickets y analiza resultados</p>
                  </label>
                </div>
              </div>

              <Button type="submit" fullWidth size="lg" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
            </form>

            <div className="auth-footer">
              <p>¿Ya tienes cuenta?</p>
              <Link to="/login" className="auth-link">Inicia sesión aquí</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
