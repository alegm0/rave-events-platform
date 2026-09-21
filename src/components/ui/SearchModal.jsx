import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { searchAll } from '../../lib/db'
import { FiSearch, FiX, FiMapPin, FiCalendar } from 'react-icons/fi'
import './SearchModal.css'

const SearchModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ events: [], organizers: [] })
  const inputRef = useRef(null)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) { setQuery(''); setResults({ events: [], organizers: [] }); inputRef.current?.focus() }
  }, [isOpen])

  useEffect(() => {
    if (query.length < 2) { setResults({ events: [], organizers: [] }); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      const data = await searchAll(query)
      setResults(data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  const hasResults = results.events.length > 0 || results.organizers.length > 0

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <FiSearch className="search-input-icon" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar eventos, artistas, venues, organizadores..."
            className="search-modal-input" autoComplete="off" />
          <button className="search-close" onClick={onClose}><FiX /></button>
        </div>

        {query.length >= 2 && (
          <div className="search-results">
            {results.events.length > 0 && (
              <div className="search-group">
                <h4>Eventos ({results.events.length})</h4>
                {results.events.slice(0, 6).map(e => (
                  <Link to={`/event/${e.id}`} key={e.id} className="search-result" onClick={onClose}>
                    <img src={e.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200'} alt="" className="search-result-img" />
                    <div className="search-result-info">
                      <strong>{e.title}</strong>
                      <span><FiCalendar /> {new Date(e.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · <FiMapPin /> {e.location}</span>
                    </div>
                    <span className="search-result-price">{e.price === 0 ? 'Gratis' : `$${e.price}`}</span>
                  </Link>
                ))}
              </div>
            )}
            {results.organizers.length > 0 && (
              <div className="search-group">
                <h4>Organizadores ({results.organizers.length})</h4>
                {results.organizers.map(o => (
                  <Link to={`/organizer/${o.id}`} key={o.id} className="search-result" onClick={onClose}>
                    <div className="search-result-avatar">
                      {o.brand?.logo ? <img src={o.brand.logo} alt="" /> : <span>{(o.displayName || '?')[0]}</span>}
                    </div>
                    <div className="search-result-info">
                      <strong>{o.brand?.name || o.displayName}</strong>
                      {o.brand?.city && <span><FiMapPin /> {o.brand.city}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {!hasResults && <div className="search-empty">No se encontraron resultados para "{query}"</div>}
          </div>
        )}

        {query.length < 2 && (
          <div className="search-hint">Escribe al menos 2 caracteres para buscar</div>
        )}
      </div>
    </div>
  )
}

export default SearchModal
