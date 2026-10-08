import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEventsByOrganizer, getTicketsByEvent, sumRevenue } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiPlus, FiMapPin, FiCalendar, FiUsers, FiBarChart2, FiCrosshair, FiClock, FiEdit, FiActivity, FiEye } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import './Dashboard.css'

const MyEvents = () => {
  const { currentUser } = useAuth()
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (currentUser) {
      const load = async () => {
        const rawEvts = await getEventsByOrganizer(currentUser.id)
        const evts = []
        for (const e of rawEvts) {
          const t = await getTicketsByEvent(e.id)
          evts.push({ ...e, tickets: t.length, revenue: sumRevenue(t, e), pct: e.capacity ? Math.round((t.length / e.capacity) * 100) : 0 })
        }
        setEvents(evts)
      }
      load()
    }
  }, [currentUser])

  const now = new Date()
  // An event is "past" only once its full window (start + duration) has elapsed
  // — not at midnight of the event day. This matches the QR scanner's rule, so a
  // same-day event in progress still shows Scanner / Editar / En vivo.
  const hasEnded = (e) => {
    if (!e?.date) return false
    const [h, m] = (e.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
    const start = new Date(`${e.date}T00:00:00`)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + (e.duration || 6) * 3600000)
    return end < now
  }

  // The scanner's check-in window: from 2h before start until the event ends.
  // Only within this window does the Scanner button make sense (door is open).
  const canScan = (e) => {
    if (!e?.date) return false
    const [h, m] = (e.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
    const start = new Date(`${e.date}T00:00:00`)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + (e.duration || 6) * 3600000)
    const doorOpen = new Date(start.getTime() - 2 * 60 * 60 * 1000)
    return now >= doorOpen && now <= end
  }

  const filtered = filter === 'all' ? events
    : filter === 'upcoming' ? events.filter(e => !hasEnded(e))
    : events.filter(e => hasEnded(e))

  const upcoming = events.filter(e => !hasEnded(e)).length
  const past = events.filter(e => hasEnded(e)).length

  return (
    <div className="dash-page">
      <div className="container">
        <div className="dash-welcome">
          <div>
            <span className="dash-tag">Gestión de eventos</span>
            <h1 className="dash-title">Mis Eventos</h1>
          </div>
          {events.length > 0 && <Link to="/organizer/create-event"><Button icon={<FiPlus />}>Crear Evento</Button></Link>}
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
              const isPast = hasEnded(e)
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
                        <span className="me-mini-val">{'AUD $' + (e.revenue || 0).toLocaleString()}</span>
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
                      {/* Open the public (raver-facing) event page in a new tab */}
                      <Link to={`/event/${e.id}`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm" icon={<FiEye />}>Ver como raver</Button></Link>
                      {!isPast && <Link to={`/organizer/edit-event/${e.id}`}><Button variant="ghost" size="sm" icon={<FiEdit />}>Editar</Button></Link>}
                      {!isPast && <Link to={`/organizer/event/${e.id}/live`}><Button variant="ghost" size="sm" icon={<FiActivity />}>En vivo</Button></Link>}
                      {/* Scanner only the day of the event (door open) — not for future events */}
                      {canScan(e) && <Link to={`/organizer/scanner/${e.id}`}><Button size="sm" icon={<FiCrosshair />}>Scanner</Button></Link>}
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
          <div className="me-empty">
            <p className="me-empty-text">Aún no tienes eventos</p>
            <p className="me-empty-sub">Crea tu primer evento y conecta con tu audiencia</p>
            <Link to="/organizer/create-event"><Button size="lg">Crear evento</Button></Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyEvents
