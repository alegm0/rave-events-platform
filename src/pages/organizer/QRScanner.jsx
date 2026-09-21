import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { validateTicket, getEvent, getTicketsByEvent } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiCheckCircle, FiXCircle, FiCamera, FiType, FiUsers, FiArrowLeft } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import './QRScanner.css'

const QRScanner = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const toast = useToast()
  const [denied, setDenied] = useState(false)
  const [mode, setMode] = useState('camera') // 'camera' or 'manual'
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState(null)
  const [scanCount, setScanCount] = useState(0)
  const [event, setEvent] = useState(null)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const isProcessingRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      const e = await getEvent(eventId)
      // Authorization by ownership: only the event's organizer may scan it
      if (e && currentUser && e.organizerId !== currentUser.id) {
        setDenied(true)
        return
      }
      setEvent(e)
      await refreshStats()
    }
    load()
    return () => { stopCamera(); stopScanning() }
  }, [eventId, currentUser])

  useEffect(() => {
    if (mode === 'camera') {
      setCameraError(null)
      startCamera()
    } else {
      stopCamera()
      stopScanning()
    }
    return () => { stopCamera(); stopScanning() }
  }, [mode])

  const refreshStats = async () => {
    const tickets = await getTicketsByEvent(eventId)
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
        // Start scanning once video is playing
        videoRef.current.onloadedmetadata = () => {
          startScanning()
        }
      }
    } catch (err) {
      console.warn('Cámara no disponible:', err)
      setCameraError('No se pudo acceder a la cámara. Usa el modo manual.')
      setMode('manual')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  // QR Code detection using BarcodeDetector API (available in Chrome, Edge, Opera)
  // Falls back to canvas-based frame capture for manual analysis
  const startScanning = () => {
    if (scanIntervalRef.current) return

    // Try BarcodeDetector API first (native, no library needed)
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      scanIntervalRef.current = setInterval(async () => {
        if (isProcessingRef.current || !videoRef.current || videoRef.current.readyState < 2) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue
            if (code) {
              isProcessingRef.current = true
              await handleValidate(code)
              // Pause scanning for 3 seconds after a read
              setTimeout(() => { isProcessingRef.current = false }, 3000)
            }
          }
        } catch (e) {
          // Detection error, continue scanning
        }
      }, 250) // Scan 4 times per second
    } else {
      // Fallback: capture frames to canvas for visual feedback
      // Without BarcodeDetector, camera mode shows the feed but user needs manual entry
      // Show a hint that this browser doesn't support auto-scan
      setCameraError('Tu navegador no soporta escaneo automático. Usa Chrome o ingresa el código manualmente.')
    }
  }

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
  }

  const handleValidate = async (code) => {
    if (!code.trim()) return
    const res = await validateTicket(code.trim(), eventId)
    setResult(res)
    setScanCount(c => c + (res.success ? 1 : 0))
    await refreshStats()
    setManualCode('')

    if (res.success) toast.success('¡Entrada validada!')
    else toast.error(res.message)

    // Auto-clear result after 3 seconds
    setTimeout(() => setResult(null), 3000)
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    handleValidate(manualCode)
  }

  if (denied) {
    return (
      <div className="scanner-page">
        <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <FiXCircle size={48} style={{ color: '#ff3d00' }} />
          <h1 style={{ color: '#fff', marginTop: '1rem' }}>Acceso denegado</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
            Solo el organizador de este evento puede validar sus entradas.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Button onClick={() => navigate('/organizer/dashboard')}>Volver al dashboard</Button>
          </div>
        </div>
      </div>
    )
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
                {cameraError ? (
                  <p className="scanner-camera-hint" style={{ color: '#ff9800' }}>
                    {cameraError}
                  </p>
                ) : (
                  <>
                    <p className="scanner-camera-hint">
                      Apunta la cámara al código QR del raver
                    </p>
                    <p className="scanner-camera-sub">
                      El escaneo es automático · Si no funciona, usa el modo manual
                    </p>
                  </>
                )}
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
