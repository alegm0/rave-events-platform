import { SERVICE_EMOJI, ZONE_EMOJI } from '../../lib/venue'
import './floorplans/floorplan.css'

// Short, legible labels for the map chips — emoji alone is hard to read in a
// dark, moving context, so every service also shows its name.
const SERVICE_SHORT = {
  entrance: 'Entrada',
  bar: 'Bar',
  water: 'Agua',
  toilet: 'WC',
  firstaid: 'First Aid',
  rest: 'Respiro',
  smoking: 'Fumar',
  exit: 'Salida',
}

// Generic floor-plan renderer for Rave Mode: draws the REAL venue (perimeter +
// zones + services) for ANY venue type, with a pulsing "you are here" origin, a
// highlighted destination, and a simple orthogonal route between them. This is
// the in-event GPS: tap a service → see where you are and how to get there.
//
// Props:
//   venue       — event.venue (zones + services, coords 0-100%)
//   origin      — { x, y } "you are here" (default: centre of the main floor)
//   destination — { x, y, label } to route to (optional)
//   compact     — smaller styling for Rave Mode

const isBooth = (t) => t === 'booth' || t === 'stage'

// Pick a sensible "you are here": centre of the dance floor, else first zone,
// else the middle of the plan.
const defaultOrigin = (venue) => {
  const zones = venue?.zones || []
  const floor = zones.find((z) => z.type === 'floor') || zones.find((z) => isBooth(z.type)) || zones[0]
  if (floor && typeof floor.x === 'number') {
    return { x: floor.x + (floor.w || 0) / 2, y: floor.y + (floor.h || 0) / 2 }
  }
  return { x: 50, y: 45 }
}

// Route that hugs a perimeter corridor instead of cutting diagonally across the
// dance floor. We step out to the nearest side corridor, travel ALONG that
// corridor (vertical), then across the destination's corridor (horizontal) and
// in. Reads like "follow the edge of the room", which is how people actually
// move through a crowded venue — not a straight line through the pit.
const CORRIDOR = 8 // margin from the wall where people can walk
const buildRoute = (from, to) => {
  // Choose the side (left/right) closest to BOTH points so we route along one wall.
  const avgX = (from.x + to.x) / 2
  const railX = avgX < 50 ? CORRIDOR : 100 - CORRIDOR
  return [
    { x: from.x, y: from.y },     // you are here
    { x: railX, y: from.y },      // step out to the side corridor
    { x: railX, y: to.y },        // travel along the wall
    { x: to.x, y: to.y },         // into the destination
  ]
}

// Direction arrow for the FINAL leg of the route, so the user sees which way to
// head as they approach the destination.
const lastHeading = (pts) => {
  if (!pts || pts.length < 2) return 0
  const a = pts[pts.length - 2]
  const b = pts[pts.length - 1]
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

const FloorPlanMap = ({ venue, origin, destination, compact = false }) => {
  if (!venue || !venue.zones) return null

  const outdoor = venue.layout === 'outdoor'
  const from = origin && typeof origin.x === 'number' ? origin : defaultOrigin(venue)
  const routePts = destination ? buildRoute(from, destination) : null
  const routeD = routePts ? routePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') : null
  const heading = lastHeading(routePts)
  // Place the direction arrow a bit before the destination along the final leg.
  const arrowAt = routePts && routePts.length >= 2
    ? { x: (routePts[routePts.length - 2].x + destination.x) / 2, y: (routePts[routePts.length - 2].y + destination.y) / 2 }
    : null

  // Dim everything except the destination service/zone so the target pops.
  const destId = destination?.id

  return (
    <div className={`fpm fpm--generic ${compact ? 'fpm--compact' : ''}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
        className={`fpm-svg ${outdoor ? 'is-outdoor' : 'is-indoor'}`}
        role="img" aria-label="Plano del venue con tu ubicación y ruta">

        {/* perimeter */}
        <rect x="2" y="2" width="96" height="96" rx="2"
          className={`fpm-perimeter ${outdoor ? 'is-outdoor' : 'is-indoor'}`} />

        {/* zones */}
        {venue.zones.map((z) => {
          const booth = isBooth(z.type)
          return (
            <g key={z.id} className={`fpm-zone-g ${destId && destId === z.id ? 'is-dest' : ''}`}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={booth ? 0.8 : 1.4}
                className={`fpm-zone fpm-zone--${z.type}`} />
              <text x={z.x + z.w / 2} y={z.y + z.h / 2} className={`fpm-zone-label fpm-zone-label--${z.type}`}
                dominantBaseline="central" textAnchor="middle">
                {booth ? `${ZONE_EMOJI[z.type] || '🎧'} ${z.label}` : z.label}
              </text>
            </g>
          )
        })}

        {/* services as compact chips: emoji + short name (readable, not just an emoji) */}
        {venue.services.map((s) => {
          const isDest = destId && destId === s.id
          const short = SERVICE_SHORT[s.type] || ''
          const w = Math.max(11, 5 + short.length * 1.9)
          return (
            <g key={s.id} transform={`translate(${s.x} ${s.y})`}
              className={`fpm-svc ${isDest ? 'is-dest' : ''}`}>
              <rect x={-w / 2} y="-2.3" width={w} height="4.6" rx="0.9" className="fpm-svc-chip" />
              <text x={-w / 2 + 2.3} y="0.1" dominantBaseline="central" textAnchor="start" className="fpm-svc-emoji">
                {SERVICE_EMOJI[s.type] || '📍'}
              </text>
              <text x={-w / 2 + 5.4} y="0.1" dominantBaseline="central" textAnchor="start" className="fpm-svc-text">
                {short}
              </text>
            </g>
          )
        })}

        {/* route */}
        {routeD && (
          <>
            <path d={routeD} className="fpm-route-shadow" />
            <path d={routeD} className="fpm-route" />
          </>
        )}

        {/* direction arrow on the final leg — shows which way to head */}
        {arrowAt && (
          <g transform={`translate(${arrowAt.x} ${arrowAt.y}) rotate(${heading})`} className="fpm-arrow">
            <path d="M-1.6 -1.8 L2 0 L-1.6 1.8 Z" />
          </g>
        )}

        {/* destination ring (the chip itself already shows the name) */}
        {destination && (
          <g transform={`translate(${destination.x} ${destination.y})`} className="fpm-dest">
            <circle r="3.8" className="fpm-dest-ring" />
          </g>
        )}

        {/* you are here */}
        <g transform={`translate(${from.x} ${from.y})`} className="fpm-here">
          <circle r="3.2" className="fpm-here-pulse" />
          <circle r="1.5" className="fpm-here-dot" />
        </g>
      </svg>

      <div className="fpm-legend">
        <span className="fpm-legend-item"><span className="fpm-dot fpm-dot-here" /> Tú (en la pista)</span>
        {destination && <span className="fpm-legend-item"><span className="fpm-dot fpm-dot-dest" /> {destination.label || 'Destino'}</span>}
      </div>
    </div>
  )
}

export default FloorPlanMap
