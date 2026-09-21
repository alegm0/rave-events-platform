import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getEvent, getTicketsByEvent, getEventAttendees, deleteEvent, getReviewsByEvent, sumRevenue, hasTiers, getTierStatus } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiUsers, FiDollarSign, FiCheckCircle, FiClock, FiTrash2, FiEdit, FiCrosshair, FiXCircle, FiActivity } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import DynamicPricing from '../../components/ai/DynamicPricing'
import SentimentPanel from '../../components/ai/SentimentPanel'
import FraudDetection from '../../components/ai/FraudDetection'
import './Dashboard.css'

const EventAnalytics = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const toast = useToast()
  const [event, setEvent] = useState(null)
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState({ total: 0, revenue: 0, checkedIn: 0, pending: 0 })
  const [attendees, setAttendees] = useState([])
  const [reviews, setReviews] = useState([])
  const [showDelete, setShowDelete] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const e = await getEvent(id)
      // Authorization by ownership: only the event's organizer sees its analytics
      if (e && currentUser && e.organizerId !== currentUser.id) {
        setDenied(true)
        return
      }
      if (e) {
        setEvent(e)
        const tix = await getTicketsByEvent(id)
        setTickets(tix)
        setStats({
          total: tix.length,
          // Sum of what attendees actually paid, not tickets × current price
          revenue: sumRevenue(tix, e),
          checkedIn: tix.filter(t => t.status === 'used').length,
          pending: tix.filter(t => t.status === 'valid').length,
        })
        setAttendees(await getEventAttendees(id))
        setReviews(await getReviewsByEvent(id))
      }
    }
    load()
  }, [id, currentUser])

  const handleDelete = async () => {
    await deleteEvent(id)
    toast.success('Evento eliminado')
    navigate('/organizer/my-events')
  }

  if (denied) return (
    <div className="dash-page">
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <FiXCircle size={48} style={{ color: '#ff3d00' }} />
        <h1 style={{ color: '#fff', marginTop: '1rem' }}>Acceso denegado</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
          Solo el organizador de este evento puede ver sus analíticas.
        </p>
        <div style={{ marginTop: '1.5rem' }}>
          <Button onClick={() => navigate('/organizer/dashboard')}>Volver al dashboard</Button>
        </div>
      </div>
    </div>
  )

  if (!event) return <div className="loading-container"><div className="loader"></div></div>

  const pct = event.capacity ? Math.round((stats.total / event.capacity) * 100) : 0

  return (
    <div className="dash-page">
      <div className="container">
        <div className="dash-welcome">
          <div>
            <span className="dash-tag">Analytics</span>
            <h1 className="dash-title">{event.title}</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/organizer/edit-event/${id}`}><Button variant="ghost" icon={<FiEdit />}>Editar</Button></Link>
            <Link to={`/organizer/event/${id}/live`}><Button variant="ghost" icon={<FiActivity />}>En vivo</Button></Link>
            <Link to={`/organizer/scanner/${id}`}><Button icon={<FiCrosshair />}>Scanner</Button></Link>
            <Button variant="ghost" onClick={() => setShowDelete(true)} icon={<FiTrash2 />} className="btn-danger-ghost">Eliminar</Button>
          </div>
        </div>

        <div className="dash-stats">
          {[
            { icon: <FiUsers />, value: stats.total, label: 'Tickets vendidos', color: '#4caf50' },
            { icon: <FiDollarSign />, value: `$${stats.revenue}`, label: 'Ingresos', color: '#ff9800' },
            { icon: <FiCheckCircle />, value: stats.checkedIn, label: 'Check-in', color: '#2196f3' },
            { icon: <FiClock />, value: stats.pending, label: 'Pendientes', color: '#ff3d00' },
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

        {/* Capacity bar */}
        <div style={{ background: '#141414', padding: '1.5rem', marginBottom: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Capacidad</span>
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>{stats.total} / {event.capacity || 500}</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? '#ff3d00' : pct > 50 ? '#ff9800' : '#4caf50', transition: 'width 0.5s ease' }}></div>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: '0.4rem', display: 'block' }}>{pct}% vendido</span>
        </div>

        {/* Sales by pricing phase — only when the organizer configured tiers */}
        {hasTiers(event) && (
          <div className="dash-section" style={{ marginTop: '2rem' }}>
            <h2 className="dash-section-title">Ventas por fase</h2>
            <div className="dash-events">
              <div className="dash-event-row" style={{ gridTemplateColumns: '1fr auto auto auto', background: '#1a1a1a', fontWeight: 600, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <span>Fase</span><span>Precio</span><span>Vendidos</span><span>Estado</span>
              </div>
              {getTierStatus(event, tickets).map(t => (
                <div key={t.name} className="dash-event-row" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>{t.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>${t.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                    {t.sold}{t.qty > 0 ? ` / ${t.qty}` : ''}
                  </span>
                  <span style={{
                    padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                    background: t.active ? 'rgba(255,61,0,0.15)' : t.soldOut ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)',
                    color: t.active ? '#ff6d3a' : t.soldOut ? '#4caf50' : 'rgba(255,255,255,0.4)',
                  }}>{t.active ? 'En venta' : t.soldOut ? 'Agotada' : 'Pendiente'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendees list */}
        <div className="dash-section" style={{ marginTop: '2rem' }}>
          <h2 className="dash-section-title">Lista de asistentes ({attendees.length})</h2>
          {attendees.length > 0 ? (
            <div className="dash-events">
              <div className="dash-event-row" style={{ background: '#1a1a1a', fontWeight: 600, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <span>Nombre</span><span>Email</span><span>Estado</span><span>Fecha compra</span>
              </div>
              {attendees.map(a => (
                <div key={a.id} className="dash-event-row" style={{ gridTemplateColumns: '1fr 1fr auto auto' }}>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>{a.user?.displayName || 'Usuario'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem' }}>{a.user?.email || '—'}</span>
                  <span style={{
                    padding: '0.2rem 0.6rem', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                    background: a.status === 'used' ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.15)',
                    color: a.status === 'used' ? '#4caf50' : '#ff9800'
                  }}>{a.status === 'used' ? 'Check-in' : 'Pendiente'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                    {new Date(a.purchaseDate).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-empty"><p>Aún no hay asistentes</p></div>
          )}
        </div>
        {/* AI-Powered Analytics */}
        <DynamicPricing event={event} tickets={tickets} />
        <SentimentPanel reviews={reviews} />
        <FraudDetection tickets={tickets} allTickets={tickets} />
      </div>

      {/* Delete confirmation */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Eliminar evento" size="sm">
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ¿Estás seguro de eliminar <strong style={{ color: '#fff' }}>{event.title}</strong>? Esta acción no se puede deshacer. Se eliminarán todos los tickets asociados.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="ghost" fullWidth onClick={() => setShowDelete(false)}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={handleDelete}>Eliminar Evento</Button>
        </div>
      </Modal>
    </div>
  )
}

export default EventAnalytics
