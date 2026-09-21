import WarehouseFloorPlan, { warehouseAnchors, warehouseRoute } from './floorplans/warehouse'
import './floorplans/floorplan.css'

// Reusable floor-plan renderer with an optional "you are here" origin and a
// highlighted route to a destination. Used both in the full venue map and,
// more importantly, inside Rave Mode as the context switch.
//
// Props:
//   venue     — event.venue (used to detect the plan kind)
//   origin    — { x, y } "you are here" (default: main floor)
//   destination — { x, y, label } to route to (optional)
//   compact   — smaller styling for Rave Mode

const PLANS = {
  warehouse: { Plan: WarehouseFloorPlan, anchors: warehouseAnchors, route: warehouseRoute },
}
const detect = (venue) => ((venue?.setting || '').toLowerCase().includes('warehouse') ? 'warehouse' : null)

const FloorPlanMap = ({ venue, origin, destination, compact = false }) => {
  const key = detect(venue)
  if (!key) return null
  const { Plan, anchors, route } = PLANS[key]

  const from = origin || anchors.main
  const routePts = destination ? route(from, destination) : null
  const routeD = routePts ? routePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') : null

  return (
    <div className={`fpm ${compact ? 'fpm--compact' : ''}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="fpm-svg"
        role="img" aria-label="Plano del venue con tu ruta">
        <Plan />

        {/* route */}
        {routeD && (
          <>
            <path d={routeD} className="fpm-route-shadow" />
            <path d={routeD} className="fpm-route" />
          </>
        )}

        {/* destination marker */}
        {destination && (
          <g transform={`translate(${destination.x} ${destination.y})`} className="fpm-dest">
            <circle r="3.4" className="fpm-dest-ring" />
            <circle r="1.6" className="fpm-dest-dot" />
          </g>
        )}

        {/* you are here */}
        <g transform={`translate(${from.x} ${from.y})`} className="fpm-here">
          <circle r="3.2" className="fpm-here-pulse" />
          <circle r="1.5" className="fpm-here-dot" />
        </g>
      </svg>

      <div className="fpm-legend">
        <span className="fpm-legend-item"><span className="fpm-dot fpm-dot-here" /> Estás aquí</span>
        {destination && <span className="fpm-legend-item"><span className="fpm-dot fpm-dot-dest" /> {destination.label || 'Destino'}</span>}
      </div>
    </div>
  )
}

export default FloorPlanMap
