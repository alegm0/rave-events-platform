import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTicket, getEvent, getUser, cancelTicket } from '../lib/db'
import { QRCodeSVG } from 'qrcode.react'
import { FiCalendar, FiMapPin, FiClock, FiArrowLeft, FiUser, FiMusic, FiTrash2 } from 'react-icons/fi'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import './TicketDetail.css'

const TicketDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [ticket, setTicket] = useState(null)
  const [event, setEvent] = useState(null)
  const [showCancel, setShowCancel] = useState(false)
  const [organizer, setOrganizer] = useState(null)

  useEffect(() => {
    const load = async () => {
      const t = await getTicket(id)
      if (t) {
        setTicket(t)
        const e = await getEvent(t.eventId)
        setEvent(e)
        if (e) setOrganizer(await getUser(e.organizerId))
      }
    }
    load()
  }, [id])

  const handleCancel = async () => {
    const success = await cancelTicket(id)
    if (success) {
      toast.success('Ticket cancelado y reembolsado')
      navigate('/my-tickets')
    } else {
      toast.error('No se puede cancelar un ticket ya usado')
    }
  }

  if (!ticket) return <div className="td-loading"><div className="loader"></div></div>

  return (
    <div className="td-page">
      {/* Hero bg */}
      <div className="td-hero-bg">
        <img src={event?.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200'} alt="" />
        <div className="td-hero-fade"></div>
      </div>

      <div className="container">
        <button className="td-back" onClick={() => navigate(-1)}><FiArrowLeft /> Mis Tickets</button>

        <div className="td-layout">
          {/* Ticket card */}
          <div className="td-card">
            {/* Top section */}
            <div className="td-card-top">
              <div className="td-card-event-img">
                <img src={event?.imageUrl || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600'} alt="" />
                <div className="td-card-event-overlay"></div>
                <span className={`td-status ${ticket.status}`}>
                  {ticket.status === 'valid' ? '● Válido' : '✓ Usado'}
                </span>
              </div>

              <div className="td-card-info">
                {event?.genre && <span className="td-genre">{event.genre}</span>}
                <h1 className="td-event-name">{event?.title || 'Evento'}</h1>
                <div className="td-event-meta">
                  <div className="td-meta-item">
                    <FiCalendar />
                    <div>
                      <strong>{event?.date ? new Date(event.date).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</strong>
                      <span>{event?.time || '23:00'}{event?.duration ? ` · ${event.duration}h` : ''}</span>
                    </div>
                  </div>
                  <div className="td-meta-item">
                    <FiMapPin />
                    <div>
                      <strong>{event?.location}</strong>
                      <span>{event?.city || ''}{event?.address ? ` · ${event.address}` : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tear line */}
            <div className="td-tear">
              <div className="td-tear-circle td-tear-left"></div>
              <div className="td-tear-line"></div>
              <div className="td-tear-circle td-tear-right"></div>
            </div>

            {/* QR Section */}
            <div className="td-qr-section">
              <div className="td-qr-wrap">
                <QRCodeSVG id="qr-code" value={ticket.qrCode} size={220} bgColor="#ffffff" fgColor="#0d0d0d" level="H"
                  imageSettings={{ src: '', width: 0, height: 0 }} />
              </div>
              <p className="td-qr-code">{ticket.qrCode}</p>
              <p className="td-qr-hint">Muestra este código en la entrada del evento</p>
            </div>

            {/* Details */}
            <div className="td-details">
              <div className="td-detail-row">
                <span>Comprado</span>
                <span>{new Date(ticket.purchaseDate).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="td-detail-row">
                <span>Pagado</span>
                <span>
                  {/* What this attendee actually paid, not the current price */}
                  {(() => {
                    const paid = typeof ticket.pricePaid === 'number' ? ticket.pricePaid : event?.price
                    return paid === 0 ? 'Gratis' : `$${paid}`
                  })()}
                </span>
              </div>
              <div className="td-detail-row">
                <span>Tipo</span>
                <span>{ticket.tierName || 'Entrada General'}</span>
              </div>
              {event?.minAge && (
                <div className="td-detail-row">
                  <span>Edad mínima</span>
                  <span>+{event.minAge}</span>
                </div>
              )}
              <div className="td-detail-row">
                <span>ID</span>
                <span className="td-mono">{ticket.id}</span>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="td-sidebar">
            {/* Organizer */}
            {organizer && (
              <Link to={`/organizer/${organizer.id}`} className="td-org-card">
                <div className="td-org-logo">
                  {organizer.brand?.logo ? <img src={organizer.brand.logo} alt="" /> : <FiUser />}
                </div>
                <div>
                  <span className="td-org-label">Organizado por</span>
                  <strong>{organizer.brand?.name || organizer.displayName}</strong>
                </div>
              </Link>
            )}

            {/* Lineup */}
            {event?.lineup && event.lineup.length > 0 && (
              <div className="td-sidebar-card">
                <h3><FiMusic /> Line-up</h3>
                <div className="td-lineup">
                  {event.lineup.map((a, i) => (
                    <div key={i} className="td-artist">{typeof a === 'string' ? a : a.name}{typeof a === 'object' && a.time ? ` · ${a.time}` : ''}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="td-sidebar-card">
              <h3>Información importante</h3>
              <ul className="td-tips">
                <li>Presenta tu QR desde el celular o impreso</li>
                <li>Llega con tiempo, las filas pueden ser largas</li>
                <li>Lleva tu documento de identidad</li>
                {event?.minAge && <li>Evento para mayores de {event.minAge} años</li>}
                <li>El ticket es personal e intransferible</li>
              </ul>
            </div>

            {/* Cancel ticket */}
            {ticket.status === 'valid' && (
              <div className="td-sidebar-card">
                <h3><FiTrash2 /> Cancelar ticket</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Si no puedes asistir, puedes cancelar tu ticket.
                </p>
                <Button variant="ghost" fullWidth onClick={() => setShowCancel(true)} className="btn-danger-ghost">
                  Cancelar Ticket
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showCancel} onClose={() => setShowCancel(false)} title="Cancelar ticket" size="sm">
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ¿Estás seguro de cancelar tu ticket para <strong style={{ color: '#fff' }}>{event?.title}</strong>?
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="ghost" fullWidth onClick={() => setShowCancel(false)}>No, mantener</Button>
          <Button variant="danger" fullWidth onClick={handleCancel}>Sí, cancelar</Button>
        </div>
      </Modal>
    </div>
  )
}

export default TicketDetail
