// Venue experience logic — shared by the map, the venue plan,
// the pre-rave brief and the rave companion.
// Pure functions over verified event/venue data + user comfort preferences.
// Nothing here invents data: if the venue doesn't declare it, we don't show it.

// Which service types matter for each comfort preference.
// This is how "personalization with agency" becomes concrete:
// the user's explicit choices decide what the map highlights.
const PREF_TO_SERVICE = {
  stepFree: { serviceTypes: ['entrance'], accessibleOnly: true, reason: 'Rutas sin escalones' },
  accessibleToilets: { serviceTypes: ['toilet'], accessibleOnly: true, reason: 'Baños accesibles' },
  restAreas: { serviceTypes: ['rest'], accessibleOnly: false, reason: 'Zonas de descanso' },
  quieterAreas: { serviceTypes: [], zoneTypes: ['quiet'], reason: 'Zonas tranquilas' },
}

// Universal emoji per service type — instantly recognizable, no legend needed.
// Used by the venue map, the editor checklist and the plan.
export const SERVICE_EMOJI = {
  entrance: '🚪',
  bar: '🍸',
  water: '💧',
  toilet: '🚻',
  firstaid: '🏥',
  rest: '🪑',
  smoking: '🚬',
  exit: '🚨',
}
export const ZONE_EMOJI = {
  booth: '🎧',
  floor: '💃',
  stage: '🎧',
  quiet: '🌙',
}

// Human-readable name per zone type (used in detail panels / plan).
export const ZONE_TYPE_LABEL = {
  booth: 'DJ Booth',
  floor: 'Pista',
  stage: 'Escenario',
  quiet: 'Zona tranquila',
}

export const SERVICE_META = {
  entrance: { label: 'Entrada', icon: 'entrance', emoji: '🚪' },
  bar: { label: 'Bar', icon: 'bar', emoji: '🍸' },
  water: { label: 'Agua', icon: 'water', emoji: '💧' },
  toilet: { label: 'Baños', icon: 'toilet', emoji: '🚻' },
  firstaid: { label: 'First Aid', icon: 'firstaid', emoji: '🏥' },
  rest: { label: 'Zona de respiro', icon: 'rest', emoji: '🪑' },
  smoking: { label: 'Fumadores', icon: 'smoking', emoji: '🚬' },
  exit: { label: 'Salida', icon: 'exit', emoji: '🚨' },
}

// Simple venue builder: the organizer just TICKS which services the venue has
// and we auto-place everything on the plan (no dragging). Each option carries a
// fixed position, a plain-language description and a sensible default. This is
// what makes the map easy — the organizer answers "what does my venue have?"
// instead of designing a floor plan.
export const VENUE_SERVICE_CATALOG = [
  { type: 'entrance', emoji: '🚪', label: 'Entrada', desc: 'Puerta principal de acceso', x: 50, y: 95, walkMin: 0, accessible: true, essential: true, defaultOn: true },
  { type: 'exit', emoji: '🚨', label: 'Salida de emergencia', desc: 'Salida rápida en caso de emergencia', x: 72, y: 95, walkMin: 3, essential: true, defaultOn: true },
  { type: 'bar', emoji: '🍸', label: 'Bar', desc: 'Barra de bebidas (agua gratis disponible)', x: 90, y: 52, walkMin: 2, defaultOn: true },
  { type: 'water', emoji: '💧', label: 'Punto de agua', desc: 'Estación de agua gratis', x: 72, y: 52, walkMin: 2, defaultOn: true },
  { type: 'toilet', emoji: '🚻', label: 'Baños', desc: 'Baños del venue', x: 90, y: 78, walkMin: 3, accessible: false, defaultOn: true },
  { type: 'smoking', emoji: '🚬', label: 'Zona de fumadores', desc: 'Área al aire libre para fumar (suele ser más tranquila)', x: 26, y: 74, walkMin: 3, defaultOn: false },
  { type: 'rest', emoji: '🪑', label: 'Zona de respiro', desc: 'Un lugar para tomar un respiro y recuperar energía', x: 46, y: 90, walkMin: 3, accessible: true, defaultOn: false },
  { type: 'firstaid', emoji: '🏥', label: 'Primeros auxilios', desc: 'Punto de atención médica', x: 20, y: 35, walkMin: 4, defaultOn: false },
]

/**
 * Given a comfort profile, return the set of service ids and zone ids
 * that should be highlighted on the map, plus the human reasons why.
 */
export const getHighlights = (venue, comfortProfile = {}) => {
  const serviceIds = new Set()
  const zoneIds = new Set()
  const reasons = new Set()
  if (!venue) return { serviceIds, zoneIds, reasons: [] }

  Object.entries(comfortProfile).forEach(([key, on]) => {
    if (!on) return
    const rule = PREF_TO_SERVICE[key]
    if (!rule) return

    ;(venue.services || []).forEach((s) => {
      if (!rule.serviceTypes?.includes(s.type)) return
      if (rule.accessibleOnly && !s.accessible) return
      serviceIds.add(s.id)
      reasons.add(rule.reason)
    })

    ;(venue.zones || []).forEach((z) => {
      if (!rule.zoneTypes?.includes(z.type)) return
      zoneIds.add(z.id)
      reasons.add(rule.reason)
    })
  })

  return { serviceIds, zoneIds, reasons: [...reasons] }
}

/**
 * Build "My Venue Plan" — an ordered, human-readable list of the key points
 * for this attendee. Essentials always appear; comfort items are prioritized
 * when the user asked for them.
 */
export const buildVenuePlan = (venue, comfortProfile = {}) => {
  if (!venue) return []
  const services = venue.services || []
  const plan = []

  // `simpleNavigation` (opt-in comfort preference) reduces the plan to the four
  // points a person needs to orient themselves: entrance, main stage, nearest
  // toilet and exit. Fewer stops = a plan that's easier to follow.
  const simple = !!comfortProfile.simpleNavigation

  const find = (type, opts = {}) =>
    services.find((s) => s.type === type && (!opts.accessible || s.accessible))

  const entrance = comfortProfile.stepFree
    ? find('entrance', { accessible: true }) || find('entrance')
    : find('entrance')
  if (entrance) plan.push({ ...entrance, note: entrance.accessible ? 'Entrada sin escalones' : null })

  // Main crowd/dance area as the anchor (fall back to booth/stage).
  const zones = venue.zones || []
  const mainStage =
    zones.find((z) => z.type === 'floor') ||
    zones.find((z) => z.type === 'booth') ||
    zones.find((z) => z.type === 'stage')
  if (mainStage) plan.push({ id: mainStage.id, type: mainStage.type, label: mainStage.label, walkMin: 2, isZone: true })

  const toilet = comfortProfile.accessibleToilets
    ? find('toilet', { accessible: true }) || find('toilet')
    : find('toilet')
  if (toilet) plan.push({ ...toilet, note: toilet.accessible ? 'Accesible' : null })

  // In simple-navigation mode we stop here plus the exit: only the four
  // essentials. Otherwise we add water, rest, quiet and first-aid points.
  if (!simple) {
    const water = find('water')
    if (water) plan.push(water)

    if (comfortProfile.restAreas) {
      const rest = find('rest')
      if (rest) plan.push({ ...rest, note: 'Priorizado por tus preferencias' })
    }

    if (comfortProfile.quieterAreas) {
      const quiet = (venue.zones || []).find((z) => z.type === 'quiet')
      if (quiet) plan.push({ id: quiet.id, type: 'quiet', label: quiet.label, walkMin: 3, isZone: true, note: 'Zona tranquila' })
    }

    const firstaid = find('firstaid')
    if (firstaid) plan.push(firstaid)
  }

  const exit = find('exit')
  if (exit) plan.push(exit)

  return plan
}

/** Does this venue offer step-free access at any entrance? */
export const hasStepFreeAccess = (venue) =>
  (venue?.services || []).some((s) => s.type === 'entrance' && s.accessible)

/** Find services of a type (optionally accessible only). */
export const findServices = (venue, type, accessibleOnly = false) =>
  (venue?.services || []).filter((s) => s.type === type && (!accessibleOnly || s.accessible))

/**
 * Resolve the best destination of a given service type for THIS person.
 * If they set an accessibility preference, prefer the accessible option;
 * otherwise pick the first available. Returns the service + why it was chosen.
 * This is where "same venue, different info per person" happens.
 */
export const resolveDestination = (venue, type, comfortProfile = {}) => {
  const all = findServices(venue, type)
  if (all.length === 0) return null

  const wantsAccessible =
    (type === 'toilet' && comfortProfile.accessibleToilets) ||
    (type === 'entrance' && comfortProfile.stepFree) ||
    (type === 'exit' && comfortProfile.stepFree)

  if (wantsAccessible) {
    const acc = all.find((s) => s.accessible)
    if (acc) return { service: acc, reason: type === 'toilet' ? 'Baño accesible' : 'Ruta sin escalones', stepFree: true }
  }
  return { service: all[0], reason: null, stepFree: !!all[0].accessible }
}
