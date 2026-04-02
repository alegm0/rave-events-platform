import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribe, isSubscribed, addNotification } from '../lib/db'
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

const SAMPLE_UPCOMING = [
  { id: 'cs1', title: 'ECLIPSE', teaser: 'Una experiencia audiovisual inmersiva que fusiona techno industrial con arte generativo en tiempo real.', launchDate: '2026-06-15', imageUrl: 'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=800&q=80' },
  { id: 'cs2', title: 'RESONANCE', teaser: 'Festival de 48 horas en una locación secreta. Tres escenarios. Sin teléfonos. Solo música.', launchDate: '2026-07-20', imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80' },
  { id: 'cs3', title: 'VOID', teaser: 'Sesión de deep techno en completa oscuridad. Experimenta el sonido sin distracciones visuales.', launchDate: '2026-08-10', imageUrl: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=800&q=80' },
]

const ComingSoon = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [events] = useState(SAMPLE_UPCOMING)
  const [subscribed, setSubscribed] = useState({})
  const [justSubscribed, setJustSubscribed] = useState(null)

  useEffect(() => {
    if (!currentUser) return
    const subs = {}
    events.forEach(e => { subs[e.id] = isSubscribed(currentUser.id, e.id) })
    setSubscribed(subs)
  }, [currentUser, events])

  const handleNotify = (event) => {
    if (!currentUser) { navigate('/login'); return }
    if (subscribed[event.id]) return

    subscribe(currentUser.id, event.id)
    addNotification(currentUser.id, {
      type: 'subscription',
      title: `Te suscribiste a ${event.title}`,
      message: `Te notificaremos cuando ${event.title} esté disponible para compra.`,
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
                    Notificarme
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
      </div>
    </div>
  )
}

export default ComingSoon
