import { useRef, useState } from 'react'
import { VENUE_TEMPLATES } from '../../lib/db'
import { SERVICE_META, SERVICE_EMOJI, ZONE_EMOJI, VENUE_SERVICE_CATALOG } from '../../lib/venue'
import { FiPlus, FiTrash2, FiMove, FiAlertTriangle, FiInfo, FiCheck, FiEdit3, FiArrowLeft } from 'react-icons/fi'
import './VenueEditor.css'

// Venue editor for organizers — SIMPLE by default.
//
// The organizer picks the TYPE of venue (not an abstract "shape"); RAVE lays
// out a polished default floor plan. Then they just TICK which services the
// venue has. Fine positioning is optional: "Editar mapa" lets them drag any
// element to its real spot. The preview mirrors the attendee map exactly, so
// "what you build is what they see".
//
// Coordinates are percentages (0-100) of the plan, not geographic positions.

const TEMPLATE_LABELS = {
  club: { name: 'Club', sub: 'Pista principal · DJ booth · bar · chill', emoji: '🪩' },
  warehouse: { name: 'Warehouse', sub: 'Main floor grande · room 2 opcional', emoji: '🏭' },
  festival: { name: 'Aire libre / Festival', sub: 'Al aire libre · varios escenarios y servicios', emoji: '🎪' },
  gallery: { name: 'Espacio íntimo', sub: 'Galería · estudio · evento pequeño', emoji: '🖼️' },
}

const ZONE_TYPES = [
  { value: 'booth', label: 'DJ Booth / Escenario' },
  { value: 'floor', label: 'Pista / Público' },
  { value: 'quiet', label: 'Zona tranquila' },
]
const SERVICE_TYPES = Object.entries(SERVICE_META).map(([value, meta]) => ({ value, label: meta.label }))
const ACCESSIBLE_RELEVANT = ['entrance', 'exit', 'toilet', 'rest']
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const isBooth = (type) => type === 'booth' || type === 'stage'

export const emptyVenue = () => ({
  kind: 'custom', layout: 'indoor', setting: 'Venue personalizado',
  zones: [
    { id: uid('zone'), label: 'DJ Booth', type: 'booth', x: 34, y: 6, w: 32, h: 9 },
    { id: uid('zone'), label: 'Pista', type: 'floor', x: 16, y: 18, w: 68, h: 42 },
  ],
  services: VENUE_SERVICE_CATALOG.filter((s) => s.defaultOn).map((s) => ({
    id: uid('svc'), type: s.type, label: s.label,
    x: s.x, y: s.y, walkMin: s.walkMin, accessible: !!s.accessible,
  })),
  knowBeforeYouGo: ['Trae documento de identidad'],
})

// Build a venue from a template + the ticked services. Zones come from the
// template; services come from the catalog selection.
const buildVenue = (templateKey, selectedTypes) => {
  const t = VENUE_TEMPLATES[templateKey]
  const services = VENUE_SERVICE_CATALOG
    .filter((s) => selectedTypes.includes(s.type))
    .map((s) => ({
      id: uid('svc'), type: s.type, label: s.label,
      x: s.x, y: s.y, walkMin: s.walkMin, accessible: !!s.accessible,
    }))
  const zones = t.zones.map((z) => ({ ...z, id: uid('zone') }))
  return {
    kind: templateKey, layout: t.layout, setting: t.setting,
    zones, services,
    knowBeforeYouGo: [...(t.knowBeforeYouGo || [])],
  }
}

const VenueEditor = ({ value, onChange }) => {
  const venue = value || null
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [selected, setSelected] = useState(null)
  const [advanced, setAdvanced] = useState(false)

  const update = (patch) => onChange({ ...venue, ...patch })
  const setZone = (id, patch) => update({ zones: venue.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) })
  const setService = (id, patch) => update({ services: venue.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) })

  // ── Step 1: no venue yet → pick a venue TYPE ──
  if (!venue) {
    return (
      <div className="ve">
        <div className="ve-intro">
          <h3>¿Qué tipo de venue es?</h3>
          <p>Selecciona la opción más parecida a tu espacio. RAVE crea una distribución inicial que luego puedes ajustar.</p>
        </div>
        <div className="ve-templates">
          {Object.keys(TEMPLATE_LABELS).map((key) => (
            <button key={key} type="button" className="ve-template" onClick={() => {
              const defaults = VENUE_SERVICE_CATALOG.filter((s) => s.defaultOn).map((s) => s.type)
              onChange(buildVenue(key, defaults))
            }}>
              <span className="ve-template-emoji">{TEMPLATE_LABELS[key].emoji}</span>
              <strong>{TEMPLATE_LABELS[key].name}</strong>
              <span>{TEMPLATE_LABELS[key].sub}</span>
            </button>
          ))}
          {/* Custom venue — start from a minimal booth + floor layout */}
          <button type="button" className="ve-template ve-template--custom" onClick={() => onChange(emptyVenue())}>
            <span className="ve-template-emoji">＋</span>
            <strong>Venue personalizado</strong>
            <span>Empieza con una distribución mínima y ajústala</span>
          </button>
        </div>
        <p className="ve-skip">
          <FiInfo /> Si no configuras el venue, tu evento no mostrará mapa, brief ni Rave Mode.
        </p>
      </div>
    )
  }

  // Which catalog services are currently on
  const activeTypes = new Set(venue.services.map((s) => s.type))
  const hasQuiet = venue.zones.some((z) => z.type === 'quiet')
  const outdoor = venue.layout === 'outdoor'

  // Toggle a service on/off using the catalog's default position
  const toggleService = (catalogItem) => {
    if (activeTypes.has(catalogItem.type)) {
      update({ services: venue.services.filter((s) => s.type !== catalogItem.type) })
    } else {
      update({
        services: [...venue.services, {
          id: uid('svc'), type: catalogItem.type, label: catalogItem.label,
          x: catalogItem.x, y: catalogItem.y, walkMin: catalogItem.walkMin, accessible: !!catalogItem.accessible,
        }],
      })
    }
  }

  const toggleQuietZone = () => {
    if (hasQuiet) {
      update({ zones: venue.zones.filter((z) => z.type !== 'quiet') })
    } else {
      update({ zones: [...venue.zones, { id: uid('zone'), label: 'Zona tranquila', type: 'quiet', x: 6, y: 64, w: 30, h: 24 }] })
    }
  }

  // ── Drag ──
  const pointToPercent = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 1, 99),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 1, 99),
    }
  }
  const handlePointerMove = (e) => {
    if (!drag) return
    const { x, y } = pointToPercent(e)
    if (drag.kind === 'service') setService(drag.id, { x: Math.round(x), y: Math.round(y) })
    else {
      const zone = venue.zones.find((z) => z.id === drag.id)
      if (!zone) return
      setZone(drag.id, { x: Math.round(clamp(x - zone.w / 2, 0, 100 - zone.w)), y: Math.round(clamp(y - zone.h / 2, 0, 100 - zone.h)) })
    }
  }
  const startDrag = (kind, id) => (e) => {
    if (!advanced) return
    e.stopPropagation()
    if (e.currentTarget.setPointerCapture && e.pointerId != null) {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
    }
    setSelected({ kind, id })
    setDrag({ kind, id })
  }
  const endDrag = () => setDrag(null)

  const warnings = []
  if (!activeTypes.has('entrance')) warnings.push('Marca al menos una entrada.')
  if (!activeTypes.has('exit')) warnings.push('Marca al menos una salida.')
  if (venue.zones.filter((z) => isBooth(z.type)).length === 0) warnings.push('El venue no tiene escenario / DJ booth.')

  // Short labels for the compact amenity chips (mirror the attendee map).
  const SHORT = { entrance: 'Entrada', bar: 'Bar', water: 'Agua', toilet: 'WC', firstaid: 'First Aid', rest: 'Respiro', smoking: 'Fumar', exit: 'Salida' }

  return (
    <div className="ve">
      <div className="ve-intro">
        <h3>{advanced ? 'Editar mapa' : '¿Qué tiene tu venue?'}</h3>
        <p>{advanced
          ? 'Arrastra cualquier zona o servicio a su lugar real. Puedes volver a la lista de servicios cuando quieras.'
          : 'Marca los servicios que ofreces. El mapa se arma solo y así tus asistentes saben dónde está todo.'}</p>
      </div>

      {/* Live preview — identical visual language to the attendee map. */}
      <div className="ve-plan-wrap">
        <svg ref={svgRef} viewBox="0 0 100 100"
          className={`ve-plan ${outdoor ? 'is-outdoor' : 'is-indoor'} ${advanced ? 'is-editing' : ''}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}
          onClick={() => setSelected(null)}>

          <rect x="2" y="2" width="96" height="96" rx="2"
            className={`ve-perimeter ${outdoor ? 'is-outdoor' : 'is-indoor'}`} />

          {venue.zones.map((z) => {
            const isSel = selected?.kind === 'zone' && selected.id === z.id
            const booth = isBooth(z.type)
            return (
              <g key={z.id} className={`ve-zone-g ${isSel ? 'is-sel' : ''}`}
                 onPointerDown={startDrag('zone', z.id)} style={{ cursor: advanced ? 'move' : 'default' }}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={booth ? 0.8 : 1.4} className={`ve-zone ve-zone--${z.type}`} />
                <text x={z.x + z.w / 2} y={z.y + z.h / 2} className={`ve-zone-label ve-zone-label--${z.type}`} dominantBaseline="central" textAnchor="middle">
                  {booth ? `${ZONE_EMOJI[z.type] || '🎧'} ${z.label || 'Booth'}` : (z.label || 'Zona')}
                </text>
              </g>
            )
          })}

          {venue.services.map((s) => {
            const isSel = selected?.kind === 'service' && selected.id === s.id
            const base = SHORT[s.type] || SERVICE_META[s.type]?.label || ''
            const qual = (s.label.match(/\(([^)]+)\)/)?.[1] || '').trim()
            const qualShort = qual
              ? (qual.length > 3 && /^(oeste|este|norte|sur|centro)$/i.test(qual) ? qual.charAt(0).toUpperCase() : qual)
              : ''
            const short = qualShort ? `${base} ${qualShort}` : base
            const w = Math.max(13, 6 + short.length * 2.1)
            return (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}
                className={`ve-mark ve-mark--${s.type} ${isSel ? 'is-sel' : ''} ${s.accessible ? 'is-acc' : ''}`}
                onPointerDown={startDrag('service', s.id)} style={{ cursor: advanced ? 'move' : 'default' }}>
                <rect x={-w / 2} y="-2.6" width={w} height="5.2" rx="1" className="ve-mark-chip" />
                <text x={-w / 2 + 2.6} y="0.1" dominantBaseline="central" textAnchor="start" className="ve-mark-emoji">{SERVICE_EMOJI[s.type] || '📍'}</text>
                <text x={-w / 2 + 6.2} y="0.1" dominantBaseline="central" textAnchor="start" className="ve-mark-text">{short}</text>
                {s.accessible && <text x={w / 2 - 2} y="0.1" dominantBaseline="central" textAnchor="middle" className="ve-mark-acc">♿</text>}
              </g>
            )
          })}
        </svg>
        <span className="ve-plan-hint">
          {advanced ? <><FiMove /> Arrastra las zonas y servicios para ajustar su posición</> : 'Así verán el mapa tus asistentes'}
        </span>
      </div>

      {warnings.length > 0 && (
        <div className="ve-warn"><FiAlertTriangle /><div>{warnings.map((w, i) => <span key={i}>{w}</span>)}</div></div>
      )}

      {/* Simple: service checklist */}
      {!advanced && (
        <>
          <div className="ve-checklist">
            {VENUE_SERVICE_CATALOG.map((item) => {
              const on = activeTypes.has(item.type)
              return (
                <button key={item.type} type="button" className={`ve-check-card ${on ? 'is-on' : ''}`} onClick={() => toggleService(item)}>
                  <span className="ve-check-emoji">{item.emoji}</span>
                  <span className="ve-check-text">
                    <strong>{item.label}{item.essential ? ' *' : ''}</strong>
                    <span>{item.desc}</span>
                  </span>
                  <span className={`ve-check-box ${on ? 'is-on' : ''}`}>{on && <FiCheck />}</span>
                </button>
              )
            })}
          </div>

          {/* Quiet / chill zone — kept separate from smoking conceptually */}
          <button type="button" className={`ve-quiet-toggle ${hasQuiet ? 'is-on' : ''}`} onClick={toggleQuietZone}>
            <span className={`ve-check-box ${hasQuiet ? 'is-on' : ''}`}>{hasQuiet && <FiCheck />}</span>
            Añadir una zona tranquila / chill-out (separada del humo)
          </button>

          <p className="ve-note"><FiInfo /> Los campos con <strong>*</strong> son esenciales. En Australia el agua potable es gratis en el bar — por eso marcamos "Punto de agua" por defecto.</p>

          <button type="button" className="ve-advanced-toggle" onClick={() => setAdvanced(true)}>
            <FiEdit3 /> Editar mapa
          </button>
        </>
      )}

      {/* Advanced: full control (zones, service positions) */}
      {advanced && (
        <>
          <button type="button" className="ve-advanced-toggle is-active" onClick={() => setAdvanced(false)}>
            <FiArrowLeft /> Volver a servicios
          </button>

          <div className="ve-row">
            <div className="ve-field">
              <label>Descripción del espacio</label>
              <input type="text" value={venue.setting} onChange={(e) => update({ setting: e.target.value })} placeholder="Ej: Club · pista principal + chill" />
            </div>
            <div className="ve-field ve-field--narrow">
              <label>Tipo</label>
              <select value={venue.layout} onChange={(e) => update({ layout: e.target.value })}>
                <option value="indoor">Interior</option>
                <option value="outdoor">Aire libre</option>
              </select>
            </div>
          </div>

          <div className="ve-block">
            <div className="ve-block-head">
              <h4>Zonas</h4>
              <button type="button" className="ve-add" onClick={() => update({ zones: [...venue.zones, { id: uid('zone'), label: '', type: 'floor', x: 20, y: 20 + (venue.zones.length * 8) % 50, w: 40, h: 24 }] })}><FiPlus /> Agregar zona</button>
            </div>
            {venue.zones.map((z) => (
              <div key={z.id} className={`ve-item ${selected?.kind === 'zone' && selected.id === z.id ? 'is-sel' : ''}`} onClick={() => setSelected({ kind: 'zone', id: z.id })}>
                <input type="text" value={z.label} placeholder="Ej: Dance Floor" className="ve-item-name" onChange={(e) => setZone(z.id, { label: e.target.value })} />
                <select value={z.type} onChange={(e) => setZone(z.id, { type: e.target.value })}>
                  {ZONE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button type="button" className="ve-del" onClick={(e) => { e.stopPropagation(); update({ zones: venue.zones.filter((x) => x.id !== z.id) }) }}><FiTrash2 /></button>
              </div>
            ))}
          </div>

          <div className="ve-block">
            <div className="ve-block-head"><h4>Servicios</h4></div>
            {venue.services.map((s) => (
              <div key={s.id} className={`ve-item ${selected?.kind === 'service' && selected.id === s.id ? 'is-sel' : ''}`} onClick={() => setSelected({ kind: 'service', id: s.id })}>
                <select value={s.type} onChange={(e) => setService(s.id, { type: e.target.value })}>
                  {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="text" value={s.label} placeholder="Nombre" className="ve-item-name" onChange={(e) => setService(s.id, { label: e.target.value })} />
                {ACCESSIBLE_RELEVANT.includes(s.type) ? (
                  <label className="ve-check"><input type="checkbox" checked={!!s.accessible} onChange={(e) => setService(s.id, { accessible: e.target.checked })} /> Accesible</label>
                ) : <span className="ve-check ve-check--off">—</span>}
                <button type="button" className="ve-del" onClick={(e) => { e.stopPropagation(); update({ services: venue.services.filter((x) => x.id !== s.id) }) }}><FiTrash2 /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="ve-footer">
        <button type="button" className="ve-reset" onClick={() => onChange(null)}>
          Cambiar tipo de venue / empezar de nuevo
        </button>
      </div>
    </div>
  )
}

export default VenueEditor
