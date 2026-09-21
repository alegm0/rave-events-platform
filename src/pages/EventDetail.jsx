import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getEvent, getEvents, createTicket, getUser, getTicketsByUser, addNotification, getReviewsByEvent, addReview, getAverageRating, markGoing, getGoingCount, isGoing, getGoingUsers, hasTiers, getTierStatus } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { FiCalendar, FiMapPin, FiClock, FiUsers, FiArrowLeft, FiShare2, FiCheck, FiMusic, FiArrowRight } from 'react-icons/fi'
import Button from '../components/ui/Button'
import CheckoutModal from '../components/ui/CheckoutModal'
import { useToast } from '../components/ui/Toast'
import SpotifyLineup from '../components/ai/SpotifyLineup'
import VenueMap from '../components/venue/VenueMap'
import PreRaveBrief from '../components/venue/PreRaveBrief'
import RaveCompanion from '../components/venue/RaveCompanion'
import './EventDetail.css'

const EventDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const toast = useToast()
  const [event, setEvent] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [purchased, setPurchased] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [alreadyOwned, setAlreadyOwned] = useState(false)
  const [relatedEvents, setRelatedEvents] = useState([])
  const [copied, setCopied] = useState(false)
  const [reviews, setReviews] = useState([])
  const [avgRating, setAvgRating] = useState(0)
  const [goingCount, setGoingCount] = useState(0)
  const [userGoing, setUserGoing] = useState(false)
  const [goingUsers, setGoingUsers] = useState([])
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)

  useEffect(() => {
    const load = async () => {
      const e = await getEvent(id)
      setEvent(e)
      if (e) {
        const all = (await getEvents()).filter(ev => ev.id !== id && ev.genre === e.genre).slice(0, 3)
        setRelatedEvents(all)
        // Check if user already owns a ticket
        if (currentUser) {
          const userTix = await getTicketsByUser(currentUser.id)
          setAlreadyOwned(userTix.some(t => t.eventId === id))
          setUserGoing(await isGoing(currentUser.id, id))
        }
        setReviews(await getReviewsByEvent(id))
        setAvgRating(await getAverageRating(id))
        setGoingCount(await getGoingCount(id))
        setGoingUsers((await getGoingUsers(id)).slice(0, 5))
      }
      window.scrollTo(0, 0)
    }
    load()
  }, [id])

  const [organizer, setOrganizer] = useState(null)
  useEffect(() => {
    const loadOrg = async () => {
      if (event) setOrganizer(await getUser(event.organizerId))
    }
    loadOrg()
  }, [event])

  const handlePurchase = () => {
    if (!currentUser) { navigate('/login'); return }
    setShowConfirm(true)
  }

  // Called by the checkout modal after a (simulated) successful payment.
  // Throws propagate so the modal can show duplicate / sold-out / tier errors.
  // The tier name is a hint: the data layer re-resolves which phase is on sale
  // and what it costs, so a stale price in the UI can never be charged.
  const completePurchase = async () => {
    await createTicket({
      eventId: id,
      userId: currentUser.id,
      tierName: activeTier?.name || null,
    })
    await markGoing(currentUser.id, id)
    await addNotification(currentUser.id, {
      type: 'purchase',
      title: `Ticket comprado: ${event.title}`,
      message: `Tu entrada para ${event.title} está lista. Revisa tu QR en Mis Tickets.`,
      eventId: id,
      image: event.imageUrl,
    })
    setPurchased(true)
    setAlreadyOwned(true)
    // Re-read the event so the phase counters and the capacity bar reflect the sale
    setEvent(await getEvent(id))
    toast.success('¡Ticket comprado exitosamente!')
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!event) return <div className="ed-loading"><div className="loader"></div></div>

  const soldCount = event.ticketsSold || 0
  const capacity = event.capacity || 500
  const available = capacity - soldCount
  const pct = Math.round((soldCount / capacity) * 100)
  // Pricing phases configured by the organizer. Only one is on sale at a time.
  const tiered = hasTiers(event)
  const tiers = tiered ? getTierStatus(event) : []
  const activeTier = tiers.find(t => t.active) || null
  const currentPrice = activeTier ? activeTier.price : event.price
  const allTiersSoldOut = tiered && !activeTier
  const isOrg = userProfile?.role === 'organizer' && event.organizerId === currentUser?.id
  const endTime = (() => {
    if (!event.date || !event.time) return null
    const start = new Date(event.date + 'T' + event.time)
    const end = new Date(start.getTime() + (event.duration || 6) * 3600000)
    return end
  })()

  return (
    <div className="ed-page">
      {/* Hero */}
      <div className="ed-hero">
        <img src={event.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1920'} alt=""
          className="ed-hero-img" style={{ objectPosition: `center ${event.imagePos || 50}%` }} />
        <div className="ed-hero-fade"></div>

        <div className="container ed-hero-top">
          <button className="ed-back" onClick={() => navigate(-1)}><FiArrowLeft /></button>
          <button className="ed-share" onClick={handleShare}>
            {copied ? <><FiCheck /> Copiado</> : <><FiShare2 /> Compartir</>}
          </button>
        </div>

        <div className="container ed-hero-bottom">
          <div className="ed-hero-tags">
            {event.genre && <span className="ed-tag ed-tag--genre">{event.genre}</span>}
            {event.minAge && <span className="ed-tag">+{event.minAge}</span>}
            {pct > 80 && <span className="ed-tag ed-tag--hot">🔥 Últimas entradas</span>}
          </div>
          <h1 className="ed-title">{event.title}</h1>
        </div>
      </div>

      <div className="container">
        <div className="ed-layout">
          {/* Main content */}
          <div className="ed-main">
            {/* Info bar */}
            <div className="ed-info-grid">
              <div className="ed-info-card">
                <FiCalendar className="ed-info-icon" />
                <div>
                  <strong>{new Date(event.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                  <span>{event.time}{endTime ? ` → ${endTime.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} ${endTime.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                </div>
              </div>
              <div className="ed-info-card">
                <FiMapPin className="ed-info-icon" />
                <div>
                  <strong>{event.location}</strong>
                  <span>{event.city || ''}{event.address ? ` · ${event.address}` : ''}</span>
                </div>
              </div>
              <div className="ed-info-card">
                <FiUsers className="ed-info-icon" />
                <div>
                  <strong>{soldCount} / {capacity}</strong>
                  <span>{pct}% vendido</span>
                </div>
              </div>
              {event.duration && (
                <div className="ed-info-card">
                  <FiClock className="ed-info-icon" />
                  <div>
                    <strong>{event.duration}h</strong>
                    <span>{event.duration > 20 ? 'Multi-día' : 'Duración'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Capacity bar */}
            <div className="ed-capacity">
              <div className="ed-capacity-bar">
                <div className="ed-capacity-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 80 ? '#ff3d00' : pct > 50 ? '#ff9800' : '#4caf50' }}></div>
              </div>
              <span className="ed-capacity-text">{available > 0 ? `${available} entradas disponibles` : 'Agotado'}</span>
            </div>

            {/* Description */}
            <div className="ed-section">
              <h2 className="ed-section-title">Sobre el evento</h2>
              <p className="ed-description">{event.description || 'Información del evento próximamente.'}</p>
            </div>

            {/* Organizer */}
            {organizer && (
              <div className="ed-section">
                <h2 className="ed-section-title">Organizador</h2>
                <Link to={`/organizer/${organizer.id}`} className="ed-organizer-card">
                  <div className="ed-org-logo">
                    {organizer.brand?.logo ? (
                      <img src={organizer.brand.logo} alt="" />
                    ) : (
                      <span>{(organizer.brand?.name || organizer.displayName || '?')[0]}</span>
                    )}
                  </div>
                  <div className="ed-org-info">
                    <h3>{organizer.brand?.name || organizer.displayName}</h3>
                    {organizer.brand?.city && <span><FiMapPin /> {organizer.brand.city}</span>}
                  </div>
                  <FiArrowRight className="ed-org-arrow" />
                </Link>
              </div>
            )}

            {/* Lineup */}
            {event.lineup && event.lineup.length > 0 && (
              <div className="ed-section" id="ed-lineup-section">
                <h2 className="ed-section-title"><FiMusic /> Line-up</h2>
                <div className="ed-lineup">
                  {event.lineup.map((artist, i) => {
                    const name = typeof artist === 'string' ? artist : artist.name
                    const time = typeof artist === 'object' ? artist.time : null
                    return (
                      <div key={i} className="ed-artist">
                        {time && <span className="ed-artist-time">{time}</span>}
                        <span className="ed-artist-num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="ed-artist-name">{name}</span>
                      </div>
                    )
                  })}
                </div>
                {/* AI-Curated Playlist & Style Fingerprint */}
                <SpotifyLineup lineup={event.lineup} />
              </div>
            )}

            {/* AI Pre-Rave Brief */}
            {event.venue && (
              <div className="ed-section">
                <PreRaveBrief
                  event={event}
                  onMeetLineup={() => document.getElementById('ed-lineup-section')?.scrollIntoView({ behavior: 'smooth' })}
                />
              </div>
            )}

            {/* Venue Experience Map */}
            {event.venue && (
              <div className="ed-section">
                {alreadyOwned && (
                  <button className="ed-ravemode-btn" onClick={() => navigate(`/rave-mode/${id}`)}>
                    <span className="ed-ravemode-pulse" />
                    Entrar a Rave Mode
                    <small>Vista simplificada para dentro del evento</small>
                  </button>
                )}
                <VenueMap venue={event.venue} />
              </div>
            )}

            {/* Related events */}
            {relatedEvents.length > 0 && (
              <div className="ed-section">
                <h2 className="ed-section-title">Eventos similares</h2>
                <div className="ed-related">
                  {relatedEvents.map(re => (
                    <Link to={`/event/${re.id}`} key={re.id} className="ed-related-card">
                      <img src={re.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400'} alt="" />
                      <div className="ed-related-info">
                        <h4>{re.title}</h4>
                        <span>{new Date(re.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {re.location}</span>
                      </div>
                      <span className="ed-related-price">{re.price === 0 ? 'Gratis' : `$${re.price}`}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Going section */}
            {goingCount > 0 && (
            <div className="ed-section">
              <h2 className="ed-section-title">🎉 {goingCount} {goingCount === 1 ? 'persona va' : 'personas van'}</h2>
              {goingUsers.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {goingUsers.map(u => (
                    <div key={u.id} style={{ padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                      {u.displayName}
                    </div>
                  ))}
                  {goingCount > 5 && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>+{goingCount - 5} más</span>}
                </div>
              )}
            </div>
            )}

            {/* Reviews — only for past events */}
            {new Date(event.date) < new Date() && (
            <div className="ed-section">
              <h2 className="ed-section-title">⭐ Reviews {avgRating > 0 && `(${avgRating}/5)`}</h2>
              {currentUser && !isOrg && !reviews.find(r => r.userId === currentUser.id) && (
                <div style={{ background: '#141414', padding: '1.25rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setReviewRating(n)}
                        style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', opacity: n <= reviewRating ? 1 : 0.3 }}>⭐</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" value={reviewText} onChange={e => setReviewText(e.target.value)}
                      placeholder="¿Cómo estuvo el evento?"
                      style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }} />
                    <Button size="sm" onClick={async () => {
                      if (!reviewText.trim()) return
                      const r = await addReview({ eventId: id, userId: currentUser.id, rating: reviewRating, text: reviewText, userName: currentUser.displayName })
                      if (r) { setReviews(prev => [r, ...prev]); setReviewText(''); setAvgRating(await getAverageRating(id)); toast.success('Review publicada') }
                      else toast.warning('Ya dejaste una review')
                    }}>Publicar</Button>
                  </div>
                </div>
              )}
              {reviews.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.04)' }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ background: '#141414', padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{r.userName || 'Anónimo'}</strong>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>{'⭐'.repeat(r.rating)}</span>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', lineHeight: 1.5 }}>{r.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Aún no hay reviews. ¡Sé el primero!</p>
              )}
            </div>
            )}
          </div>

          {/* Sidebar - Ticket purchase */}
          <div className="ed-sidebar">
            <div className="ed-ticket-box">
              {isOrg && (
                <div className="ed-org-badge">
                  <span>🎛️ Eres el organizador</span>
                  <Link to={`/organizer/event/${id}/analytics`}>Ver Analytics →</Link>
                </div>
              )}

              <div className="ed-price-row">
                <div className="ed-price">{currentPrice === 0 ? 'Gratis' : `$${currentPrice}`}</div>
                {currentPrice > 0 && (
                  <span className="ed-price-label">
                    {activeTier ? activeTier.name : 'por persona'}
                  </span>
                )}
              </div>

              {/* Pricing phases — the organizer's tiers, sold in order */}
              {tiered && (
                <div className="ed-tiers">
                  {tiers.map(t => (
                    <div key={t.name} className={`ed-tier ${t.active ? 'is-active' : ''} ${t.soldOut ? 'is-soldout' : ''}`}>
                      <div className="ed-tier-main">
                        <strong>{t.name}</strong>
                        <span>
                          {t.soldOut
                            ? 'Agotada'
                            : t.active
                              ? (t.remaining !== null ? `${t.remaining} disponibles` : 'En venta')
                              : 'Próxima fase'}
                        </span>
                      </div>
                      <span className="ed-tier-price">{t.price === 0 ? 'Gratis' : `$${t.price}`}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="ed-ticket-meta">
                <div className="ed-ticket-meta-item">
                  <span>Disponibles</span>
                  <strong>{available > 0 ? available : 'Agotado'}</strong>
                </div>
                <div className="ed-ticket-meta-item">
                  <span>Vendidos</span>
                  <strong>{soldCount}</strong>
                </div>
              </div>

              {purchased || alreadyOwned ? (
                <div className="ed-purchased">
                  <FiCheck size={24} />
                  <div>
                    <strong>{purchased ? '¡Ticket comprado!' : 'Ya tienes ticket'}</strong>
                    <p>Revisa tu ticket en "Mis Tickets"</p>
                  </div>
                  <Link to="/my-tickets"><Button fullWidth variant="ghost">Ver mis tickets</Button></Link>
                </div>
              ) : available > 0 && !allTiersSoldOut ? (
                <Button fullWidth size="lg" onClick={handlePurchase} disabled={purchasing || isOrg}>
                  {purchasing ? 'Procesando...' : isOrg ? 'No puedes comprar tu propio evento'
                    : activeTier ? `Comprar ${activeTier.name}` : 'Comprar Ticket'}
                </Button>
              ) : (
                <Button fullWidth size="lg" disabled>Agotado</Button>
              )}

              {!currentUser && !purchased && (
                <p className="ed-login-hint">
                  <Link to="/login">Inicia sesión</Link> para comprar tickets
                </p>
              )}

              <div className="ed-ticket-details">
                <div className="ed-ticket-detail"><span>Entrada digital</span><span>QR Code</span></div>
                <div className="ed-ticket-detail"><span>Validación</span><span>En puerta</span></div>
                {event.minAge && <div className="ed-ticket-detail"><span>Edad mínima</span><span>+{event.minAge}</span></div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase confirmation modal */}
      <CheckoutModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        event={event}
        tier={activeTier}
        onPaid={completePurchase}
      />

      {/* Rave Companion — rule-based, verified-data assistant */}
      {event.venue && <RaveCompanion event={event} />}
    </div>
  )
}

export default EventDetail
