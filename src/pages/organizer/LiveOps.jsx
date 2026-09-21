import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getEvent, getTicketsByEvent, getUser, sumRevenue } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiActivity, FiUsers, FiCheckCircle, FiClock, FiCrosshair, FiBarChart2, FiXCircle, FiRefreshCw, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import './LiveOps.css'

// Live operations view for the organizer — the counterpart of the attendee's
// Rave Mode. While the door is open this is what the organizer watches: who is
// inside, who is still expected, and how fast people are coming in.
// Data comes from the tickets themselves (status / usedAt), polled on an interval.

const POLL_MS = 12000
const RATE_WINDOW_MIN = 15

const LiveOps = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [event, setEvent] = useState(null)
  const [tickets, setTickets] = useState([])
  const [names, setNames] = useState({})
  const [denied, setDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [auto, setAuto] = useState(true)
  const [tick, setTick] = useState(0) // re-render for the "hace Xs" label
  const namesRef = useRef({})

  // Resolve attendee names only for the check-ins we actually display.
  const resolveNames = useCallback(async (checkedIn) => {
    const missing = [...new Set(checkedIn.slice(0, 25).map(t => t.userId))]
      .filter(uid => uid && !namesRef.current[uid])
    if (missing.length === 0) return
    const entries = await Promise.all(missing.map(async uid => {
      const u = await getUser(uid)
      return [uid, u?.displayName || u?.email || 'Asistente']
    }))
    entries.forEach(([uid, name]) => { namesRef.current[uid] = name })
    setNames({ ...namesRef.current })
  }, [])

  const sync = useCallback(async () => {
    const tix = await getTicketsByEvent(id, { fresh: true })
    setTickets(tix)
    setLastSync(Date.now())
    const checkedIn = tix
      .filter(t => t.status === 'used')
      .sort((a, b) => new Date(b.usedAt || 0) - new Date(a.usedAt || 0))
    await resolveNames(checkedIn)
  }, [id, resolveNames])

  useEffect(() => {
    const load = async () => {
      const e = await getEvent(id)
      // Authorization by ownership, same rule as the scanner and analytics
      if (e && currentUser && e.organizerId !== currentUser.id) {
        setDenied(true)
        setLoading(false)
        return
      }
      setEvent(e)
      if (e) await sync()
      setLoading(false)
    }
    load()
  }, [id, currentUser, sync])

  useEffect(() => {
    if (!auto || denied || !event) return
    const poll = setInterval(() => { sync().catch(() => {}) }, POLL_MS)
    return () => clearInterval(poll)
  }, [auto, denied, event, sync])

  // Keeps the "hace Xs" label honest without re-querying Firestore
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (denied) return (
    <div className="lo-page">
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <FiXCircle size={48} style={{ color: '#ff3d00' }} />
        <h1 style={{ color: '#fff', marginTop: '1rem' }}>Acceso denegado</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
          Solo el organizador de este evento puede ver su operación en vivo.
        </p>
        <div style={{ marginTop: '1.5rem' }}>
          <Button onClick={() => navigate('/organizer/dashboard')}>Volver al dashboard</Button>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="loading-container"><div className="loader"></div></div>

  if (!event) return (
    <div className="lo-page">
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Evento no encontrado
      </div>
    </div>
  )

  const capacity = event.capacity || 0
  const sold = tickets.length
  const checkedInTickets = tickets
    .filter(t => t.status === 'used')
    .sort((a, b) => new Date(b.usedAt || 0) - new Date(a.usedAt || 0))
  const inside = checkedInTickets.length
  const pending = tickets.filter(t => t.status === 'valid').length
  const occupancy = capacity > 0 ? Math.round((inside / capacity) * 100) : 0
  const soldPct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0
  const revenue = sumRevenue(tickets, event)

  // Entry rate over the last window, from real check-in timestamps
  const cutoff = Date.now() - RATE_WINDOW_MIN * 60000
  const recentRate = checkedInTickets.filter(t => t.usedAt && new Date(t.usedAt).getTime() >= cutoff).length

  const startsAt = event.date && event.time ? new Date(`${event.date}T${event.time}`) : null
  const endsAt = startsAt ? new Date(startsAt.getTime() + (event.duration || 6) * 3600000) : null
  const now = new Date()
  const phase = !startsAt ? 'unknown'
    : now < startsAt ? 'before'
    : endsAt && now > endsAt ? 'after'
    : 'live'

  const secondsAgo = lastSync ? Math.floor((Date.now() - lastSync) / 1000) : null
  const oversold = capacity > 0 && sold > capacity

  return (
    <div className="lo-page">
      <div className="container">
        {/* Header */}
        <div className="lo-head">
          <div className="lo-head-left">
            <Link to="/organizer/my-events" className="lo-back"><FiArrowLeft /> Mis eventos</Link>
            <span className={`lo-phase lo-phase--${phase}`}>
              {phase === 'live' && <span className="lo-dot" />}
              {phase === 'live' ? 'En curso' : phase === 'before' ? 'Antes de abrir' : phase === 'after' ? 'Finalizado' : 'Sin horario'}
            </span>
            <h1 className="lo-title"><FiActivity /> Operación en vivo</h1>
            <p className="lo-event">{event.title} · {event.location}</p>
          </div>
          <div className="lo-head-actions">
            <button className={`lo-auto ${auto ? 'is-on' : ''}`} onClick={() => setAuto(a => !a)}>
              <FiRefreshCw /> {auto ? 'Auto' : 'Pausado'}
            </button>
            <Button variant="ghost" onClick={() => sync()} icon={<FiRefreshCw />}>Actualizar</Button>
            <Link to={`/organizer/scanner/${id}`}><Button icon={<FiCrosshair />}>Scanner</Button></Link>
          </div>
        </div>

        <p className="lo-sync">
          {secondsAgo === null ? 'Sin datos' :
            secondsAgo < 5 ? 'Actualizado ahora' : `Actualizado hace ${secondsAgo}s`}
          {auto && ` · se refresca cada ${POLL_MS / 1000}s`}
        </p>

        {oversold && (
          <div className="lo-alert">
            <FiAlertTriangle />
            <span>
              Hay {sold} tickets vendidos para un aforo de {capacity}. Revisa la capacidad del evento.
            </span>
          </div>
        )}

        {/* KPIs */}
        <div className="lo-stats">
          {[
            { icon: <FiCheckCircle />, value: inside, label: 'Dentro', color: '#4caf50' },
            { icon: <FiClock />, value: pending, label: 'Por llegar', color: '#ff9800' },
            { icon: <FiUsers />, value: capacity ? `${occupancy}%` : '—', label: 'Aforo ocupado', color: '#2196f3' },
            { icon: <FiActivity />, value: recentRate, label: `Entradas ${RATE_WINDOW_MIN} min`, color: '#ff3d00' },
          ].map((s, i) => (
            <div key={i} className="lo-stat">
              <div className="lo-stat-top">
                <div className="lo-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                <span className="lo-stat-label">{s.label}</span>
              </div>
              <div className="lo-stat-val">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Occupancy */}
        <div className="lo-panel">
          <div className="lo-panel-head">
            <h2>Aforo</h2>
            <span>{inside} dentro · {sold} vendidos · {capacity || '—'} de aforo</span>
          </div>
          <div className="lo-bar">
            <div className="lo-bar-fill lo-bar-fill--sold" style={{ width: `${Math.min(soldPct, 100)}%` }} />
            <div className="lo-bar-fill lo-bar-fill--inside" style={{ width: `${Math.min(occupancy, 100)}%` }} />
          </div>
          <div className="lo-bar-legend">
            <span><i className="lo-key lo-key--inside" /> Dentro ({occupancy}%)</span>
            <span><i className="lo-key lo-key--sold" /> Vendido ({soldPct}%)</span>
            <span className="lo-bar-rev">Ingresos: ${revenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Recent check-ins */}
        <div className="lo-panel">
          <div className="lo-panel-head">
            <h2>Últimos check-ins</h2>
            <Link to={`/organizer/event/${id}/analytics`} className="lo-link"><FiBarChart2 /> Ver analytics</Link>
          </div>
          {checkedInTickets.length === 0 ? (
            <p className="lo-empty">
              Todavía no hay check-ins. Valida entradas desde el scanner y aparecerán aquí.
            </p>
          ) : (
            <div className="lo-list">
              {checkedInTickets.slice(0, 25).map(t => (
                <div key={t.id} className="lo-row">
                  <span className="lo-row-name">{names[t.userId] || 'Asistente'}</span>
                  {t.tierName && <span className="lo-row-tier">{t.tierName}</span>}
                  <span className="lo-row-code">{t.qrCode}</span>
                  <span className="lo-row-time">
                    {t.usedAt
                      ? new Date(t.usedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LiveOps
