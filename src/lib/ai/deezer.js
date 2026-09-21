// Deezer Public API — audio engine for the lineup preview player
// No login, no API key, no cost. Public read endpoints only.
//
// Deezer blocks browser CORS, so in dev we route through the Vite proxy
// (see vite.config.js: '/deezer' -> https://api.deezer.com).
// In production this same path must be proxied by your host/serverless function.

const BASE = '/deezer'

const request = async (path) => {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('Deezer request error:', err)
    return null
  }
}

/**
 * Find the best-matching artist on Deezer.
 * Picks the profile with the most fans to avoid duplicate/fake profiles.
 * @param {string} name - Artist name
 * @returns {object|null} { id, name, picture, fans, deezerUrl }
 */
export const findArtist = async (name) => {
  if (!name?.trim()) return null
  const data = await request(`/search/artist?q=${encodeURIComponent(name)}&limit=5`)
  const items = data?.data || []
  if (items.length === 0) return null

  // Prefer the official profile: highest fan count wins
  const best = items.reduce((a, b) => ((b.nb_fan || 0) > (a.nb_fan || 0) ? b : a))

  return {
    id: best.id,
    name: best.name,
    picture: best.picture_medium || best.picture || null,
    fans: best.nb_fan || 0,
    deezerUrl: best.link || null
  }
}

/**
 * Get an artist's top tracks with playable 30s preview mp3 URLs.
 * @param {number|string} artistId
 * @param {number} limit
 * @returns {Array} tracks with { id, name, previewUrl, albumName, albumArt, duration }
 */
export const getTopTracks = async (artistId, limit = 5) => {
  const data = await request(`/artist/${artistId}/top?limit=${limit}`)
  const tracks = data?.data || []
  return tracks
    .filter((t) => !!t.preview) // only tracks we can actually play
    .map((t) => ({
      id: t.id,
      name: t.title,
      previewUrl: t.preview,
      albumName: t.album?.title || '',
      albumArt: t.album?.cover_medium || t.album?.cover || null,
      duration: (t.duration || 30) * 1000,
      deezerUrl: t.link || null
    }))
}

/**
 * Convenience: resolve an artist name straight to its playable tracks.
 * @param {string} name
 * @param {number} limit
 * @returns {{ artist: object, tracks: Array }|null}
 */
export const getArtistTracks = async (name, limit = 5) => {
  const artist = await findArtist(name)
  if (!artist) return null
  const tracks = await getTopTracks(artist.id, limit)
  return { artist, tracks }
}
