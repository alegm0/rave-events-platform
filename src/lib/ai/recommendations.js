// Embedding-based Event Recommendations
// Vector similarity search on user behavior profiles
// Uses cosine similarity — no external APIs, runs entirely client-side ($0)

// Event finished? (start + duration in the past). Shared rule so we never
// recommend an event that already happened, even if it's "today".
const hasEnded = (e, now = new Date()) => {
  if (!e?.date) return false
  const [h, m] = (e.time || '23:00').split(':').map((n) => parseInt(n, 10) || 0)
  const start = new Date(`${e.date}T00:00:00`)
  start.setHours(h, m, 0, 0)
  return new Date(start.getTime() + (e.duration || 6) * 3600000) < now
}

/**
 * Build a user preference vector based on their behavior
 * Dimensions: genres, price range, time preference, city preference, social activity
 */
export const buildUserProfile = (userTickets, userGoing, allEvents) => {
  const attended = allEvents.filter(e =>
    userTickets.some(t => t.eventId === e.id) || userGoing.some(g => g.eventId === e.id)
  )

  if (attended.length === 0) return null

  // Genre preferences (one-hot style with weights)
  const genreWeights = {}
  attended.forEach(e => {
    if (e.genre) genreWeights[e.genre] = (genreWeights[e.genre] || 0) + 1
  })
  // Normalize
  const maxGenre = Math.max(...Object.values(genreWeights), 1)
  Object.keys(genreWeights).forEach(g => { genreWeights[g] /= maxGenre })

  // Price preference (avg and range)
  const prices = attended.map(e => e.price || 0).filter(p => p > 0)
  const avgPrice = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 30
  const priceRange = { min: Math.min(...prices, 0), max: Math.max(...prices, 100) }

  // Time preference (hour of event start)
  const hours = attended.map(e => parseInt(e.time?.split(':')[0] || '22'))
  const avgHour = hours.reduce((s, h) => s + h, 0) / hours.length
  const prefersLateNight = avgHour >= 23 || avgHour <= 4

  // City preference
  const cities = {}
  attended.forEach(e => { if (e.city) cities[e.city] = (cities[e.city] || 0) + 1 })

  // Duration preference
  const durations = attended.map(e => e.duration || 6)
  const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length

  return {
    genreWeights,
    avgPrice,
    priceRange,
    avgHour,
    prefersLateNight,
    cities,
    avgDuration,
    eventsAttended: attended.length,
    favoriteGenres: Object.entries(genreWeights).sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 3),
  }
}

/**
 * Convert event to a feature vector for similarity comparison
 */
const eventToVector = (event, allGenres) => {
  const vec = []

  // Genre features (one-hot)
  allGenres.forEach(g => {
    vec.push(event.genre === g ? 1 : 0)
  })

  // Normalized price (0-1 scale, assuming max $200)
  vec.push(Math.min((event.price || 0) / 200, 1))

  // Time feature (normalized hour 0-1)
  const hour = parseInt(event.time?.split(':')[0] || '22')
  vec.push(hour / 24)

  // Duration (normalized, max 48h)
  vec.push(Math.min((event.duration || 6) / 48, 1))

  // Capacity size (small<200, medium<500, large>=500)
  const cap = event.capacity || 200
  vec.push(cap < 200 ? 0.2 : cap < 500 ? 0.5 : 1.0)

  return vec
}

/**
 * Convert user profile to a preference vector (same dimensions as event vector)
 */
const profileToVector = (profile, allGenres) => {
  const vec = []

  // Genre preferences
  allGenres.forEach(g => {
    vec.push(profile.genreWeights[g] || 0)
  })

  // Price preference (normalized)
  vec.push(Math.min(profile.avgPrice / 200, 1))

  // Time preference
  vec.push(profile.avgHour / 24)

  // Duration preference
  vec.push(Math.min(profile.avgDuration / 48, 1))

  // Capacity preference (infer from history)
  vec.push(0.5) // neutral

  return vec
}

/**
 * Cosine similarity between two vectors
 */
const cosineSimilarity = (a, b) => {
  if (a.length !== b.length) return 0
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dotProduct / denom
}

/**
 * Get personalized event recommendations for a user
 * @param {object} userProfile - From buildUserProfile()
 * @param {Array} allEvents - All available events
 * @param {Array} excludeIds - Event IDs user already has tickets for
 * @param {number} limit - Max recommendations to return
 * @returns {Array} Sorted events with similarity scores and reasons
 */
export const getRecommendations = (userProfile, allEvents, excludeIds = [], limit = 6) => {
  if (!userProfile) return allEvents.slice(0, limit).map(e => ({ ...e, score: 0.5, reasons: ['Evento popular'] }))

  // Get all unique genres across events + profile
  const allGenres = [...new Set([
    ...allEvents.map(e => e.genre).filter(Boolean),
    ...Object.keys(userProfile.genreWeights)
  ])]

  const profileVec = profileToVector(userProfile, allGenres)

  // Only recommend events that haven't ended and aren't already attended
  const now = new Date()
  const candidates = allEvents.filter(e =>
    !hasEnded(e, now) && !excludeIds.includes(e.id)
  )

  const scored = candidates.map(event => {
    const eventVec = eventToVector(event, allGenres)
    const similarity = cosineSimilarity(profileVec, eventVec)

    // Bonus factors
    let bonus = 0
    const reasons = []

    // Genre match: the bonus still only rewards a strong match, but the REASON
    // reflects any genre the user actually attends, worded by how much they do.
    const gw = userProfile.genreWeights[event.genre] || 0
    if (gw > 0.5) {
      bonus += 0.15
      reasons.push(`Te encanta el ${event.genre}`)
    } else if (gw >= 0.3) {
      bonus += 0.08
      reasons.push(`Sueles ir a ${event.genre}`)
    } else if (gw > 0) {
      reasons.push(`Has ido a ${event.genre}`)
    }

    // Line-up overlap with artists the user follows (⭐) — a strong, specific
    // signal that differentiates two events of the same genre.
    const followed = (userProfile.savedArtists || []).map((a) => a.toLowerCase())
    if (followed.length) {
      const acts = (event.lineup || []).map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean)
      const match = acts.find((a) => followed.includes(a.toLowerCase()))
      if (match) { bonus += 0.12; reasons.push(`Toca ${match}, que sigues`) }
    }

    // Popularity bonus (selling fast) — a more concrete, useful signal
    const soldPct = (event.ticketsSold || 0) / (event.capacity || 200)
    if (soldPct > 0.6) {
      bonus += 0.05
      reasons.push('Se está agotando')
    }

    // Soon bonus (events in next 2 weeks get a boost)
    const daysAway = Math.ceil((new Date(event.date) - now) / (1000 * 60 * 60 * 24))
    if (daysAway <= 14) {
      bonus += 0.05
      reasons.push('Muy pronto')
    }

    // City match: keep the scoring bonus, but only SHOW it as a reason when we
    // don't already have a stronger, more specific reason (avoids every card
    // repeating the same "tu zona" line when all events are in one city).
    if (userProfile.cities[event.city]) {
      bonus += 0.1
      if (reasons.length === 0) reasons.push(`En ${event.city}, tu zona`)
    }

    if (reasons.length === 0) reasons.push('Basado en tu perfil')

    // Spread the score so cards don't all read 100%. A pure genre match sits
    // around the mid-80s; the extra bonuses (followed artist, selling fast,
    // soon) are what push a few standouts toward the top. We scale the raw
    // (similarity + bonus) into a believable 60-98% band instead of clamping
    // everything that's "good enough" to a flat 100%.
    const raw = similarity + bonus
    const scaled = 0.6 + Math.min(1, raw) * 0.38 // → 60%..98%
    const finalScore = Math.min(0.98, scaled)

    // Keep at most 2 reasons on the card: the genre affinity + the single most
    // specific differentiator, so same-genre events don't look identical.
    const trimmedReasons = reasons.slice(0, 2)

    return { ...event, score: Math.round(finalScore * 100) / 100, reasons: trimmedReasons }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * Get similar events to a given event (content-based filtering)
 */
export const getSimilarEvents = (event, allEvents, limit = 4) => {
  const allGenres = [...new Set(allEvents.map(e => e.genre).filter(Boolean))]
  const targetVec = eventToVector(event, allGenres)

  const now = new Date()
  const candidates = allEvents.filter(e => e.id !== event.id && !hasEnded(e, now))

  const scored = candidates.map(e => ({
    ...e,
    similarity: cosineSimilarity(targetVec, eventToVector(e, allGenres))
  }))

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}
