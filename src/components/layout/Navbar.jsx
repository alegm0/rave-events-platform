import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getNotifications, getUnreadCount, markAllRead } from '../../lib/db'
import { FiMenu, FiX, FiUser, FiLogOut, FiPlus, FiBell } from 'react-icons/fi'
import Button from '../ui/Button'
import './Navbar.css'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const { currentUser, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isOrg = userProfile?.role === 'organizer'

  const unread = currentUser ? getUnreadCount(currentUser.id) : 0
  const notifications = currentUser ? getNotifications(currentUser.id).slice(0, 8) : []

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setIsOpen(false); setShowNotifs(false) }, [location])

  const handleLogout = async () => {
    try { await logout(); navigate('/') } catch (e) { console.error(e) }
  }

  const handleBellClick = () => {
    setShowNotifs(!showNotifs)
    if (!showNotifs && currentUser && unread > 0) {
      markAllRead(currentUser.id)
    }
  }

  const isHome = location.pathname === '/'
  const isActive = (path) => location.pathname === path ? 'active' : ''

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''} ${isHome && !scrolled ? 'navbar--transparent' : ''}`}>
      <div className="container">
        <div className="navbar-content">
          <Link to={currentUser ? (isOrg ? '/organizer/dashboard' : '/events') : '/'} className="navbar-logo">
            <span className="logo-text">RAVE</span>
            <span className="logo-pulse"></span>
            {isOrg && currentUser && <span className="logo-role">ORG</span>}
          </Link>

          <div className="navbar-menu desktop-menu">
            {currentUser && isOrg ? (
              <>
                <Link to="/organizer/dashboard" className={`nav-link ${isActive('/organizer/dashboard')}`}>Dashboard</Link>
                <Link to="/organizer/my-events" className={`nav-link ${isActive('/organizer/my-events')}`}>Mis Eventos</Link>
                <Link to="/organizer/create-event" className={`nav-link ${isActive('/organizer/create-event')}`}>Crear Evento</Link>
                <Link to="/organizer/edit-brand" className={`nav-link ${isActive('/organizer/edit-brand')}`}>Mi Marca</Link>
                <Link to="/events" className={`nav-link ${isActive('/events')}`}>Explorar</Link>
              </>
            ) : (
              <>
                <Link to="/events" className={`nav-link ${isActive('/events')}`}>Eventos</Link>
                <Link to="/calendar" className={`nav-link ${isActive('/calendar')}`}>Calendario</Link>
                <Link to="/coming-soon" className={`nav-link ${isActive('/coming-soon')}`}>Próximamente</Link>
              </>
            )}
          </div>

          <div className="navbar-auth desktop-menu">
            {currentUser ? (
              <>
                {isOrg && <Link to="/organizer/create-event"><Button size="sm" icon={<FiPlus />}>Nuevo</Button></Link>}
                {!isOrg && <Link to="/my-tickets"><Button variant="ghost" size="sm">Mis Tickets</Button></Link>}

                {/* Notification bell */}
                <div className="notif-wrap">
                  <button className="notif-bell" onClick={handleBellClick} aria-label="Notificaciones">
                    <FiBell />
                    {unread > 0 && <span className="notif-badge">{unread}</span>}
                  </button>

                  {showNotifs && (
                    <div className="notif-dropdown">
                      <div className="notif-header">
                        <h4>Notificaciones</h4>
                        {notifications.length > 0 && <span>{notifications.length}</span>}
                      </div>
                      {notifications.length > 0 ? (
                        <div className="notif-list">
                          {notifications.map(n => (
                            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                              {n.image && <img src={n.image} alt="" className="notif-img" />}
                              <div className="notif-content">
                                <p className="notif-title">{n.title}</p>
                                <p className="notif-msg">{n.message}</p>
                                <span className="notif-time">{timeAgo(n.createdAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="notif-empty">
                          <FiBell />
                          <p>No tienes notificaciones</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Link to="/profile" className="user-avatar" title={userProfile?.displayName}><FiUser /></Link>
                <button onClick={handleLogout} className="logout-btn" aria-label="Cerrar sesión"><FiLogOut /></button>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Iniciar Sesión</Button></Link>
                <Link to="/register"><Button size="sm">Registrarse</Button></Link>
              </>
            )}
          </div>

          <button className="mobile-toggle" onClick={() => setIsOpen(!isOpen)} aria-label="Menú">
            {isOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>

        {isOpen && (
          <div className="mobile-menu">
            {currentUser && isOrg ? (
              <>
                <Link to="/organizer/dashboard" className="mobile-link">Dashboard</Link>
                <Link to="/organizer/my-events" className="mobile-link">Mis Eventos</Link>
                <Link to="/organizer/create-event" className="mobile-link"><FiPlus /> Crear Evento</Link>
                <Link to="/events" className="mobile-link">Explorar Eventos</Link>
              </>
            ) : (
              <>
                <Link to="/events" className="mobile-link">Eventos</Link>
                <Link to="/calendar" className="mobile-link">Calendario</Link>
                <Link to="/coming-soon" className="mobile-link">Próximamente</Link>
              </>
            )}
            {currentUser ? (
              <>
                {!isOrg && <Link to="/my-tickets" className="mobile-link">Mis Tickets</Link>}
                <Link to="/profile" className="mobile-link"><FiUser /> Perfil</Link>
                <button onClick={handleLogout} className="mobile-link logout"><FiLogOut /> Cerrar Sesión</button>
              </>
            ) : (
              <div className="mobile-auth">
                <Link to="/login"><Button variant="ghost" size="sm" fullWidth>Iniciar Sesión</Button></Link>
                <Link to="/register"><Button size="sm" fullWidth>Registrarse</Button></Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `Hace ${days}d`
}

export default Navbar
