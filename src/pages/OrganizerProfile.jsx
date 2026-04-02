import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getUser, getEventsByOrganizer, getTicketsByEvent } from '../lib/db'
import { FiMapPin, FiCalendar, FiUsers, FiInstagram, FiGlobe, FiArrowRight } from 'react-icons/fi'
import Button from '../components/ui/Button'
import './OrganizerProfile.css'

const OrganizerProfile = () => {
  const { id } = useParams()
  const [org, setOrg] = useState(null)
  const [events, setEvents] = useState([])
  const [totalTickets, setTotalTickets] = useState(0)

  useEffect(() => {
    const user = getUser(id)
    if (user) {
      setOrg(user)
      const evts = getEventsByOrganizer(id)
      setEvents(evts)
      setTotalTickets(evts.reduce((sum, e) => sum + getTicketsByEvent(e.id).length + (e.ticketsSold || 0), 0))
    }
    window.scrollTo(0, 0)
  }, [id])

  if (!org) return <div className="op-loading"><div className="loader"></div></div>

  const brand = org.brand || {}
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date())
  const pastEvents = events.filter(e => new Date(e.date) < new Date())

  return (
    <div className="op-page">
      {/* Cover */}
      <div className="op-cover">
        <img src={brand.cover || 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=1200&q=80'} alt="" className="op-cover-img" />
        <div className="op-cover-fade"></div>
      </div>

      <div className="container">
        {/* Brand header */}
        <div className="op-header">
          <div className="op-logo">
            {brand.logo ? (
              <img src={brand.logo} alt="" />
            ) : (
              <span>{(brand.name || org.displayName || '?')[0]}</span>
            )}
          </div>
          <div className="op-header-info">
            <div className="op-verified">
              <h1 className="op-name">{brand.name || org.displayName}</h1>
              <span className="op-badge">✓ Organizador verificado</span>
            </div>
            {brand.city && <p className="op-city"><FiMapPin /> {brand.city}</p>}
            {brand.bio && <p className="op-bio">{brand.bio}</p>}
            <div className="op-socials">
              {brand.instagram && (
                <a href={`https://instagram.com/${brand.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="op-social">
                  <FiInstagram /> {brand.instagram}
                </a>
              )}
              {brand.website && (
                <a href={`https://${brand.website}`} target="_blank" rel="noopener noreferrer" className="op-social">
                  <FiGlobe /> {brand.website}
                </a>
              )}
            </div>
          </div>
          <div className="op-header-stats">
            <div className="op-hstat">
              <span className="op-hstat-val">{events.length}</span>
              <span className="op-hstat-label">Eventos</span>
            </div>
            <div className="op-hstat">
              <span className="op-hstat-val">{totalTickets.toLocaleString()}</span>
              <span className="op-hstat-label">Ravers</span>
            </div>
            {brand.founded && (
              <div className="op-hstat">
                <span className="op-hstat-val">{brand.founded}</span>
                <span className="op-hstat-label">Desde</span>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <div className="op-section">
            <h2 className="op-section-title">Próximos eventos</h2>
            <div className="op-events-grid">
              {upcomingEvents.map(e => (
                <Link to={`/event/${e.id}`} key={e.id} className="op-event-card">
                  <div className="op-event-img">
                    <img src={e.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600'} alt="" />
                    <div className="op-event-overlay">
                      <span className="op-event-genre">{e.genre}</span>
                    </div>
                  </div>
                  <div className="op-event-body">
                    <div className="op-event-date">
                      <span className="op-ed-day">{new Date(e.date).getDate()}</span>
                      <span className="op-ed-month">{new Date(e.date).toLocaleString('es', { month: 'short' }).toUpperCase()}</span>
                    </div>
                    <div className="op-event-info">
                      <h3>{e.title}</h3>
                      <span><FiMapPin /> {e.location}</span>
                    </div>
                    <div className="op-event-price">{e.price === 0 ? 'Gratis' : `$${e.price}`}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Past events */}
        {pastEvents.length > 0 && (
          <div className="op-section">
            <h2 className="op-section-title">Eventos anteriores</h2>
            <div className="op-past-grid">
              {pastEvents.map(e => (
                <Link to={`/event/${e.id}`} key={e.id} className="op-past-card">
                  <img src={e.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400'} alt="" />
                  <div className="op-past-info">
                    <h4>{e.title}</h4>
                    <span>{new Date(e.date).toLocaleDateString('es', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="op-empty">
            <p>Este organizador aún no tiene eventos publicados.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrganizerProfile
