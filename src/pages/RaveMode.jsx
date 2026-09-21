import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEvent, getComfortProfile } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { buildTimeline, getNowNext, minutesUntil, formatTime } from '../lib/timetable'
import { findServices, resolveDestination } from '../lib/venue'
import FloorPlanMap from '../components/venue/FloorPlanMap'
import { warehouseAnchors } from '../components/venue/floorplans/warehouse'
import { FiX, FiDroplet, FiLogOut, FiChevronLeft, FiArrowRight } from 'react-icons/fi'
import { MdWc, MdChair, MdLocalHospital, MdMusicNote, MdVolumeOff, MdSmokingRooms } from 'react-icons/md'
import './RaveMode.css'

// Rave Mode: a context switch, not a menu.
// Tap what you need → see WHERE you are and the route there on the floor plan.
// Minimal text, huge targets, designed for a dark, loud, moving context.

const ACTIONS = [
  { key: 'water', label: 'Agua', icon: <FiDroplet />, serviceType: 'water' },
  { key: 'toilet', label: 'Baños', icon: <MdWc />, serviceType: 'toilet' },
  { key: 'rest', label: 'Descanso', icon: <MdChair />, serviceType: 'rest' },
  { key: 'quiet', label: 'Zona tranquila', icon: <MdVolumeOff />, serviceType: null, zoneType: 'quiet' },
  { key: 'smoking', label: 'Fumar', icon: <MdSmokingRooms />, serviceType: 'smoking' },
  { key: 'firstaid', label: 'First Aid', icon: <MdLocalHospital />, serviceType: 'firstaid' },
  { key: 'exit', label: 'Salida', icon: <FiLogOut />, serviceType: 'exit' },
]

const RaveMode = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [event, setEvent] = useState(null)
  const [comfort, setComfort] = useState({})
  const [now, setNow] = useState(new Date())
  const [panel, setPanel] = useState(null) // { title, destination, note, walkMin }

  useEffect(() => {
    getEvent(id).then(setEvent)
    if (currentUser) getComfortProfile(currentUser.id).then((p) => setComfort(p || {}))
  }, [id, currentUser])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  if (!event) return <div className="rm rm--loading">Cargando…</div>

  const timeline = buildTimeline(event)
  const { current, next } = getNowNext(timeline, now)
  const venue = event.venue
  const minsToNext = next ? minutesUntil(next.start, now) : null

  // "You are here" = the main floor (in front of the main stage), where the crowd is.
  const origin = warehouseAnchors?.main || { x: 50, y: 30 }

  // Map a venue point (service or zone) to floor-plan coordinates.
  const pointFor = (item) => ({ x: item.x, y: item.y })

  // Open a service action → resolve the right destination + route
  const openService = (action) => {
    if (action.zoneType) {
      const zone = (venue?.zones || []).find((z) => z.type === action.zoneType)
      if (!zone) return
      const anchor = action.zoneType === 'quiet' ? warehouseAnchors.chill : { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 }
      setPanel({ title: zone.label, destination: { ...anchor, label: zone.label }, note: 'Zona de baja estimulación · abierta toda la noche', walkMin: 3 })
      return
    }
    const resolved = resolveDestination(venue, action.serviceType, comfort)
    if (!resolved) return
    const s = resolved.service
    setPanel({
      title: s.label,
      destination: { ...pointFor(s), label: s.label },
      note: resolved.reason,
      walkMin: s.walkMin,
      accessible: s.accessible,
    })
  }

  // Open the "next set for you" → route to its room
  const openNextSet = () => {
    if (!next) return
    // We don't store per-act stage, so route to the main floor's back room as a stand-in
    const room = (venue?.zones || []).find((z) => z.type === 'stage' && z.id !== 'main') || (venue?.zones || [])[0]
    const anchor = room?.id === 'second' ? warehouseAnchors.concrete : warehouseAnchors.main
    setPanel({
      title: next.name,
      subtitle: room ? room.label : null,
      destination: { ...anchor, label: room?.label || 'Escenario' },
      note: `Empieza a las ${formatTime(next.start)}`,
      walkMin: 3,
    })
  }

  return (
    <div className="rm">
      <div className="rm-top">
        <button className="rm-back" onClick={() => navigate(`/event/${id}`)} aria-label="Salir de Rave Mode">
          <FiChevronLeft /> Salir
        </button>
        <span className="rm-event">{event.title}</span>
      </div>

      {/* NOW */}
      <div className="rm-now">
        <span className="rm-label">Ahora</span>
        {current ? (
          <>
            <h1 className="rm-artist">{current.name}</h1>
            <span className="rm-time">{formatTime(current.start)}{next ? ` – ${formatTime(next.start)}` : ''}</span>
          </>
        ) : (
          <h1 className="rm-artist rm-artist--soon">{timeline[0] ? `Empieza ${timeline[0].name}` : 'Puertas abiertas'}</h1>
        )}
      </div>

      {/* NEXT FOR YOU — tappable, routes to the room */}
      {next && (
        <button className="rm-next" onClick={openNextSet}>
          <div className="rm-next-main">
            <span className="rm-next-label">Sigue para ti</span>
            <span className="rm-next-name">{next.name}</span>
          </div>
          <div className="rm-next-meta">
            <span className="rm-next-in">{minsToNext === 0 ? 'ahora' : `en ${minsToNext} min`}</span>
            <span className="rm-next-go">Llévame <FiArrowRight /></span>
          </div>
        </button>
      )}

      {/* Big action buttons */}
      <div className="rm-actions">
        {ACTIONS.map((a) => {
          if (a.serviceType && (!venue || findServices(venue, a.serviceType).length === 0)) return null
          if (a.zoneType && !(venue?.zones || []).some((z) => z.type === a.zoneType)) return null
          const acc = a.key === 'toilet' && comfort.accessibleToilets && hasAccessible(venue, 'toilet')
          return (
            <button key={a.key} className={`rm-action ${acc ? 'rm-action--acc' : ''}`} onClick={() => openService(a)}>
              <span className="rm-action-icon">{a.icon}</span>
              <span className="rm-action-label">{a.label}</span>
              {acc && <span className="rm-action-acc-tag">Accesible</span>}
            </button>
          )
        })}
      </div>

      {/* Context switch: floor plan with you-are-here + route */}
      {panel && (
        <div className="rm-panel-backdrop" onClick={() => setPanel(null)}>
          <div className="rm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="rm-panel-head">
              <div>
                <h2>{panel.title}</h2>
                {panel.subtitle && <span className="rm-panel-sub">{panel.subtitle}</span>}
              </div>
              <button onClick={() => setPanel(null)} aria-label="Cerrar"><FiX /></button>
            </div>

            <div className="rm-panel-meta">
              {typeof panel.walkMin === 'number' && panel.walkMin > 0 && (
                <span className="rm-panel-walk">{panel.walkMin} min a pie</span>
              )}
              {panel.note && <span className="rm-panel-note">{panel.note}</span>}
              {panel.accessible && <span className="rm-acc-badge">Accesible</span>}
            </div>

            <FloorPlanMap venue={venue} origin={origin} destination={panel.destination} compact />
          </div>
        </div>
      )}
    </div>
  )
}

const hasAccessible = (venue, type) =>
  (venue?.services || []).some((s) => s.type === type && s.accessible)

export default RaveMode
