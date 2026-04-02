import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getEvents } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { FiMapPin, FiSearch, FiArrowRight, FiEye } from 'react-icons/fi'
import Button from '../components/ui/Button'
import './Events.css'

const Events = () => {
  const { userProfile } = useAuth()
  const [events, setEvents] = useState([])
  const [filteredEvents, setFilteredEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeGenre, setActiveGenre] = useState('all')

  useEffect(() => {
    const data = getEvents()
    setEvents(data)
    setFilteredEvents(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    let f = events
    if (searchTerm) f = f.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.location?.toLowerCase().includes(searchTerm.toLowerCase()))
    if (activeGenre !== 'all') f = f.filter(e => e.genre === activeGenre)
    setFilteredEvents(f)
  }, [searchTerm, activeGenre, events])

  const genres = ['all', 'techno', 'house', 'trance', 'hardstyle']

  if (loading) return (
    <div className="loading-container"><div className="loader"></div><p>Cargando eventos...</p></div>
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

        {/* Grid */}
        <div className="events-grid">
          {filteredEvents.map((event, i) => (
            <Link to={`/event/${event.id}`} key={event.id} className="event-card"
              style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="event-card-img">
                <img src={event.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800'}
                  alt={event.title} loading="lazy" />
                <div className="event-card-overlay">
                  <span className="event-card-cta"><FiArrowRight /></span>
                </div>
                {event.genre && <span className="event-genre-tag">{event.genre}</span>}
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
