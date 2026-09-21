import { useState, useEffect, useRef } from 'react'
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
    const load = async () => {
      const evts = await getEventsByOrganizer(currentUser.id)
      setEvents(evts)
      let rev = 0, tix = 0
      const enriched = []
      for (const e of evts) {
        const t = await getTicketsByEvent(e.id)
        tix += t.length
        rev += t.length * (e.price || 0)
        enriched.push({ ...e, tickets: t.length, revenue: t.length * (e.price || 0), pct: e.capacity ? Math.round((t.length / e.capacity) * 100) : 0 })
      }
      setEventsWithTickets(enriched)
      setStats({
        totalEvents: evts.length,
        totalRevenue: rev,
        totalTickets: tix,
        upcoming: evts.filter(e => new Date(e.date) > new Date()).length
      })
    }
    load()
  }, [currentUser])

  const hasEvents = events.length > 0
  const topEvent = eventsWithTickets.sort((a, b) => b.tickets - a.tickets)[0]

  // Generative art canvas
  const canvasRef = useRef(null)
  useEffect(() => {
    if (hasEvents || !canvasRef.current) return
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    let anim, t = 0
    const resize = () => { c.width = c.offsetWidth * 2; c.height = c.offsetHeight * 2 }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 80 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * 0.45 + 0.05,
      size: Math.random() * 2.5 + 0.8,
      speed: Math.random() * 0.002 + 0.001,
      offset: Math.random() * Math.PI * 2,
    }))

    const draw = () => {
      t++
      const w = c.width, h = c.height
      const cx = w * 0.5, cy = h * 0.5

      // Fade
      ctx.fillStyle = 'rgba(20,20,20,0.08)'
      ctx.fillRect(0, 0, w, h)

      // Heartbeat pulse — stronger boom
      const rawBeat = Math.sin(t * 0.03)
      const beat = Math.pow(Math.max(rawBeat, 0), 4) * 0.5 + 0.7
      const boom = Math.pow(Math.max(rawBeat, 0), 12) // sharp spike for the "boom"

      // Flash on boom
      if (boom > 0.3) {
        ctx.fillStyle = `rgba(255,61,0,${boom * 0.06})`
        ctx.fillRect(0, 0, w, h)
      }

      // Concentric frequency rings
      for (let ring = 0; ring < 10; ring++) {
        const baseR = (ring + 1) * w * 0.05
        const pulse = Math.sin(t * 0.025 - ring * 0.5) * 15
        const r = baseR + pulse
        const alpha = 0.04 + Math.sin(t * 0.02 + ring) * 0.03

        ctx.beginPath()
        ctx.arc(cx, cy, r * beat, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,61,0,${alpha})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Particles orbiting center
      particles.forEach((p, i) => {
        p.angle += p.speed
        const breathe = Math.sin(t * 0.02 + p.offset) * 0.5 + 0.5
        const d = p.dist * Math.min(w, h) * 0.5 * beat + Math.sin(t * 0.01 + p.offset) * 20
        const px = cx + Math.cos(p.angle) * d
        const py = cy + Math.sin(p.angle) * d
        const size = p.size * (0.6 + breathe)
        const alpha = 0.2 + breathe * 0.5

        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,${40 + breathe * 40},0,${alpha})`
        ctx.fill()

        // Glow
        ctx.beginPath()
        ctx.arc(px, py, size * 4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,61,0,${alpha * 0.06})`
        ctx.fill()

        // Connect to nearby particles
        for (let j = i + 1; j < Math.min(i + 8, particles.length); j++) {
          const b = particles[j]
          const bd = b.dist * Math.min(w, h) * 0.5 * beat + Math.sin(t * 0.01 + b.offset) * 20
          const bx = cx + Math.cos(b.angle) * bd
          const by = cy + Math.sin(b.angle) * bd
          const dist = Math.hypot(px - bx, py - by)
          if (dist < w * 0.1) {
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(bx, by)
            ctx.strokeStyle = `rgba(255,61,0,${0.05 * (1 - dist / (w * 0.1))})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })

      // Center glow — pulses with boom
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.2)
      grd.addColorStop(0, `rgba(255,61,0,${0.1 + boom * 0.15})`)
      grd.addColorStop(0.5, `rgba(255,30,0,${0.03 + boom * 0.05})`)
      grd.addColorStop(1, 'transparent')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      anim = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize) }
  }, [hasEvents])

  return (
    <div className="dash-page">
      <div className="container">
        {/* Welcome */}
        <div className="dash-welcome">
          <div>
            <span className="dash-tag">Panel de organizador</span>
            <h1 className="dash-title">Hola, {userProfile?.displayName?.split(' ')[0] || 'Organizador'}</h1>
          </div>
          {hasEvents && <Link to="/organizer/create-event"><Button icon={<FiPlus />}>Crear Evento</Button></Link>}
        </div>

        {/* Onboarding */}
        {!hasEvents && (
          <div className="dash-onb-hero">
            <div className="dash-onb-content">
              <h2 className="dash-onb-title">Dale vida a tu evento</h2>
              <p className="dash-onb-sub">Conecta con tu audiencia, gestiona entradas y mide el impacto de tu experiencia sonora.</p>

              <div className="dash-onb-steps">
                <div className="dash-onb-step">
                  <div className="onb-step-num">1</div>
                  <div><h3>Diseña la experiencia</h3><p>Nombre, fecha, venue, line-up y la vibra</p></div>
                </div>
                <div className="dash-onb-step">
                  <div className="onb-step-num">2</div>
                  <div><h3>Conecta con ravers</h3><p>Entradas digitales, acceso instantáneo</p></div>
                </div>
                <div className="dash-onb-step">
                  <div className="onb-step-num">3</div>
                  <div><h3>Mide el impacto</h3><p>Check-in en puerta, analytics en vivo</p></div>
                </div>
              </div>

              <Link to="/organizer/create-event">
                <Button size="lg">Crear evento <FiArrowRight /></Button>
              </Link>
            </div>
            <div className="dash-onb-visual">
              <canvas ref={canvasRef} className="dash-onb-canvas" />
              <div className="dash-onb-quote">MUSIC IS THE ANSWER</div>
            </div>
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
