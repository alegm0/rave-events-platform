import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEventsByOrganizer, getTicketsByEvent } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiCalendar, FiDollarSign, FiUsers, FiPlus, FiBarChart2, FiArrowRight, FiZap, FiCrosshair, FiMapPin, FiTrendingUp } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import './Dashboard.css'

const Dashboard = () => {
  const { currentUser, userProfile } = useAuth()
  const [stats, setStats] = useState({ totalEvents: 0, totalRevenue: 0, totalTickets: 0, upcoming: 0 })
  const [events, setEvents] = useState([])
  const [eventsWithTickets, setEventsWithTickets] = useState([])

  useEffect(() => {
    if (!currentUser) return
    const evts = getEventsByOrganizer(currentUser.id)
    setEvents(evts)
    let rev = 0, tix = 0
    const enriched = evts.map(e => {
      const t = getTicketsByEvent(e.id)
      tix += t.length
      rev += t.length * (e.price || 0)
      return { ...e, tickets: t.length, revenue: t.length * (e.price || 0), pct: e.capacity ? Math.round((t.length / e.capacity) * 100) : 0 }
    })
    setEventsWithTickets(enriched)
    setStats({
      totalEvents: evts.length,
      totalRevenue: rev,
      totalTickets: tix,
      upcoming: evts.filter(e => new Date(e.date) > new Date()).length
    })
  }, [currentUser])

  const hasEvents = events.length > 0
  const topEvent = eventsWithTickets.sort((a, b) => b.tickets - a.tickets)[0]

  return (
    <div className="dash-page">
      <div className="container">
        {/* Welcome */}
        <div className="dash-welcome">
          <div>
            <span className="dash-tag">Panel de organizador</span>
            <h1 className="dash-title">Hola, {userProfile?.displayName?.split(' ')[0] || 'Organizador'}</h1>
          </div>
          <Link to="/organizer/create-event"><Button size="lg" icon={<FiPlus />}>Crear Evento</Button></Link>
        </div>

        {/* Onboarding */}
        {!hasEvents && (
          <div className="dash-onboarding">
            <div className="dash-onb-icon"><FiZap /></div>
            <h2>¡Bienvenido a RAVE!</h2>
            <p>Comienza creando tu primer evento. Es rápido y fácil.</p>
            <div className="dash-onb-steps">
              {[
                { n: '1', t: 'Crea tu evento', d: 'Agrega nombre, fecha, ubicación y precio' },
                { n: '2', t: 'Comparte', d: 'Los ravers podrán ver y comprar tickets' },
                { n: '3', t: 'Gestiona', d: 'Escanea QR en la puerta y ve tus analytics' },
              ].map(s => (
                <div key={s.n} className="dash-onb-step">
                  <span className="onb-num">{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
            <Link to="/organizer/create-event">
              <Button size="lg" icon={<FiPlus />}>Crear mi primer evento</Button>
            </Link>
          </div>
        )}

        {hasEvents && (
          <>
            {/* Stats */}
            <div className="dash-stats">
              {[
                { icon: <FiCalendar />, value: stats.totalEvents, label: 'Eventos', color: '#ff3d00' },
                { icon: <FiUsers />, value: stats.totalTickets, label: 'Tickets vendidos', color: '#4caf50' },
                { icon: <FiDollarSign />, value: `$${stats.totalRevenue.toLocaleString()}`, label: 'Ingresos', color: '#ff9800' },
                { icon: <FiTrendingUp />, value: stats.upcoming, label: 'Próximos', color: '#2196f3' },
              ].map((s, i) => (
                <div key={i} className="dash-stat-card">
                  <div className="dash-stat-top">
                    <div className="dash-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                    <span className="dash-stat-label">{s.label}</span>
                  </div>
                  <div className="dash-stat-val">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Featured event */}
            {topEvent && (
              <div className="dash-featured">
                <div className="dash-featured-img">
                  <img src={topEvent.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800'} alt="" />
                  <div className="dash-featured-overlay"></div>
                </div>
                <div className="dash-featured-content">
                  <span className="dash-featured-label">Evento destacado</span>
                  <h2 className="dash-featured-title">{topEvent.title}</h2>
                  <div className="dash-featured-meta">
                    <span><FiCalendar /> {new Date(topEvent.date).toLocaleDateString('es', { day: 'numeric', month: 'long' })}</span>
                    <span><FiMapPin /> {topEvent.location}</span>
                  </div>
                  <div className="dash-featured-stats">
                    <div><strong>{topEvent.tickets}</strong> tickets</div>
                    <div><strong>{'$' + topEvent.revenue.toLocaleString()}</strong> ingresos</div>
                    <div><strong>{topEvent.pct}%</strong> vendido</div>
                  </div>
                  <div className="dash-featured-bar">
                    <div className="dash-featured-bar-fill" style={{ width: `${Math.min(topEvent.pct, 100)}%` }}></div>
                  </div>
                  <div className="dash-featured-actions">
                    <Link to={`/organizer/event/${topEvent.id}/analytics`}><Button variant="ghost" size="sm" icon={<FiBarChart2 />}>Analytics</Button></Link>
                    <Link to={`/organizer/scanner/${topEvent.id}`}><Button size="sm" icon={<FiCrosshair />}>Scanner</Button></Link>
                  </div>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="dash-actions">
              <Link to="/organizer/create-event" className="dash-action-card">
                <div className="dash-action-icon"><FiPlus /></div>
                <div>
                  <strong>Crear Evento</strong>
                  <span>Publica un nuevo evento</span>
                </div>
              </Link>
              <Link to="/organizer/my-events" className="dash-action-card">
                <div className="dash-action-icon"><FiCalendar /></div>
                <div>
                  <strong>Mis Eventos</strong>
                  <span>{stats.totalEvents} eventos creados</span>
                </div>
              </Link>
              <Link to="/events" className="dash-action-card">
                <div className="dash-action-icon"><FiBarChart2 /></div>
                <div>
                  <strong>Explorar</strong>
                  <span>Ve qué hay en la escena</span>
                </div>
              </Link>
            </div>

            {/* All events */}
            {eventsWithTickets.length > 1 && (
              <div className="dash-section">
                <div className="dash-section-header">
                  <h2 className="dash-section-title">Todos los eventos</h2>
                  <Link to="/organizer/my-events" className="dash-see-all">Ver todos <FiArrowRight /></Link>
                </div>
                <div className="dash-events">
                  {eventsWithTickets.map(e => (
                    <Link to={`/organizer/event/${e.id}/analytics`} key={e.id} className="dash-event-row">
                      <img src={e.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200'} alt="" className="dash-event-thumb" />
                      <div className="dash-event-info">
                        <h3>{e.title}</h3>
                        <span>{new Date(e.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {e.location}</span>
                      </div>
                      <div className="dash-event-metrics">
                        <div className="dash-metric"><span className="dash-metric-val">{e.tickets}</span><span className="dash-metric-label">tickets</span></div>
                        <div className="dash-metric"><span className="dash-metric-val">{'$' + e.revenue}</span><span className="dash-metric-label">ingresos</span></div>
                        <div className="dash-metric">
                          <span className="dash-metric-val">{e.pct}%</span>
                          <span className="dash-metric-label">vendido</span>
                        </div>
                      </div>
                      <div className="dash-event-bar-mini">
                        <div style={{ width: `${Math.min(e.pct, 100)}%`, height: '100%', background: e.pct > 70 ? '#4caf50' : e.pct > 30 ? '#ff9800' : '#ff3d00' }}></div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard
