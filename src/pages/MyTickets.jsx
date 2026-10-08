import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTicketsByUser, getEvent } from '../lib/db'
import { isEventLive } from '../lib/timetable'
import { useAuth } from '../context/AuthContext'
import { FiCalendar, FiMapPin, FiClock, FiArrowRight, FiRadio } from 'react-icons/fi'
import Button from '../components/ui/Button'
import './MyTickets.css'

const MyTickets = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    const loadTickets = async () => {
      // Always read fresh so a check-in done at the door (by the organizer) is
      // reflected here without waiting for the short cache to expire.
      const raw = await getTicketsByUser(currentUser.id, { fresh: true })
      const enriched = []
      for (const t of raw) {
        const event = await getEvent(t.eventId)
        enriched.push({ ...t, event })
      }
      setTickets(enriched.reverse())
      setLoading(false)
    }
    loadTickets()
  }, [currentUser])

  // Event finished? (start + duration in the past). Matches TicketDetail.
  const hasEnded = (ev) => {
    if (!ev?.date) return false
    const [h, m] = (ev.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
    const start = new Date(`${ev.date}T00:00:00`)
    start.setHours(h, m, 0, 0)
    return new Date(start.getTime() + (ev.duration || 6) * 3600000) < new Date()
  }

  // Three real buckets:
  //  - upcoming: valid ticket, event hasn't ended → still "próximo"
  //  - attended: scanned at the door (status used)
  //  - past: valid ticket but the event already ended (didn't attend / wasn't scanned)
  const upcoming = tickets.filter(t => t.status === 'valid' && !hasEnded(t.event))
  const attended = tickets.filter(t => t.status === 'used')
  const past = tickets.filter(t => t.status === 'valid' && hasEnded(t.event))
  const filtered = filter === 'all' ? tickets
    : filter === 'valid' ? upcoming
    : filter === 'used' ? attended
    : past

  if (loading) return <div className="mt-page"><div className="container"><div className="loader"></div></div></div>

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
              { key: 'valid', label: `Próximos (${upcoming.length})` },
              { key: 'used', label: `Asistidos (${attended.length})` },
              ...(past.length > 0 ? [{ key: 'past', label: `Pasados (${past.length})` }] : []),
            ].map(f => (
              <button key={f.key} className={`mt-filter ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="mt-list">
            {filtered.map(t => {
              // Past = the event has finished (start + duration), matching TicketDetail.
              const isPast = (() => {
                if (!t.event?.date) return false
                const [h, m] = (t.event.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
                const start = new Date(`${t.event.date}T00:00:00`)
                start.setHours(h, m, 0, 0)
                const end = new Date(start.getTime() + (t.event.duration || 6) * 3600000)
                return end < new Date()
              })()
              const live = t.event && isEventLive(t.event)
              return (
                <Link to={`/ticket/${t.id}`} key={t.id} className={`mt-ticket ${isPast ? 'mt-ticket--past' : ''} ${live ? 'mt-ticket--live' : ''}`}>
                  <div className="mt-ticket-img">
                    <img src={t.event?.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600'} alt="" />
                  </div>
                  <div className="mt-ticket-body">
                    <div className="mt-ticket-top">
                      {live ? (
                        <span className="mt-badge mt-badge-live"><span className="mt-live-dot" /> EN VIVO</span>
                      ) : (
                        <span className={`mt-badge ${t.status}`}>
                          {t.status === 'valid' ? (isPast ? 'Evento pasado' : '● Válido') : '✓ Asistido'}
                        </span>
                      )}
                      {t.event?.genre && <span className="mt-genre">{t.event.genre}</span>}
                    </div>
                    <h3 className="mt-ticket-title">{t.event?.title || 'Evento'}</h3>
                    <div className="mt-ticket-meta">
                      <span><FiCalendar /> {t.event?.date ? new Date(t.event.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                      <span><FiClock /> {t.event?.time || '23:00'}</span>
                      <span><FiMapPin /> {t.event?.location}</span>
                    </div>
                  </div>
                  <div className="mt-ticket-right">
                    {/* QR indicator is always present (the real QR is on the
                        ticket detail). For a live event we ALSO offer Rave Mode. */}
                    <div className="mt-ticket-qr-mini">QR</div>
                    {live ? (
                      <button
                        type="button"
                        className="mt-ravemode"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/rave-mode/${t.event.id}`) }}
                        title="Entrar a Rave Mode">
                        <FiRadio /> Rave Mode
                      </button>
                    ) : (
                      <span className="mt-ticket-arrow"><FiArrowRight /></span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : tickets.length > 0 ? (
          <div className="mt-empty">
            <p>No hay tickets {filter === 'valid' ? 'próximos' : filter === 'used' ? 'asistidos' : 'pasados'}</p>
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
