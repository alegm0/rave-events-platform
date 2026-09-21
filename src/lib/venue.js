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

export const SERVICE_META = {
  entrance: { label: 'Entrada', icon: 'entrance' },
  water: { label: 'Agua', icon: 'water' },
  toilet: { label: 'Baños', icon: 'toilet' },
  firstaid: { label: 'First Aid', icon: 'firstaid' },
  rest: { label: 'Descanso', icon: 'rest' },
  smoking: { label: 'Smoking', icon: 'smoking' },
  exit: { label: 'Salida', icon: 'exit' },
}

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

  const find = (type, opts = {}) =>
    services.find((s) => s.type === type && (!opts.accessible || s.accessible))

  const entrance = comfortProfile.stepFree
    ? find('entrance', { accessible: true }) || find('entrance')
    : find('entrance')
  if (entrance) plan.push({ ...entrance, note: entrance.accessible ? 'Entrada sin escalones' : null })

  // Main stage as the anchor
  const mainStage = (venue.zones || []).find((z) => z.type === 'stage')
  if (mainStage) plan.push({ id: mainStage.id, type: 'stage', label: mainStage.label, walkMin: 2, isZone: true })

  const toilet = comfortProfile.accessibleToilets
    ? find('toilet', { accessible: true }) || find('toilet')
    : find('toilet')
  if (toilet) plan.push({ ...toilet, note: toilet.accessible ? 'Accesible' : null })

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
