// Pre-Rave Brief — assembles a personalized summary from verified event data
// + the user's explicit comfort preferences + which artists they don't know yet.
// This is "human-centered AI" as information organization, not generation:
// every line is grounded in real data. Nothing is invented.

import { buildTimeline, formatTime } from './timetable'
import { buildVenuePlan, hasStepFreeAccess, findServices } from './venue'

/**
 * How far away is the event, in whole days (>=0). Used to frame the brief.
 */
export const daysUntilEvent = (event, now = new Date()) => {
  if (!event?.date) return null
  const start = new Date(`${event.date}T00:00:00`)
  const midnightNow = new Date(now)
  midnightNow.setHours(0, 0, 0, 0)
  return Math.round((start - midnightNow) / (1000 * 60 * 60 * 24))
}

/**
 * Build the timetable rows for the brief: doors + each act with its time.
 * `savedArtists` (array of names) marks the ⭐ the user wants to see.
 */
export const buildBriefTimetable = (event, savedArtists = []) => {
  const rows = []
  if (event?.time) rows.push({ time: event.time, label: 'Puertas', kind: 'doors' })

  const saved = new Set(savedArtists.map((s) => s.toLowerCase()))
  const timeline = buildTimeline(event)
  timeline.forEach((t, i) => {
    rows.push({
      time: formatTime(t.start),
      label: t.name,
      kind: 'act',
      saved: saved.has(t.name.toLowerCase()),
      peak: i === timeline.length - 1, // last act = peak/closing
    })
  })
  return rows
}

/**
 * Accessibility lines derived from the venue + the user's comfort profile.
 * Only returns lines the venue can actually back up.
 */
export const buildAccessibilityNotes = (venue, comfortProfile = {}) => {
  if (!venue) return []
  const notes = []

  if (comfortProfile.stepFree) {
    notes.push({
      ok: hasStepFreeAccess(venue),
      text: hasStepFreeAccess(venue) ? 'Ruta sin escalones disponible' : 'Este venue no tiene acceso sin escalones',
    })
  }
  if (comfortProfile.accessibleToilets) {
    const has = findServices(venue, 'toilet', true).length > 0
    notes.push({ ok: has, text: has ? 'Baños accesibles disponibles' : 'Sin baños accesibles declarados' })
  }
  if (comfortProfile.restAreas) {
    const has = findServices(venue, 'rest').length > 0
    notes.push({ ok: has, text: has ? 'Zona de descanso disponible' : 'Sin zona de descanso declarada' })
  }
  if (comfortProfile.quieterAreas) {
    const has = (venue.zones || []).some((z) => z.type === 'quiet')
    notes.push({ ok: has, text: has ? 'Zona tranquila disponible' : 'Sin zona tranquila declarada' })
  }
  return notes
}

/**
 * Music discovery summary: how many acts the user already knows vs. discovers.
 * `knownArtists` = names the user has saved/seen before.
 */
export const buildDiscovery = (event, knownArtists = []) => {
  const known = new Set(knownArtists.map((s) => s.toLowerCase()))
  const acts = (event?.lineup || []).map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean)
  const total = acts.length
  const knownCount = acts.filter((a) => known.has(a.toLowerCase())).length
  const toDiscover = acts.filter((a) => !known.has(a.toLowerCase()))
  return { total, knownCount, toDiscoverCount: toDiscover.length, toDiscover }
}

/**
 * Assemble the whole brief object.
 */
export const buildPreRaveBrief = (event, { comfortProfile = {}, knownArtists = [], savedArtists = [] } = {}) => {
  if (!event) return null
  return {
    days: daysUntilEvent(event),
    timetable: buildBriefTimetable(event, savedArtists),
    venuePlan: buildVenuePlan(event.venue, comfortProfile),
    accessibility: buildAccessibilityNotes(event.venue, comfortProfile),
    discovery: buildDiscovery(event, knownArtists),
    knowBeforeYouGo: event.venue?.knowBeforeYouGo || [],
    setting: event.venue?.setting || null,
  }
}
