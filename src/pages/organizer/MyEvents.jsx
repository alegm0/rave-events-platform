import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEventsByOrganizer, getTicketsByEvent } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiPlus, FiMapPin, FiCalendar, FiUsers, FiBarChart2, FiCrosshair, FiClock } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import './Dashboard.css'

const MyEvents = () => {
  const { currentUser } = useAuth()
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (currentUser) {
      const evts = getEventsByOrganizer(currentUser.id).map(e => {
        const t = getTicketsByEvent(e.id)
        return { ...e, tickets: t.length, revenue: t.length * (e.price || 0), pct: e.capacity ? Math.round((t.length / e.capacity) * 100) : 0 }
      })
      setEvents(evts)
    }
  }, [currentUser])

  const now = new Date()
  const filtered = filter === 'all' ? events
    : filter === 'upcoming' ? events.filter(e => new Date(e.date) >= now)
    : events.filter(e => new Date(e.date) < now)

  const upcoming = events.filter(e => new Date(e.date) >= now).length
  const past = events.filter(e => new Date(e.date) < now).length

  return (
    <div className="dash-page">
      <div className="container">
        <div className="dash-welcome">
          <div>
            <span className="dash-tag">Gestión de eventos</span>
            <h1 className="dash-title">Mis Eventos</h1>
          </div>
          <Link to="/organizer/create-event"><Button icon={<FiPlus />}>Crear Evento</Button></Link>
        </div>

        {events.length > 0 && (
          <div className="me-filters">
            {[
              { key: 'all', label: `Todos (${events.length})` },
              { key: 'upcoming', label: `Próximos (${upcoming})` },
              { key: 'past', label: `Pasados (${past})` },
            ].map(f => (
              <button key={f.key} className={`me-filter-btn ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="me-grid">
            {filtered.map(e => {
              const isPast = new Date(e.date) < now
              return (
                <div key={e.id} className={`me-card ${isPast ? 'me-card--past' : ''}`}>
                  <div className="me-card-img">
                    <img src={e.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600'} alt="" />
                    <div className="me-card-overlay">
                      <div className="me-card-badges">
                        <span className="me-card-genre">{e.genre || 'evento'}</span>
                        {isPast && <span className="me-card-past-badge">Finalizado</span>}
                        {!isPast && <span className="me-card-live-badge"><span className="me-live-dot"></span> Activo</span>}
                      </div>
                    </div>
                  </div>
                  <div className="me-card-body">
                    <h3 className="me-card-title">{e.title}</h3>
                    <div className="me-card-meta">
                      <span><FiCalendar /> {new Date(e.date).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}{e.time ? ` · ${e.time}` : ''}</span>
                      <span><FiMapPin /> {e.location}{e.city ? `, ${e.city}` : ''}</span>
                    </div>
                    <div className="me-card-stats">
                      <div className="me-mini-stat">
                        <span className="me-mini-val">{e.tickets}</span>
                        <span className="me-mini-label">tickets</span>
                      </div>
                      <div className="me-mini-stat">
                        <span className="me-mini-val">{'$' + e.revenue}</span>
                        <span className="me-mini-label">ingresos</span>
                      </div>
                      <div className="me-mini-stat">
                        <span className="me-mini-val" style={{ color: e.pct > 70 ? '#4caf50' : e.pct > 30 ? '#ff9800' : '#ff3d00' }}>{e.pct}%</span>
                        <span className="me-mini-label">vendido</span>
                      </div>
                    </div>
                    <div className="me-card-progress">
                      <div className="me-card-progress-bar" style={{ width: `${Math.min(e.pct, 100)}%`, background: e.pct > 70 ? '#4caf50' : e.pct > 30 ? '#ff9800' : '#ff3d00' }}></div>
                    </div>
                    <div className="me-card-actions">
                      <Link to={`/organizer/event/${e.id}/analytics`}><Button variant="ghost" size="sm" icon={<FiBarChart2 />}>Analytics</Button></Link>
                      {!isPast && <Link to={`/organizer/scanner/${e.id}`}><Button size="sm" icon={<FiCrosshair />}>Scanner</Button></Link>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : events.length > 0 ? (
          <div className="dash-empty">
            <p>No hay eventos {filter === 'upcoming' ? 'próximos' : 'pasados'}</p>
            <button className="me-filter-btn active" onClick={() => setFilter('all')} style={{ margin: '0 auto' }}>Ver todos</button>
          </div>
        ) : (
          <div className="dash-onboarding" style={{ marginTop: 0 }}>
            <div className="dash-onb-icon"><FiPlus /></div>
            <h2>Aún no tienes eventos</h2>
            <p>Crea tu primer evento y comienza a vender tickets.</p>
            <Link to="/organizer/create-event"><Button size="lg" icon={<FiPlus />}>Crear mi primer evento</Button></Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyEvents
