import { useRef, useState } from 'react'
import { VENUE_TEMPLATES } from '../../lib/db'
import { SERVICE_META } from '../../lib/venue'
import { FiPlus, FiTrash2, FiMove, FiAlertTriangle, FiInfo } from 'react-icons/fi'
import './VenueEditor.css'

// Venue editor for organizers.
//
// Everything the attendee sees in the venue map, the pre-rave brief, the rave
// companion and Rave Mode comes from this object. Before this editor existed the
// platform *guessed* the venue from the event's genre and capacity, which meant
// promising things like step-free entrances that nobody had actually declared.
// Here the organizer declares them, and owns them.
//
// Coordinates are percentages (0-100) of the plan, not geographic positions.

const TEMPLATE_LABELS = {
  warehouse: { name: 'Warehouse', sub: '2 escenarios · interior' },
  club: { name: 'Club', sub: '1 escenario · interior' },
  festival: { name: 'Festival', sub: '3 escenarios · aire libre' },
  gallery: { name: 'Galería', sub: '1 escenario · interior' },
}

const ZONE_TYPES = [
  { value: 'stage', label: 'Escenario' },
  { value: 'quiet', label: 'Zona tranquila' },
]

const SERVICE_TYPES = Object.entries(SERVICE_META).map(([value, meta]) => ({ value, label: meta.label }))

// Service types where "accesible" is a meaningful, checkable claim.
const ACCESSIBLE_RELEVANT = ['entrance', 'exit', 'toilet', 'rest']

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export const emptyVenue = () => ({
  kind: 'custom',
  layout: 'indoor',
  setting: '',
  zones: [],
  services: [],
  knowBeforeYouGo: [],
})

// Deep copy of a template so edits never mutate the shared constant.
const fromTemplate = (key) => {
  const t = VENUE_TEMPLATES[key]
  return {
    kind: key,
    layout: t.layout,
    setting: t.setting,
    zones: t.zones.map(z => ({ ...z })),
    services: t.services.map(s => ({ ...s })),
    knowBeforeYouGo: [...(t.knowBeforeYouGo || [])],
  }
}

const VenueEditor = ({ value, onChange }) => {
  const venue = value || null
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null) // { kind: 'zone'|'service', id }
  const [selected, setSelected] = useState(null)

  const update = (patch) => onChange({ ...venue, ...patch })

  const setZone = (id, patch) =>
    update({ zones: venue.zones.map(z => (z.id === id ? { ...z, ...patch } : z)) })

  const setService = (id, patch) =>
    update({ services: venue.services.map(s => (s.id === id ? { ...s, ...patch } : s)) })

  // ── Drag & drop on the plan ──
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
    if (drag.kind === 'service') {
      setService(drag.id, { x: Math.round(x), y: Math.round(y) })
    } else {
      const zone = venue.zones.find(z => z.id === drag.id)
      if (!zone) return
      setZone(drag.id, {
        x: Math.round(clamp(x - zone.w / 2, 0, 100 - zone.w)),
        y: Math.round(clamp(y - zone.h / 2, 0, 100 - zone.h)),
      })
    }
  }

  const startDrag = (kind, id) => (e) => {
    // Keep the drag on the <svg> listener: no pointer capture on the child, so
    // pointermove keeps bubbling up while the user drags.
    e.stopPropagation()
    e.preventDefault()
    setSelected({ kind, id })
    setDrag({ kind, id })
  }

  // ── Template picker (shown when there is no venue yet) ──
  if (!venue) {
    return (
      <div className="ve">
        <div className="ve-intro">
          <h3>Mapa y servicios del venue</h3>
          <p>
            Esto es lo que verán los asistentes: el mapa, los baños, el agua, las salidas y las rutas
            accesibles. Empieza desde una plantilla y ajústala a tu espacio real.
          </p>
        </div>
        <div className="ve-templates">
          {Object.keys(TEMPLATE_LABELS).map(key => (
            <button key={key} type="button" className="ve-template" onClick={() => onChange(fromTemplate(key))}>
              <strong>{TEMPLATE_LABELS[key].name}</strong>
              <span>{TEMPLATE_LABELS[key].sub}</span>
            </button>
          ))}
          <button type="button" className="ve-template ve-template--blank" onClick={() => onChange(emptyVenue())}>
            <strong>Desde cero</strong>
            <span>Sin zonas ni servicios</span>
          </button>
        </div>
        <p className="ve-skip">
          <FiInfo /> Si no configuras el venue, tu evento no mostrará mapa, brief ni Rave Mode.
        </p>
      </div>
    )
  }

  const warnings = []
  if (!venue.services.some(s => s.type === 'entrance')) warnings.push('No has declarado ninguna entrada.')
  if (!venue.services.some(s => s.type === 'exit')) warnings.push('No has declarado ninguna salida.')
  if (venue.zones.length === 0) warnings.push('No has declarado ninguna zona ni escenario.')

  return (
    <div className="ve">
      <div className="ve-intro">
        <h3>Mapa y servicios del venue</h3>
        <p>Arrastra las zonas y los pines para colocarlos como están en tu espacio.</p>
      </div>

      {/* Setting */}
      <div className="ve-row">
        <div className="ve-field">
          <label>Descripción del espacio</label>
          <input type="text" value={venue.setting}
            onChange={e => update({ setting: e.target.value })}
            placeholder="Ej: Warehouse · 2 escenarios" />
        </div>
        <div className="ve-field ve-field--narrow">
          <label>Tipo</label>
          <select value={venue.layout} onChange={e => update({ layout: e.target.value })}>
            <option value="indoor">Interior</option>
            <option value="outdoor">Aire libre</option>
          </select>
        </div>
      </div>

      {/* Interactive plan */}
      <div className="ve-plan-wrap">
        <svg ref={svgRef} viewBox="0 0 100 100" className={`ve-plan ${venue.layout === 'outdoor' ? 'is-outdoor' : ''}`}
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          onClick={() => setSelected(null)}>
          {venue.zones.map(z => {
            const isSel = selected?.kind === 'zone' && selected.id === z.id
            return (
              <g key={z.id} className={`ve-zone-g ${isSel ? 'is-sel' : ''}`} onPointerDown={startDrag('zone', z.id)}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="1"
                  className={`ve-zone ve-zone--${z.type}`} />
                <text x={z.x + z.w / 2} y={z.y + z.h / 2} className="ve-zone-label"
                  dominantBaseline="middle" textAnchor="middle">{z.label || 'Zona'}</text>
              </g>
            )
          })}
          {venue.services.map(s => {
            const isSel = selected?.kind === 'service' && selected.id === s.id
            return (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}
                className={`ve-pin ve-pin--${s.type} ${isSel ? 'is-sel' : ''} ${s.accessible ? 'is-acc' : ''}`}
                onPointerDown={startDrag('service', s.id)}>
                <circle r="2.6" className="ve-pin-body" />
                <text y="0.9" textAnchor="middle" className="ve-pin-initial">
                  {(SERVICE_META[s.type]?.label || '?')[0]}
                </text>
                {s.accessible && <circle cx="2.2" cy="-2.2" r="1" className="ve-pin-acc" />}
              </g>
            )
          })}
        </svg>
        <span className="ve-plan-hint"><FiMove /> Arrastra para colocar · las coordenadas son porcentajes del plano</span>
      </div>

      {warnings.length > 0 && (
        <div className="ve-warn">
          <FiAlertTriangle />
          <div>
            {warnings.map((w, i) => <span key={i}>{w}</span>)}
          </div>
        </div>
      )}

      {/* Zones */}
      <div className="ve-block">
        <div className="ve-block-head">
          <h4>Zonas y escenarios</h4>
          <button type="button" className="ve-add" onClick={() => update({
            zones: [...venue.zones, {
              id: uid('zone'),
              label: '',
              type: 'stage',
              x: 6, y: 8 + (venue.zones.length * 6) % 60, w: 40, h: 24,
            }],
          })}><FiPlus /> Agregar zona</button>
        </div>
        {venue.zones.length === 0 ? (
          <p className="ve-empty">Sin zonas. Agrega al menos el escenario principal.</p>
        ) : venue.zones.map(z => (
          <div key={z.id} className={`ve-item ${selected?.kind === 'zone' && selected.id === z.id ? 'is-sel' : ''}`}
            onClick={() => setSelected({ kind: 'zone', id: z.id })}>
            <input type="text" value={z.label} placeholder="Ej: Main Stage" className="ve-item-name"
              onChange={e => setZone(z.id, { label: e.target.value })} />
            <select value={z.type} onChange={e => setZone(z.id, { type: e.target.value })}>
              {ZONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="ve-size">
              Ancho
              <input type="number" min="5" max="100" value={z.w}
                onChange={e => setZone(z.id, { w: clamp(parseInt(e.target.value) || 5, 5, 100 - z.x) })} />
            </label>
            <label className="ve-size">
              Alto
              <input type="number" min="5" max="100" value={z.h}
                onChange={e => setZone(z.id, { h: clamp(parseInt(e.target.value) || 5, 5, 100 - z.y) })} />
            </label>
            <button type="button" className="ve-del" title="Quitar zona"
              onClick={(e) => { e.stopPropagation(); update({ zones: venue.zones.filter(x => x.id !== z.id) }) }}>
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      {/* Services */}
      <div className="ve-block">
        <div className="ve-block-head">
          <h4>Servicios</h4>
          <button type="button" className="ve-add" onClick={() => update({
            services: [...venue.services, {
              id: uid('svc'),
              type: 'water',
              label: '',
              x: 50, y: 50,
              accessible: false,
              walkMin: 2,
            }],
          })}><FiPlus /> Agregar servicio</button>
        </div>
        <p className="ve-note">
          Marca <strong>accesible</strong> solo si lo has verificado. Los asistentes que activan sus
          preferencias de accesibilidad son dirigidos a estos puntos.
        </p>
        {venue.services.length === 0 ? (
          <p className="ve-empty">Sin servicios. Agrega al menos la entrada, los baños y el agua.</p>
        ) : venue.services.map(s => (
          <div key={s.id} className={`ve-item ${selected?.kind === 'service' && selected.id === s.id ? 'is-sel' : ''}`}
            onClick={() => setSelected({ kind: 'service', id: s.id })}>
            <select value={s.type} onChange={e => setService(s.id, { type: e.target.value })}>
              {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="text" value={s.label} placeholder="Ej: Baños planta baja" className="ve-item-name"
              onChange={e => setService(s.id, { label: e.target.value })} />
            <label className="ve-size">
              Min
              <input type="number" min="0" max="60" value={s.walkMin ?? 0}
                onChange={e => setService(s.id, { walkMin: clamp(parseInt(e.target.value) || 0, 0, 60) })} />
            </label>
            {ACCESSIBLE_RELEVANT.includes(s.type) ? (
              <label className="ve-check">
                <input type="checkbox" checked={!!s.accessible}
                  onChange={e => setService(s.id, { accessible: e.target.checked })} />
                Accesible
              </label>
            ) : <span className="ve-check ve-check--off">—</span>}
            <button type="button" className="ve-del" title="Quitar servicio"
              onClick={(e) => { e.stopPropagation(); update({ services: venue.services.filter(x => x.id !== s.id) }) }}>
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      {/* Know before you go */}
      <div className="ve-block">
        <div className="ve-block-head">
          <h4>Antes de venir</h4>
          <button type="button" className="ve-add"
            onClick={() => update({ knowBeforeYouGo: [...(venue.knowBeforeYouGo || []), ''] })}>
            <FiPlus /> Agregar aviso
          </button>
        </div>
        {(venue.knowBeforeYouGo || []).length === 0 ? (
          <p className="ve-empty">Documento de identidad, guardarropa, transporte, clima...</p>
        ) : venue.knowBeforeYouGo.map((k, i) => (
          <div key={i} className="ve-item">
            <input type="text" value={k} placeholder="Ej: Trae documento de identidad" className="ve-item-name"
              onChange={e => {
                const next = [...venue.knowBeforeYouGo]
                next[i] = e.target.value
                update({ knowBeforeYouGo: next })
              }} />
            <button type="button" className="ve-del" title="Quitar aviso"
              onClick={() => update({ knowBeforeYouGo: venue.knowBeforeYouGo.filter((_, j) => j !== i) })}>
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      <div className="ve-footer">
        <button type="button" className="ve-reset" onClick={() => onChange(null)}>
          Quitar el venue de este evento
        </button>
      </div>
    </div>
  )
}

export default VenueEditor
