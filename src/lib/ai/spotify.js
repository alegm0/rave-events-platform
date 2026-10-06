// Spotify integration (client side).
//
// The credentials never live here: the token exchange and the Spotify calls
// happen in the serverless function at /api/spotify (see api/spotify.js). This
// module just calls that endpoint, so nothing secret ships in the browser
// bundle.

// One request to our own proxy. Returns the `data` payload Spotify sent back,
// or null when Spotify is not configured / the call failed — callers already
// handle null by degrading gracefully.
const proxy = async (params) => {
  try {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`/api/spotify?${qs}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.configured === false) return null
    return json.data ?? null
  } catch {
    return null
  }
}

/**
 * Search for an artist on Spotify
 * @param {string} name - Artist name
 * @returns {object|null} Artist data with id, name, image, genres, popularity, uri
 */
export const searchArtist = async (name) => {
  if (!name?.trim()) return null
  const data = await proxy({ action: 'search', q: name })
  if (!data) return null

  const artist = data.artists?.items?.[0]
  if (!artist) return null

  return {
      id: artist.id,
      name: artist.name,
      image: artist.images?.[0]?.url || null,
      genres: artist.genres || [],
      popularity: typeof artist.popularity === 'number' ? artist.popularity : 0,
      uri: artist.uri,
      spotifyUrl: artist.external_urls?.spotify
  }
}

/**
 * Get top tracks for an artist
 * @param {string} artistId - Spotify artist ID
 * @returns {Array} Top tracks with preview_url, name, album art
 */
export const getArtistTopTracks = async (artistId) => {
  if (!artistId) return []
  const data = await proxy({ action: 'top-tracks', id: artistId })
  if (!data) return []

  return (data.tracks || []).slice(0, 5).map(t => ({
    id: t.id,
    name: t.name,
    previewUrl: t.preview_url,
    albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url,
    albumName: t.album?.name,
    duration: t.duration_ms,
    uri: t.uri,
    spotifyUrl: t.external_urls?.spotify
  }))
}

/**
 * Get related artists (for recommendations)
 */
export const getRelatedArtists = async (artistId) => {
  if (!artistId) return []
  const data = await proxy({ action: 'related', id: artistId })
  if (!data) return []

  return (data.artists || []).slice(0, 5).map(a => ({
    id: a.id,
    name: a.name,
    image: a.images?.[1]?.url,
    genres: a.genres,
    popularity: a.popularity,
    spotifyUrl: a.external_urls?.spotify
  }))
}

/**
 * Analyze lineup "style fingerprint" — aggregates genres from all artists
 * @param {Array} lineup - Array of {name} objects
 * @returns {object} Style profile: dominant genres, avg popularity, mood tags
 */
export const analyzeLineupStyle = async (lineup) => {
  const artists = []
  for (const entry of lineup) {
    const name = typeof entry === 'string' ? entry : entry.name
    if (!name?.trim()) continue
    const artist = await searchArtist(name)
    if (artist) artists.push(artist)
  }

  if (artists.length === 0) return null

  // Aggregate genres
  const genreCounts = {}
  artists.forEach(a => {
    a.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1 })
  })

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre)

  // Avg popularity (guard against missing values -> NaN)
  const popScores = artists.map((a) => (typeof a.popularity === 'number' ? a.popularity : 0))
  const avgPopularity = popScores.length
    ? Math.round(popScores.reduce((s, p) => s + p, 0) / popScores.length)
    : 0

  // Mood inference based on genre keywords
  const allGenres = sortedGenres.join(' ').toLowerCase()
  const moods = []
  if (allGenres.includes('dark') || allGenres.includes('industrial')) moods.push('Dark')
  if (allGenres.includes('deep') || allGenres.includes('ambient')) moods.push('Deep')
  if (allGenres.includes('acid')) moods.push('Hypnotic')
  if (allGenres.includes('melodic') || allGenres.includes('progressive')) moods.push('Euphoric')
  if (allGenres.includes('hard') || allGenres.includes('gabber')) moods.push('High Energy')
  if (allGenres.includes('minimal') || allGenres.includes('micro')) moods.push('Minimal')
  if (allGenres.includes('trance')) moods.push('Transcendent')
  if (moods.length === 0) moods.push('Underground')

  return {
    artists,
    topGenres: sortedGenres.slice(0, 8),
    avgPopularity,
    moods,
    undergroundScore: Math.max(0, 100 - avgPopularity), // less popular = more underground
  }
}

/**
 * Generate a curated track list from lineup (AI-curated pre-event mix)
 * Gets top tracks from each artist and orders them by energy
 */
export const generateEventPlaylist = async (lineup) => {
  const allTracks = []

  for (const entry of lineup) {
    const name = typeof entry === 'string' ? entry : entry.name
    if (!name?.trim()) continue
    const artist = await searchArtist(name)
    if (!artist) continue
    const tracks = await getArtistTopTracks(artist.id)
    allTracks.push(...tracks.map(t => ({ ...t, artistName: artist.name, artistImage: artist.image })))
  }

  // Shuffle but keep some order (mix artists)
  const shuffled = allTracks.sort(() => Math.random() - 0.5)
  return shuffled
}

/**
 * Check if Spotify is configured. The client can't see the secret, so it asks
 * the proxy: a harmless search that reports whether the server has credentials.
 */
export const isSpotifyConfigured = async () => {
  try {
    const res = await fetch('/api/spotify?action=search&q=test')
    if (!res.ok) return false
    const json = await res.json()
    return json.configured !== false
  } catch {
    return false
  }
}
