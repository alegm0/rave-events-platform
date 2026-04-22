import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { validateTicket, getEvent, getTicketsByEvent } from '../../lib/db'
import { FiCheckCircle, FiXCircle, FiCamera, FiType, FiUsers, FiArrowLeft } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import './QRScanner.css'

const QRScanner = () => {
  const { eventId } = useParams()
  const toast = useToast()
  const [mode, setMode] = useState('camera') // 'camera' or 'manual'
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState(null)
  const [scanCount, setScanCount] = useState(0)
  const [event, setEvent] = useState(null)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    const e = getEvent(eventId)
    setEvent(e)
    refreshStats()
    return () => stopCamera()
  }, [eventId])

  useEffect(() => {
    if (mode === 'camera') startCamera()
    else stopCamera()
    return () => stopCamera()
  }, [mode])

  const refreshStats = () => {
    const tickets = getTicketsByEvent(eventId)
    setStats({
      total: tickets.length,
      checkedIn: tickets.filter(t => t.status === 'used').length,
    })
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.warn('Cámara no disponible:', err)
      setMode('manual')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const handleValidate = (code) => {
    if (!code.trim()) return
    const res = validateTicket(code.trim(), eventId)
    setResult(res)
    setScanCount(c => c + (res.success ? 1 : 0))
    refreshStats()
    setManualCode('')

    // Auto-clear result after 3 seconds
    setTimeout(() => setResult(null), 3000)
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    handleValidate(manualCode)
  }

  return (
    <div className="scanner-page">
      {/* Header */}
      <div className="scanner-header">
        <div className="container">
          <Link to="/organizer/dashboard" className="scanner-back"><FiArrowLeft /> Dashboard</Link>
          <div className="scanner-event-info">
            <h1 className="scanner-title">Scanner de Entrada</h1>
            {event && <p className="scanner-event-name">{event.title}</p>}
          </div>
          <div className="scanner-live-stats">
            <div className="scanner-stat">
              <span className="scanner-stat-val">{stats.checkedIn}</span>
              <span className="scanner-stat-label">Check-in</span>
            </div>
            <div className="scanner-stat-divider"></div>
            <div className="scanner-stat">
              <span className="scanner-stat-val">{stats.total}</span>
              <span className="scanner-stat-label">Total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="scanner-layout">
          {/* Main scanner area */}
          <div className="scanner-main">
            {/* Mode toggle */}
            <div className="scanner-mode-toggle">
              <button className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')}>
                <FiCamera /> Cámara
              </button>
              <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>
                <FiType /> Manual
              </button>
            </div>

            {mode === 'camera' ? (
              <div className="scanner-camera-area">
                <div className="scanner-viewfinder">
                  <video ref={videoRef} className="scanner-video" playsInline muted />
                  <div className="scanner-crosshair">
                    <div className="crosshair-corner tl"></div>
                    <div className="crosshair-corner tr"></div>
                    <div className="crosshair-corner bl"></div>
                    <div className="crosshair-corner br"></div>
                  </div>
                  <div className="scanner-scan-line"></div>
                </div>
                <p className="scanner-camera-hint">
                  Apunta la cámara al código QR del raver
                </p>
                <p className="scanner-camera-sub">
                  Si la cámara no funciona, usa el modo manual
                </p>
              </div>
            ) : (
              <div className="scanner-manual-area">
                <div className="scanner-manual-icon">
                  <FiType size={40} />
                </div>
                <h3>Ingreso manual</h3>
                <p>Pide al raver el código que aparece debajo de su QR</p>
                <form onSubmit={handleManualSubmit} className="scanner-manual-form">
                  <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
                    placeholder="Ej: RAVE-M4X7K2P9..."
                    autoFocus autoComplete="off" />
                  <Button type="submit" disabled={!manualCode.trim()}>Validar</Button>
                </form>
              </div>
            )}

            {/* Result overlay */}
            {result && (
              <div className={`scanner-result ${result.success ? 'success' : 'error'}`}>
                <div className="scanner-result-icon">
                  {result.success ? <FiCheckCircle size={56} /> : <FiXCircle size={56} />}
                </div>
                <h2>{result.success ? '¡Acceso Concedido!' : 'Acceso Denegado'}</h2>
                <p>{result.message}</p>
              </div>
            )}
          </div>

          {/* Sidebar info */}
          <div className="scanner-sidebar">
            <div className="scanner-info-card">
              <h3>Cómo funciona</h3>
              <div className="scanner-how-steps">
                <div className="scanner-how-step">
                  <span>1</span>
                  <p>El raver muestra su QR desde la app o su ticket</p>
                </div>
                <div className="scanner-how-step">
                  <span>2</span>
                  <p>Escanea con la cámara o ingresa el código manualmente</p>
                </div>
                <div className="scanner-how-step">
                  <span>3</span>
                  <p>El sistema valida el ticket y marca la entrada</p>
                </div>
              </div>
            </div>

            <div className="scanner-info-card">
              <h3>Sesión actual</h3>
              <div className="scanner-session-stat">
                <span className="scanner-session-val">{scanCount}</span>
                <span>entradas validadas en esta sesión</span>
              </div>
              <div className="scanner-progress-wrap">
                <div className="scanner-progress-header">
                  <span>Capacidad del evento</span>
                  <span>{stats.checkedIn} / {event?.capacity || '—'}</span>
                </div>
                <div className="scanner-progress-bar">
                  <div className="scanner-progress-fill"
                    style={{ width: `${event?.capacity ? Math.min((stats.checkedIn / event.capacity) * 100, 100) : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRScanner
