import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTicketsByUser, getEventsByOrganizer, getTicketsByEvent, getEvent, sumRevenue } from '../lib/db'
import { FiUser, FiMail, FiCalendar, FiPlus, FiBarChart2, FiUsers, FiDollarSign, FiLogOut, FiArrowRight } from 'react-icons/fi'
import Button from '../components/ui/Button'
import ComfortProfile from '../components/ui/ComfortProfile'
import './Profile.css'

const Profile = () => {
  const { currentUser, userProfile, logout } = useAuth()
  const isOrg = userProfile?.role === 'organizer'
  const [loading, setLoading] = useState(true)
  const [orgEvents, setOrgEvents] = useState([])
  const [orgTickets, setOrgTickets] = useState(0)
  const [orgRevenue, setOrgRevenue] = useState(0)
  const [userTickets, setUserTickets] = useState([])
  const [ticketEvents, setTicketEvents] = useState({})
  const [eventTicketCounts, setEventTicketCounts] = useState({})

  useEffect(() => {
    const load = async () => {
      if (isOrg && currentUser) {
        const evts = await getEventsByOrganizer(currentUser.id)
        setOrgEvents(evts)
        let tix = 0, rev = 0
        const counts = {}
        for (const e of evts) {
          const t = await getTicketsByEvent(e.id)
          counts[e.id] = t.length
          tix += t.length
          rev += sumRevenue(t, e)
        }
        setEventTicketCounts(counts)
        setOrgTickets(tix)
        setOrgRevenue(rev)
      } else if (currentUser) {
        const tickets = await getTicketsByUser(currentUser.id)
        setUserTickets(tickets)
        const evtMap = {}
        for (const t of tickets.slice(0, 3)) {
          evtMap[t.eventId] = await getEvent(t.eventId)
        }
        setTicketEvents(evtMap)
      }
      setLoading(false)
    }
    load()
  }, [currentUser, isOrg])

  if (loading) return <div className="prof-page"><div className="container"><div className="loader"></div></div></div>

  return (
    <div className="prof-page">
      <div className="container">
        <span className="prof-tag">Tu cuenta</span>
        <h1 className="prof-title">Perfil</h1>

        <div className="prof-layout">
          {/* Left: User card */}
          <div className="prof-user-card">
            <div className="prof-avatar"><FiUser /></div>
            <h2 className="prof-name">{userProfile?.displayName || 'Usuario'}</h2>
            <p className="prof-email"><FiMail /> {currentUser?.email}</p>
            <span className={`prof-role ${isOrg ? 'prof-role--org' : ''}`}>
              {isOrg ? '🎛️ Organizador' : '🎧 Raver'}
            </span>
            <div className="prof-member">
              Miembro desde {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('es', { month: 'long', year: 'numeric' }) : 'N/A'}
            </div>
            <button className="prof-logout" onClick={logout}><FiLogOut /> Cerrar sesión</button>
          </div>

          {/* Right: Role-specific content */}
          <div className="prof-content">
            {isOrg ? (
              <>
                {/* Organizer stats */}
                <div className="prof-stats-grid">
                  {[
                    { icon: <FiCalendar />, val: orgEvents.length, label: 'Eventos creados', color: '#ff3d00' },
                    { icon: <FiUsers />, val: orgTickets, label: 'Tickets vendidos', color: '#4caf50' },
                    { icon: <FiDollarSign />, val: `$${orgRevenue.toLocaleString()}`, label: 'Ingresos totales', color: '#ff9800' },
                    { icon: <FiBarChart2 />, val: orgEvents.filter(e => new Date(e.date) > new Date()).length, label: 'Eventos activos', color: '#2196f3' },
                  ].map((s, i) => (
                    <div key={i} className="prof-stat-card">
                      <div className="prof-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                      <div>
                        <div className="prof-stat-val">{s.val}</div>
                        <div className="prof-stat-label">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick links */}
                {/* Brand profile */}
                <div className="prof-section-title">Perfil de marca</div>
                <div className="prof-brand-card">
                  <Link to={`/organizer/${currentUser?.id}`} className="prof-brand-preview">
                    <div className="prof-brand-logo">
                      {userProfile?.brand?.logo ? <img src={userProfile.brand.logo} alt="" /> : <span>{(userProfile?.displayName || '?')[0]}</span>}
                    </div>
                    <div>
                      <strong>{userProfile?.brand?.name || userProfile?.displayName}</strong>
                      <span>Ver perfil público →</span>
                    </div>
                  </Link>
                  <Link to="/organizer/edit-brand" className="prof-brand-edit">Editar perfil de marca</Link>
                </div>

                <div className="prof-section-title">Acciones rápidas</div>
                <div className="prof-quick-links">
                  <Link to="/organizer/dashboard" className="prof-quick-link">
                    <FiBarChart2 /> Dashboard <FiArrowRight className="prof-ql-arrow" />
                  </Link>
                  <Link to="/organizer/create-event" className="prof-quick-link">
                    <FiPlus /> Crear evento <FiArrowRight className="prof-ql-arrow" />
                  </Link>
                  <Link to="/organizer/my-events" className="prof-quick-link">
                    <FiCalendar /> Mis eventos <FiArrowRight className="prof-ql-arrow" />
                  </Link>
                </div>

                {/* Recent events */}
                {orgEvents.length > 0 && (
                  <>
                    <div className="prof-section-title">Últimos eventos</div>
                    <div className="prof-events-list">
                      {orgEvents.slice(0, 3).map(e => {
                        const tix = eventTicketCounts[e.id] || 0
                        return (
                          <Link to={`/organizer/event/${e.id}/analytics`} key={e.id} className="prof-event-item">
                            <img src={e.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200'} alt="" />
                            <div className="prof-event-info">
                              <h4>{e.title}</h4>
                              <span>{new Date(e.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {e.location}</span>
                            </div>
                            <div className="prof-event-tix">{tix} tickets</div>
                          </Link>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Attendee stats */}
                <div className="prof-stats-grid">
                  {[
                    { icon: <FiCalendar />, val: userTickets.length, label: 'Tickets comprados', color: '#ff3d00' },
                    { icon: <FiUsers />, val: userTickets.filter(t => t.status === 'used').length, label: 'Eventos asistidos', color: '#4caf50' },
                  ].map((s, i) => (
                    <div key={i} className="prof-stat-card">
                      <div className="prof-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                      <div>
                        <div className="prof-stat-val">{s.val}</div>
                        <div className="prof-stat-label">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick links */}
                <div className="prof-section-title">Acciones rápidas</div>
                <div className="prof-quick-links">
                  <Link to="/my-tickets" className="prof-quick-link">
                    <FiCalendar /> Mis tickets <FiArrowRight className="prof-ql-arrow" />
                  </Link>
                  <Link to="/events" className="prof-quick-link">
                    <FiBarChart2 /> Explorar eventos <FiArrowRight className="prof-ql-arrow" />
                  </Link>
                  <Link to="/calendar" className="prof-quick-link">
                    <FiCalendar /> Calendario <FiArrowRight className="prof-ql-arrow" />
                  </Link>
                </div>

                {/* Comfort & Accessibility Profile */}
                <div className="prof-section-title">Comodidad y accesibilidad</div>
                <ComfortProfile />

                {/* Recent tickets */}
                {userTickets.length > 0 && (
                  <>
                    <div className="prof-section-title">Últimos tickets</div>
                    <div className="prof-events-list">
                      {userTickets.slice(0, 3).map(t => {
                        const evt = ticketEvents[t.eventId]
                        return (
                          <Link to={`/ticket/${t.id}`} key={t.id} className="prof-event-item">
                            <img src={evt?.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200'} alt="" />
                            <div className="prof-event-info">
                              <h4>{evt?.title || 'Evento'}</h4>
                              <span>{evt?.date ? new Date(evt.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''}</span>
                            </div>
                            <span className={`prof-ticket-status ${t.status}`}>{t.status === 'valid' ? 'Válido' : 'Usado'}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
