// Embedding-based Event Recommendations
// Vector similarity search on user behavior profiles
// Uses cosine similarity — no external APIs, runs entirely client-side ($0)

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

  // Only recommend future events not already attended
  const now = new Date()
  const candidates = allEvents.filter(e =>
    new Date(e.date) >= now && !excludeIds.includes(e.id)
  )

  const scored = candidates.map(event => {
    const eventVec = eventToVector(event, allGenres)
    const similarity = cosineSimilarity(profileVec, eventVec)

    // Bonus factors
    let bonus = 0
    const reasons = []

    // Genre match bonus
    if (userProfile.genreWeights[event.genre] > 0.5) {
      bonus += 0.15
      reasons.push(`Te gusta el ${event.genre}`)
    }

    // City match bonus
    if (userProfile.cities[event.city]) {
      bonus += 0.1
      reasons.push(`En ${event.city}, tu zona`)
    }

    // Popularity bonus (selling fast)
    const soldPct = event.ticketsSold / (event.capacity || 200)
    if (soldPct > 0.6) {
      bonus += 0.05
      reasons.push('Se está agotando')
    }

    // Soon bonus (events in next 2 weeks get a boost)
    const daysAway = Math.ceil((new Date(event.date) - now) / (1000 * 60 * 60 * 24))
    if (daysAway <= 14) {
      bonus += 0.05
      reasons.push('Pronto')
    }

    if (reasons.length === 0) reasons.push('Basado en tu perfil')

    const finalScore = Math.min(1, similarity + bonus)

    return { ...event, score: Math.round(finalScore * 100) / 100, reasons }
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
  const candidates = allEvents.filter(e => e.id !== event.id && new Date(e.date) >= now)

  const scored = candidates.map(e => ({
    ...e,
    similarity: cosineSimilarity(targetVec, eventToVector(e, allGenres))
  }))

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}
