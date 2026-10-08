import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribe, isSubscribed, addNotification, getEvents } from '../lib/db'
import { FiBell, FiBellOff, FiCheck } from 'react-icons/fi'
import Button from '../components/ui/Button'
import './ComingSoon.css'

const Countdown = ({ target }) => {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 })
  useEffect(() => {
    const tick = () => {
      const diff = new Date(target) - new Date()
      if (diff <= 0) return
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return (
    <div className="cs-countdown">
      {[
        { v: time.d, l: 'Días' }, { v: time.h, l: 'Hrs' },
        { v: time.m, l: 'Min' }, { v: time.s, l: 'Seg' },
      ].map(({ v, l }) => (
        <div key={l} className="cs-cd-item">
          <span className="cs-cd-val">{String(v).padStart(2, '0')}</span>
          <span className="cs-cd-label">{l}</span>
        </div>
      ))}
    </div>
  )
}

const ComingSoon = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [subscribed, setSubscribed] = useState({})
  const [justSubscribed, setJustSubscribed] = useState(null)

  // "Próximamente" = the real events furthest out in the future. Their countdowns
  // run against real dates, so they actually tick down instead of sitting at 00.
  useEffect(() => {
    const load = async () => {
      const all = await getEvents()
      const now = new Date()
      const future = all
        .filter((e) => e.status === 'active' && new Date(`${e.date}T00:00:00`) > now)
        .sort((a, b) => new Date(b.date) - new Date(a.date)) // furthest first
        .slice(0, 4)
        .map((e) => ({
          id: e.id,
          title: e.title,
          teaser: e.description,
          launchDate: `${e.date}T${e.time || '22:00'}`,
          imageUrl: e.imageUrl,
        }))
      setEvents(future)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!currentUser || events.length === 0) return
    const load = async () => {
      const subs = {}
      for (const e of events) {
        subs[e.id] = await isSubscribed(currentUser.id, e.id)
      }
      setSubscribed(subs)
    }
    load()
  }, [currentUser, events])

  const handleNotify = async (event) => {
    if (!currentUser) { navigate('/login', { state: { from: location } }); return }
    if (subscribed[event.id]) return

    await subscribe(currentUser.id, event.id)
    await addNotification(currentUser.id, {
      type: 'subscription',
      title: `Te suscribiste a ${event.title}`,
      message: `Te avisaremos con novedades y recordatorios de ${event.title}.`,
      eventId: event.id,
      image: event.imageUrl,
    })
    setSubscribed(s => ({ ...s, [event.id]: true }))
    setJustSubscribed(event.id)
    setTimeout(() => setJustSubscribed(null), 3000)
  }

  return (
    <div className="cs-page">
      <div className="cs-hero">
        <div className="cs-hero-noise"></div>
        <div className="container cs-hero-content">
          <span className="cs-tag">Próximamente</span>
          <h1 className="cs-title">Lo que<br/>viene</h1>
          <p className="cs-sub">Eventos que están por anunciarse. Sé el primero en enterarte.</p>
        </div>
      </div>

      <div className="container">
        {loading ? (
          <div className="cs-list"><p style={{ color: 'rgba(255,255,255,0.4)', padding: '2rem 0' }}>Cargando próximos eventos...</p></div>
        ) : events.length === 0 ? (
          <div className="cs-list"><p style={{ color: 'rgba(255,255,255,0.4)', padding: '2rem 0' }}>No hay eventos próximos por ahora. Vuelve pronto.</p></div>
        ) : (
        <div className="cs-list">
          {events.map((event, i) => (
            <div key={event.id} className="cs-card" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="cs-card-visual">
                <img src={event.imageUrl} alt="" loading="lazy" />
                <div className="cs-card-visual-overlay"></div>
                <div className="cs-card-num">{String(i + 1).padStart(2, '0')}</div>
              </div>
              <div className="cs-card-content">
                <h2 className="cs-card-title">{event.title}</h2>
                <p className="cs-card-teaser">{event.teaser}</p>
                {event.launchDate && <Countdown target={event.launchDate} />}

                {subscribed[event.id] ? (
                  <div className="cs-subscribed">
                    <FiCheck /> Te notificaremos cuando esté disponible
                  </div>
                ) : (
                  <Button icon={<FiBell />} onClick={() => handleNotify(event)}>
                    {currentUser ? 'Notificarme' : 'Inicia sesión para que te avisemos'}
                  </Button>
                )}

                {justSubscribed === event.id && (
                  <div className="cs-toast">
                    <FiBell /> ¡Listo! Revisa tus notificaciones 🔔
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}

export default ComingSoon
