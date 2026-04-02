import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getEvent, getTicketsByEvent } from '../../lib/db'
import { FiUsers, FiDollarSign, FiCheckCircle, FiClock } from 'react-icons/fi'
import './Dashboard.css'

const EventAnalytics = () => {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [stats, setStats] = useState({ total: 0, revenue: 0, checkedIn: 0, pending: 0 })

  useEffect(() => {
    const e = getEvent(id)
    if (e) {
      setEvent(e)
      const tickets = getTicketsByEvent(id)
      setStats({
        total: tickets.length,
        revenue: tickets.length * (e.price || 0),
        checkedIn: tickets.filter(t => t.status === 'used').length,
        pending: tickets.filter(t => t.status === 'valid').length,
      })
    }
  }, [id])

  if (!event) return <div className="loading-container"><div className="loader"></div></div>

  const pct = event.capacity ? Math.round((stats.total / event.capacity) * 100) : 0

  return (
    <div className="dash-page">
      <div className="container">
        <span className="dash-tag">Analytics</span>
        <h1 className="dash-title">{event.title}</h1>

        <div className="dash-stats" style={{ marginTop: '2rem' }}>
          {[
            { icon: <FiUsers />, value: stats.total, label: 'Tickets vendidos' },
            { icon: <FiDollarSign />, value: `$${stats.revenue}`, label: 'Ingresos' },
            { icon: <FiCheckCircle />, value: stats.checkedIn, label: 'Check-in' },
            { icon: <FiClock />, value: stats.pending, label: 'Pendientes' },
          ].map((s, i) => (
            <div key={i} className="dash-stat-card">
              <div className="dash-stat-icon">{s.icon}</div>
              <div className="dash-stat-val">{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2rem', background: '#141414', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Capacidad</span>
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{stats.total} / {event.capacity || 500}</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#ff3d00', transition: 'width 0.5s ease' }}></div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: '0.5rem', display: 'block' }}>{pct}% vendido</span>
        </div>
      </div>
    </div>
  )
}

export default EventAnalytics
