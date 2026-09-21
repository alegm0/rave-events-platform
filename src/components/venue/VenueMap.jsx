import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getComfortProfile } from '../../lib/db'
import { getHighlights, buildVenuePlan, SERVICE_META } from '../../lib/venue'
import { FiDroplet, FiLogOut, FiHeart, FiMapPin, FiCornerUpRight } from 'react-icons/fi'
import { MdWc, MdChair, MdLocalHospital, MdMeetingRoom, MdSmokingRooms } from 'react-icons/md'
import WarehouseFloorPlan, { warehouseAnchors, warehouseRoute } from './floorplans/warehouse'
import './VenueMap.css'
import './floorplans/floorplan.css'

// Drawn floor plans by venue kind. When a venue matches, we render a real
// top-down plan instead of generic zone rectangles. Others fall back to tiles.
const FLOOR_PLANS = {
  warehouse: WarehouseFloorPlan,
}
const detectFloorPlan = (venue) => {
  const s = (venue?.setting || '').toLowerCase()
  if (s.includes('warehouse')) return 'warehouse'
  return null
}

// Concert-style seating-map look: solid tiled zones + clean pins.
// Coordinates are 0-100 (%), not geographic. Purely for orientation.

const SERVICE_ICONS = {
  entrance: <MdMeetingRoom />,
  water: <FiDroplet />,
  toilet: <MdWc />,
  firstaid: <MdLocalHospital />,
  rest: <MdChair />,
  smoking: <MdSmokingRooms />,
  exit: <FiLogOut />,
}

// Crisp glyphs drawn inside pins (SVG, ~4px box centered at 0,0).
const PIN_GLYPH = {
  water: <path d="M0-2C1.3-.4 2 .6 2 1.5a2 2 0 0 1-4 0C0 .6.7-.4 0-2z" />,
  toilet: <g><circle cx="-1.1" cy="-1.3" r=".7" /><path d="M-1.7-.5h1.2l.3 2h-1.8z" /><circle cx="1.1" cy="-1.3" r=".7" /><rect x=".5" y="-.5" width="1.2" height="2" rx=".2" /></g>,
  firstaid: <g><rect x="-.5" y="-1.8" width="1" height="3.6" rx=".2" /><rect x="-1.8" y="-.5" width="3.6" height="1" rx=".2" /></g>,
  rest: <g><rect x="-1.6" y="-.3" width="3.2" height=".9" rx=".2" /><rect x="-1.5" y=".4" width=".5" height="1.5" /><rect x="1" y=".4" width=".5" height="1.5" /><rect x="-1.9" y="-1.3" width=".5" height="1.1" /></g>,
  exit: <path d="M-1.8-1.8h2v1h-1v1.6h1v1h-2zM.8 0l1.4-1.1v.7h.9v.9h-.9v.7z" />,
  entrance: <path d="M-1.7-1.8h3v3.6h-3v-.8h2v-2h-2z" />,
  smoking: <g><rect x="-1.9" y="0.4" width="3" height="1.1" rx=".2" /><rect x="1.3" y="0.4" width=".6" height="1.1" rx=".2" /><rect x="-.4" y="-1.8" width=".5" height="1.8" /></g>,
}

const VenueMap = ({ venue }) => {
  const { currentUser } = useAuth()
  const [comfort, setComfort] = useState({})
  const [selected, setSelected] = useState(null) // { kind:'zone'|'service', data }

  useEffect(() => {
    if (!currentUser) return
    getComfortProfile(currentUser.id).then((p) => setComfort(p || {}))
  }, [currentUser])

  if (!venue || !venue.zones) return null

  const { serviceIds, zoneIds, reasons } = getHighlights(venue, comfort)
  const plan = buildVenuePlan(venue, comfort)
  const anyHighlight = serviceIds.size > 0 || zoneIds.size > 0
  const outdoor = venue.layout === 'outdoor'

  const selectZone = (z) => setSelected({ kind: 'zone', data: z })
  const selectService = (s) => setSelected({ kind: 'service', data: s })
  const selectPlanItem = (p) => {
    if (p.isZone) {
      const zone = venue.zones.find((z) => z.id === p.id)
      if (zone) selectZone(zone)
    } else {
      const svc = venue.services.find((s) => s.id === p.id) || p
      selectService(svc)
    }
  }

  const floorPlanKey = detectFloorPlan(venue)
  const FloorPlan = floorPlanKey ? FLOOR_PLANS[floorPlanKey] : null

  // Coordinates of the current selection, to draw a "you are here" route on the plan
  const selectedPoint = (() => {
    if (!selected) return null
    const d = selected.data
    if (selected.kind === 'service' && typeof d.x === 'number') return { x: d.x, y: d.y }
    if (selected.kind === 'zone' && typeof d.x === 'number') return { x: d.x + (d.w || 0) / 2, y: d.y + (d.h || 0) / 2 }
    // floor-plan zones may not carry x/w; map by id to an anchor
    if (FloorPlan && warehouseAnchors[d.id]) return warehouseAnchors[d.id]
    return null
  })()
  const origin = FloorPlan ? warehouseAnchors.entrance : null
  const routePts = FloorPlan && origin && selectedPoint ? warehouseRoute(origin, selectedPoint) : null
  const routeD = routePts ? routePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') : null

  return (
    <div className="venue">
      <div className="venue-head">
        <div>
          <h2 className="venue-title"><FiMapPin /> Mapa del venue</h2>
          <span className="venue-setting">{venue.setting}</span>
        </div>
        <span className="venue-layout-tag">{outdoor ? 'Al aire libre' : 'Interior'}</span>
      </div>

      <div className="venue-map-wrap">
        <svg viewBox="0 0 100 100" className={`venue-svg ${outdoor ? 'is-outdoor' : 'is-indoor'}`}
          preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plano del venue">
          <defs>
            <filter id="vm-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Drawn floor plan (base layer) when we have one for this venue kind */}
          {FloorPlan && <FloorPlan />}

          {/* Route from entrance to the selected point (floor-plan venues) */}
          {routeD && (
            <>
              <path d={routeD} className="fpm-route-shadow" />
              <path d={routeD} className="fpm-route" />
              <g transform={`translate(${origin.x} ${origin.y})`} className="fpm-here">
                <circle r="3.2" className="fpm-here-pulse" />
                <circle r="1.5" className="fpm-here-dot" />
              </g>
            </>
          )}

          {/* Generic zone tiles — only when there is no drawn floor plan */}
          {!FloorPlan && venue.zones.map((z) => {
            const hl = zoneIds.has(z.id)
            const sel = selected?.kind === 'zone' && selected.data.id === z.id
            const dim = selected && !sel
            const isStage = z.type === 'stage'
            return (
              <g key={z.id}
                 className={`vm-zone-g ${hl ? 'is-hl' : ''} ${sel ? 'is-sel' : ''} ${dim ? 'is-dim' : ''}`}
                 onClick={() => selectZone(z)} style={{ cursor: 'pointer' }}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="1.2"
                  className={`vm-zone vm-zone--${z.type}`} />
                {/* stage front-of-house bar */}
                {isStage && <rect x={z.x + 2} y={z.y + z.h - 3} width={z.w - 4} height="1.6" rx=".6" className="vm-stage-bar" />}
                <text x={z.x + z.w / 2} y={z.y + 5} className={`vm-zone-label ${isStage ? 'is-stage' : ''}`}
                  dominantBaseline="middle" textAnchor="middle">{z.label}</text>
              </g>
            )
          })}

          {/* service pins */}
          {venue.services.map((s) => {
            const hl = serviceIds.has(s.id)
            const sel = selected?.kind === 'service' && selected.data.id === s.id
            const dim = selected && !sel
            return (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}
                className={`vm-pin vm-pin--${s.type} ${hl ? 'is-hl' : ''} ${sel ? 'is-sel' : ''} ${dim ? 'is-dim' : ''} ${s.accessible ? 'is-acc' : ''}`}
                onClick={() => selectService(s)} style={{ cursor: 'pointer' }}>
                <path d="M0 3 C-2.4 .3 -3-1 -3-2.2 A3 3 0 0 1 3-2.2 C3-1 2.4 .3 0 3Z"
                  className="vm-pin-body" filter={hl || sel ? 'url(#vm-glow)' : undefined} />
                <circle cx="0" cy="-2.2" r="1.9" className="vm-pin-disc" />
                <g transform="translate(0 -2.2) scale(0.6)" className="vm-pin-glyph">{PIN_GLYPH[s.type]}</g>
                {s.accessible && <circle cx="2.1" cy="-4" r="1" className="vm-pin-acc" />}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Selection info panel (concert-map style) */}
      <div className={`vm-info ${selected ? 'is-active' : ''}`}>
        {selected ? (
          <>
            <div className="vm-info-icon">
              {selected.kind === 'service'
                ? (SERVICE_ICONS[selected.data.type] || <FiMapPin />)
                : <FiMapPin />}
            </div>
            <div className="vm-info-body">
              <strong>{selected.data.label}</strong>
              <span>
                {selected.kind === 'zone'
                  ? (selected.data.type === 'stage' ? 'Escenario' : selected.data.type === 'quiet' ? 'Zona tranquila' : 'Zona')
                  : SERVICE_META[selected.data.type]?.label}
                {selected.data.accessible && ' · accesible'}
                {typeof selected.data.walkMin === 'number' && selected.data.walkMin > 0 && ` · a ~${selected.data.walkMin} min`}
              </span>
            </div>
            {(zoneIds.has(selected.data.id) || serviceIds.has(selected.data.id)) && (
              <span className="vm-info-rec">Recomendado para ti</span>
            )}
          </>
        ) : (
          <span className="vm-info-hint">Toca una zona o un servicio para ver los detalles</span>
        )}
      </div>

      {/* Legend */}
      <div className="venue-legend">
        {Object.entries(SERVICE_META).map(([type, meta]) => (
          <span key={type} className="venue-legend-item">
            <span className={`venue-legend-pin venue-pin--${type}`} />
            {meta.label}
          </span>
        ))}
      </div>

      {/* My Venue Plan */}
      <div className="venue-plan">
        <div className="venue-plan-head">
          <h3>Tu plan del venue</h3>
          {anyHighlight && (
            <span className="venue-plan-because">Ajustado a: {reasons.join(' · ')}</span>
          )}
        </div>
        {FloorPlan && (
          <p className="venue-plan-tip"><FiMapPin /> Toca un paso para ver la ruta en el mapa</p>
        )}
        <ol className="venue-plan-list">
          {plan.map((p, i) => {
            const isSel = selected && selected.data.id === p.id
            return (
              <li key={`${p.id}-${i}`}>
                <button
                  type="button"
                  className={`venue-plan-item ${p.note ? 'is-note' : ''} ${isSel ? 'is-sel' : ''}`}
                  onClick={() => selectPlanItem(p)}
                >
                  <span className="venue-plan-step">{i + 1}</span>
                  <span className="venue-plan-icon">
                    {p.isZone ? <FiCornerUpRight /> : (SERVICE_ICONS[p.type] || <FiMapPin />)}
                  </span>
                  <span className="venue-plan-text">
                    <strong>{p.label}</strong>
                    {p.note && <em className="venue-plan-note">{p.note}</em>}
                  </span>
                  {typeof p.walkMin === 'number' && p.walkMin > 0 && (
                    <span className="venue-plan-walk">{p.walkMin} min</span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
        {!anyHighlight && (
          <p className="venue-plan-hint">
            <FiHeart /> Marca tus preferencias de comodidad y accesibilidad en tu perfil y el mapa
            resaltará lo que necesitas.
          </p>
        )}
      </div>
    </div>
  )
}

export default VenueMap
