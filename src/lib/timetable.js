// Timetable logic — figure out who is playing now / next from a lineup.
// Lineup entries look like { name, time } where time is "HH:MM" (24h).
// Sets that start before the door time (e.g. 00:00, 02:00) belong to the next day.
// Pure functions over verified event data. No invented information.

/**
 * Normalize a lineup into absolute Date objects, handling after-midnight sets.
 * @param {object} event - event with { date, time, lineup, duration }
 * @returns {Array} sorted [{ name, start: Date, index }]
 */
export const buildTimeline = (event) => {
  if (!event?.lineup?.length) return []
  const baseDate = event.date // 'YYYY-MM-DD'
  const doorHour = parseInt((event.time || '22:00').split(':')[0], 10)

  const toDate = (timeStr) => {
    const [h, m] = (timeStr || '00:00').split(':').map((n) => parseInt(n, 10))
    const d = new Date(`${baseDate}T00:00:00`)
    // A set earlier than the door hour is on the following day (after midnight)
    const dayOffset = h < doorHour ? 1 : 0
    d.setDate(d.getDate() + dayOffset)
    d.setHours(h, m || 0, 0, 0)
    return d
  }

  return event.lineup
    .map((entry, index) => {
      const name = typeof entry === 'string' ? entry : entry.name
      const time = typeof entry === 'object' ? entry.time : null
      return { name, time, start: time ? toDate(time) : null, index }
    })
    .filter((e) => e.start)
    .sort((a, b) => a.start - b.start)
}

/**
 * Given a timeline and "now", return the current and next act.
 * @param {Array} timeline - from buildTimeline
 * @param {Date} now
 * @returns {{ current, next, upcoming }}
 */
export const getNowNext = (timeline, now = new Date()) => {
  if (!timeline.length) return { current: null, next: null, upcoming: [] }

  let current = null
  let nextIdx = 0
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].start <= now) {
      current = timeline[i]
      nextIdx = i + 1
    } else {
      break
    }
  }
  const next = timeline[nextIdx] || null
  const upcoming = timeline.slice(nextIdx)
  return { current, next, upcoming }
}

/** Minutes until a Date (rounded, never negative). */
export const minutesUntil = (date, now = new Date()) => {
  if (!date) return null
  return Math.max(0, Math.round((date - now) / 60000))
}

/** Format a Date as HH:MM. */
export const formatTime = (date) => {
  if (!date) return ''
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Is the event happening right now (between door time and door + duration)?
 * Used to decide whether to surface Rave Mode.
 */
export const isEventLive = (event, now = new Date()) => {
  if (!event?.date || !event?.time) return false
  const [h, m] = event.time.split(':').map((n) => parseInt(n, 10))
  const start = new Date(`${event.date}T00:00:00`)
  start.setHours(h, m || 0, 0, 0)
  const end = new Date(start.getTime() + (event.duration || 6) * 3600 * 1000)
  return now >= start && now <= end
}
