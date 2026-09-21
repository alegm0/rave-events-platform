import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEvents, getGoingCount, getTicketsByUser, getUserSubscriptions } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { buildUserProfile, getRecommendations } from '../lib/ai/recommendations'
import { FiMapPin, FiSearch, FiArrowRight, FiEye, FiZap } from 'react-icons/fi'
import Button from '../components/ui/Button'
import { EventCardSkeleton } from '../components/ui/Skeleton'
import './Events.css'

const Events = () => {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeGenre, setActiveGenre] = useState('all')
  const [goingCounts, setGoingCounts] = useState({})
  const [recommendations, setRecommendations] = useState([])

  useEffect(() => {
    const loadEvents = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const data = (await getEvents()).filter(e => new Date(e.date) >= today)
      setEvents(data)
      setFilteredEvents(data)

      // Load going counts
      const counts = {}
      for (const e of data) {
        counts[e.id] = await getGoingCount(e.id)
      }
      setGoingCounts(counts)
      setLoading(false)
    }
    loadEvents()
  }, [])

  // AI Recommendations
  useEffect(() => {
    const loadRecs = async () => {
      if (!userProfile || events.length === 0) return
      try {
        const userTickets = await getTicketsByUser(userProfile.id)
        const userSubs = await getUserSubscriptions(userProfile.id)
        const goingAsTickets = userSubs.map(s => ({ eventId: s.eventId })) // treat subs as "interest"
        const profile = buildUserProfile(userTickets, goingAsTickets, events)
        if (profile) {
          const excludeIds = userTickets.map(t => t.eventId)
          const recs = getRecommendations(profile, events, excludeIds, 4)
          setRecommendations(recs.filter(r => r.score > 0.3))
        }
      } catch (err) {
        console.error('Recommendations error:', err)
      }
    }
    loadRecs()
  }, [userProfile, events])

  useEffect(() => {
    let f = events
    if (searchTerm) f = f.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.location?.toLowerCase().includes(searchTerm.toLowerCase()))
    if (activeGenre !== 'all') f = f.filter(e => e.genre?.toLowerCase().includes(activeGenre.toLowerCase()))
    setFilteredEvents(f)
  }, [searchTerm, activeGenre, events])

  const genres = ['all', 'techno', 'house', 'trance', 'hardstyle', 'drum & bass', 'minimal', 'ambient', 'acid']

  if (loading) return (
    <div className="events-page">
      <div className="events-hero"><div className="events-hero-bg"></div>
        <div className="container events-hero-content">
          <span className="events-hero-tag">Descubre la escena</span>
          <h1 className="events-hero-title">Eventos</h1>
        </div>
      </div>
      <div className="container" style={{ paddingTop: '2rem' }}>
        <div className="events-grid">{[1,2,3,4,5,6].map(i => <EventCardSkeleton key={i} />)}</div>
      </div>
    </div>
  )

  return (
    <div className="events-page">
      {/* Hero banner */}
      <div className="events-hero">
        <div className="events-hero-bg"></div>
        <div className="container events-hero-content">
          <span className="events-hero-tag">Descubre la escena</span>
          <h1 className="events-hero-title">Eventos</h1>
          <p className="events-hero-sub">Encuentra tu próxima experiencia sonora</p>
        </div>
      </div>

      <div className="container">
        {/* Organizer context */}
        {userProfile?.role === 'organizer' && (
          <div className="events-org-banner">
            <FiEye /> <span>Estás viendo la vista de raver</span>
            <Link to="/organizer/dashboard">Volver al Dashboard</Link>
          </div>
        )}

        {/* Filters */}
        <div className="events-filters">
          <div className="search-bar">
            <FiSearch className="search-icon" />
            <input type="text" placeholder="Buscar eventos, artistas, venues..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} className="search-input" />
          </div>
          <div className="genre-filters">
            {genres.map(g => (
              <button key={g} className={`genre-btn ${activeGenre === g ? 'active' : ''}`}
                onClick={() => setActiveGenre(g)}>
                {g === 'all' ? 'Todos' : g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="results-count">
          {filteredEvents.length} {filteredEvents.length === 1 ? 'evento' : 'eventos'}
        </div>

        {/* AI Recommendations */}
        {recommendations.length > 0 && searchTerm === '' && activeGenre === 'all' && (
          <div className="events-recs">
            <div className="events-recs-header">
              <h2><FiZap /> Recomendados para ti</h2>
              <span className="events-recs-badge">AI</span>
            </div>
            <div className="events-recs-grid">
              {recommendations.map(event => (
                <Link to={`/event/${event.id}`} key={event.id} className="events-rec-card">
                  <img src={event.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400'} alt="" />
                  <div className="events-rec-info">
                    <h4>{event.title}</h4>
                    <span>{new Date(event.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {event.location}</span>
                    <div className="events-rec-reasons">
                      {event.reasons.map((r, i) => <span key={i} className="events-rec-reason">{r}</span>)}
                    </div>
                  </div>
                  <div className="events-rec-score">{Math.round(event.score * 100)}%</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="events-grid">
          {filteredEvents.map((event, i) => (
            <Link to={`/event/${event.id}`} key={event.id}
              className={`event-card ${new Date(event.date) < new Date() ? 'event-card--past' : ''}`}
              style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="event-card-img">
                <img src={event.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800'}
                  alt={event.title} loading="lazy" />
                <div className="event-card-overlay">
                  <span className="event-card-cta"><FiArrowRight /></span>
                </div>
                {event.genre && <span className="event-genre-tag">{event.genre}</span>}
                {new Date(event.date) < new Date() && <span className="event-past-tag">Finalizado</span>}
              </div>
              <div className="event-card-body">
                <div className="event-card-date">
                  <span className="ecd-day">{new Date(event.date).getDate()}</span>
                  <span className="ecd-month">{new Date(event.date).toLocaleString('es', { month: 'short' }).toUpperCase()}</span>
                </div>
                <div className="event-card-info">
                  <h3>{event.title}</h3>
                  <p className="event-card-location"><FiMapPin /> {event.location}</p>
                  {event.time && <p className="event-card-time">{event.time}h</p>}
                  {goingCounts[event.id] > 0 && <p className="event-card-going">🎉 {goingCounts[event.id]} van</p>}
                </div>
                <div className="event-card-price">
                  {event.price === 0 ? 'Gratis' : `$${event.price}`}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <h3>No se encontraron eventos</h3>
            <p>Intenta con otros filtros o busca algo diferente</p>
            <Button onClick={() => { setSearchTerm(''); setActiveGenre('all') }}>Ver todos los eventos</Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Events
