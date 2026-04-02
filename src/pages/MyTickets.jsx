import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTicketsByUser, getEvent } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { FiCalendar, FiMapPin, FiClock, FiArrowRight } from 'react-icons/fi'
import Button from '../components/ui/Button'
import './MyTickets.css'

const MyTickets = () => {
  const { currentUser } = useAuth()
  const [tickets, setTickets] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!currentUser) return
    const raw = getTicketsByUser(currentUser.id)
    setTickets(raw.map(t => ({ ...t, event: getEvent(t.eventId) })).reverse())
  }, [currentUser])

  const valid = tickets.filter(t => t.status === 'valid')
  const used = tickets.filter(t => t.status === 'used')
  const filtered = filter === 'all' ? tickets : filter === 'valid' ? valid : used

  return (
    <div className="mt-page">
      <div className="container">
        <div className="mt-header">
          <div>
            <span className="mt-tag">Tu colección</span>
            <h1 className="mt-title">Mis Tickets</h1>
          </div>
          <Link to="/events"><Button>Explorar Eventos</Button></Link>
        </div>

        {tickets.length > 0 && (
          <div className="mt-filters">
            {[
              { key: 'all', label: `Todos (${tickets.length})` },
              { key: 'valid', label: `Próximos (${valid.length})` },
              { key: 'used', label: `Asistidos (${used.length})` },
            ].map(f => (
              <button key={f.key} className={`mt-filter ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="mt-list">
            {filtered.map(t => {
              const isPast = t.event?.date ? new Date(t.event.date) < new Date() : false
              return (
                <Link to={`/ticket/${t.id}`} key={t.id} className={`mt-ticket ${isPast ? 'mt-ticket--past' : ''}`}>
                  <div className="mt-ticket-img">
                    <img src={t.event?.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600'} alt="" />
                  </div>
                  <div className="mt-ticket-body">
                    <div className="mt-ticket-top">
                      <span className={`mt-badge ${t.status}`}>
                        {t.status === 'valid' ? (isPast ? 'Evento pasado' : '● Válido') : '✓ Asistido'}
                      </span>
                      {t.event?.genre && <span className="mt-genre">{t.event.genre}</span>}
                    </div>
                    <h3 className="mt-ticket-title">{t.event?.title || 'Evento'}</h3>
                    <div className="mt-ticket-meta">
                      <span><FiCalendar /> {t.event?.date ? new Date(t.event.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}</span>
                      <span><FiClock /> {t.event?.time || '23:00'}</span>
                      <span><FiMapPin /> {t.event?.location}</span>
                    </div>
                  </div>
                  <div className="mt-ticket-right">
                    <div className="mt-ticket-qr-mini">QR</div>
                    <span className="mt-ticket-arrow"><FiArrowRight /></span>
                  </div>
                  <div className="mt-ticket-tear"></div>
                </Link>
              )
            })}
          </div>
        ) : tickets.length > 0 ? (
          <div className="mt-empty">
            <p>No hay tickets {filter === 'valid' ? 'próximos' : 'asistidos'}</p>
            <button className="mt-filter active" onClick={() => setFilter('all')}>Ver todos</button>
          </div>
        ) : (
          <div className="mt-empty">
            <div className="mt-empty-icon">🎫</div>
            <h3>Aún no tienes tickets</h3>
            <p>Explora eventos y compra tu primera entrada para vivir la experiencia</p>
            <Link to="/events"><Button size="lg">Explorar Eventos</Button></Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyTickets
