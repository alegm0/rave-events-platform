import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getComfortProfile } from '../../lib/db'
import { getHighlights, buildVenuePlan, SERVICE_META, SERVICE_EMOJI, ZONE_EMOJI, ZONE_TYPE_LABEL } from '../../lib/venue'
import { FiDroplet, FiLogOut, FiHeart, FiMapPin, FiCornerUpRight } from 'react-icons/fi'
import { MdWc, MdChair, MdLocalHospital, MdMeetingRoom, MdSmokingRooms, MdLocalBar } from 'react-icons/md'
import './VenueMap.css'
import './floorplans/floorplan.css'

// Attendee venue map. The visual reference is a premium simplified floor plan +
// wayfinding system, NOT a geographic map. Coordinates are 0-100 (%), only for
// orientation. Crowd/dance areas are subtle floor regions; DJ booths/stages are
// small anchored structures; amenities are compact dark labels (emoji + text).

const SERVICE_ICONS = {
  entrance: <MdMeetingRoom />,
  bar: <MdLocalBar />,
  water: <FiDroplet />,
  toilet: <MdWc />,
  firstaid: <MdLocalHospital />,
  rest: <MdChair />,
  smoking: <MdSmokingRooms />,
  exit: <FiLogOut />,
}

// Short labels for the compact map markers (keep them scannable).
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

// Location + accessibility copy per service, surfaced in the detail panel.
// Accessibility is communicated with explicit symbols, never color alone.
const serviceDetail = (s) => {
  const d = { where: null, access: [] }
  if (typeof s.walkMin === 'number' && s.walkMin > 0) d.where = `A ~${s.walkMin} min a pie`
  if (s.accessible) d.access.push({ sym: '♿', text: s.type === 'toilet' ? 'Baño accesible disponible' : 'Acceso sin escalones' })
  if (s.type === 'water') d.access.push({ sym: '✓', text: 'Agua potable gratis' })
  if (s.type === 'smoking') d.access.push({ sym: '!', text: 'Área para fumar — separada de la zona tranquila' })
  if (s.type === 'exit') d.access.push({ sym: '!', text: 'Salida de emergencia' })
  return d
}

const zoneDetail = (z) => {
  const d = { where: null, access: [] }
  if (z.type === 'quiet') {
    d.where = 'Zona de menor volumen'
    d.access.push({ sym: '♿', text: 'Acceso sin escalones' })
    d.access.push({ sym: '◐', text: 'Nivel de sonido más bajo' })
  } else if (z.type === 'booth' || z.type === 'stage') {
    d.where = 'Zona de performance'
  } else if (z.type === 'floor') {
    d.where = 'Área principal de público'
  }
  return d
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

  const MAP_PREF_LABELS = {
    quieterAreas: 'zonas tranquilas',
    stepFree: 'rutas sin escalones',
    accessibleToilets: 'baños accesibles',
    restAreas: 'zonas de descanso',
  }
  const mapPrefsOn = Object.keys(MAP_PREF_LABELS).filter((k) => comfort[k])
  const unmetPrefs = anyHighlight ? [] : mapPrefsOn.map((k) => MAP_PREF_LABELS[k])

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

  // Services pinned to the venue perimeter read as wayfinding markers.
  const PERIMETER = new Set(['entrance', 'exit'])

  const detail = selected
    ? (selected.kind === 'service' ? serviceDetail(selected.data) : zoneDetail(selected.data))
    : null

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

          {/* Subtle venue perimeter so amenities never float in empty space.
              Dashed for open-air, solid-thin for indoor. */}
          <rect x="2" y="2" width="96" height="96" rx="2"
            className={`vm-perimeter ${outdoor ? 'is-outdoor' : 'is-indoor'}`} />

          {/* Zones: floor = subtle region, booth/stage = small anchored structure,
              quiet = distinct subtle region. */}
          {venue.zones.map((z) => {
            const hl = zoneIds.has(z.id)
            const sel = selected?.kind === 'zone' && selected.data.id === z.id
            const dim = selected && !sel
            const isBooth = z.type === 'booth' || z.type === 'stage'
            return (
              <g key={z.id}
                 className={`vm-zone-g ${hl ? 'is-hl' : ''} ${sel ? 'is-sel' : ''} ${dim ? 'is-dim' : ''}`}
                 onClick={() => selectZone(z)} style={{ cursor: 'pointer' }}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={isBooth ? 0.8 : 1.4}
                  className={`vm-zone vm-zone--${z.type}`} />
                {isBooth && (
                  <text x={z.x + z.w / 2} y={z.y + z.h / 2} className="vm-zone-label is-booth"
                    dominantBaseline="central" textAnchor="middle">{ZONE_EMOJI[z.type] || '🎧'} {z.label}</text>
                )}
                {!isBooth && (
                  <text x={z.x + z.w / 2} y={z.y + z.h / 2} className={`vm-zone-label vm-zone-label--${z.type}`}
                    dominantBaseline="central" textAnchor="middle">{z.label}</text>
                )}
              </g>
            )
          })}

          {/* Amenities: compact dark labels (emoji + text), no teardrop pins. */}
          {venue.services.map((s) => {
            const hl = serviceIds.has(s.id)
            const sel = selected?.kind === 'service' && selected.data.id === s.id
            const dim = selected && !sel
            const perim = PERIMETER.has(s.type)
            // Base short label, plus a qualifier pulled from the service's own
            // label when present (e.g. "Agua (oeste)" → "Agua O") so duplicated
            // services like two water points don't render as identical chips.
            const base = SERVICE_SHORT[s.type] || SERVICE_META[s.type]?.label || ''
            const qual = (s.label.match(/\(([^)]+)\)/)?.[1] || '').trim()
            // Compact the qualifier: single direction words → initial (oeste→O),
            // short words kept as-is.
            const qualShort = qual
              ? (qual.length > 3 && /^(oeste|este|norte|sur|centro)$/i.test(qual)
                  ? qual.charAt(0).toUpperCase()
                  : qual)
              : ''
            const short = qualShort ? `${base} ${qualShort}` : base
            // approximate label width so the dark chip hugs the text
            const w = Math.max(13, 6 + short.length * 2.1)
            return (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}
                className={`vm-mark vm-mark--${s.type} ${hl ? 'is-hl' : ''} ${sel ? 'is-sel' : ''} ${dim ? 'is-dim' : ''} ${perim ? 'is-perim' : ''} ${s.accessible ? 'is-acc' : ''}`}
                onClick={() => selectService(s)} style={{ cursor: 'pointer' }}>
                <rect x={-w / 2} y="-2.6" width={w} height="5.2" rx="1" className="vm-mark-chip" />
                <text x={-w / 2 + 2.6} y="0.1" dominantBaseline="central" textAnchor="start" className="vm-mark-emoji">{SERVICE_EMOJI[s.type] || '📍'}</text>
                <text x={-w / 2 + 6.2} y="0.1" dominantBaseline="central" textAnchor="start" className="vm-mark-text">{short}</text>
                {s.accessible && <text x={w / 2 - 2} y="0.1" dominantBaseline="central" textAnchor="middle" className="vm-mark-acc">♿</text>}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Selection detail panel: name + location + accessibility (symbols). */}
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
              <span className="vm-info-type">
                {selected.kind === 'zone'
                  ? (ZONE_TYPE_LABEL[selected.data.type] || 'Zona')
                  : SERVICE_META[selected.data.type]?.label}
                {detail?.where && ` · ${detail.where}`}
              </span>
              {detail?.access?.length > 0 && (
                <ul className="vm-info-access">
                  {detail.access.map((a, i) => (
                    <li key={i}><span className="vm-info-sym">{a.sym}</span>{a.text}</li>
                  ))}
                </ul>
              )}
            </div>
            {(zoneIds.has(selected.data.id) || serviceIds.has(selected.data.id)) && (
              <span className="vm-info-rec">Para ti</span>
            )}
          </>
        ) : (
          <span className="vm-info-hint">Toca una zona o un servicio para ver los detalles</span>
        )}
      </div>

      {/* My Venue Plan */}
      <div className="venue-plan">
        <div className="venue-plan-head">
          <h3>Tu plan del venue</h3>
          {anyHighlight && (
            <span className="venue-plan-because">Ajustado a: {reasons.join(' · ')}</span>
          )}
        </div>
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
        {!anyHighlight && unmetPrefs.length > 0 && (
          <p className="venue-plan-hint">
            <FiHeart /> Marcaste {unmetPrefs.length === 1 ? unmetPrefs[0] : `${unmetPrefs.slice(0, -1).join(', ')} y ${unmetPrefs[unmetPrefs.length - 1]}`}, pero este venue no{unmetPrefs.length === 1 ? ' la' : ' las'} ofrece. No inventamos servicios que no existen.
          </p>
        )}
        {!anyHighlight && unmetPrefs.length === 0 && (
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
