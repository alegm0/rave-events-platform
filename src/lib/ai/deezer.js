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
 * Fallback: some underground artists have an empty /top endpoint on Deezer
 * (licensing), yet their tracks exist via plain search. We query by name and
 * keep only tracks credited to the same artist, so the player still has
 * something real to play instead of showing an empty card.
 * @param {string} name
 * @param {number} limit
 * @returns {Array} playable tracks (same shape as getTopTracks)
 */
export const searchTracksByArtist = async (name, limit = 5) => {
  if (!name?.trim()) return []
  const data = await request(`/search?q=${encodeURIComponent(name)}&limit=25`)
  const tracks = data?.data || []
  const target = name.trim().toLowerCase()
  return tracks
    .filter((t) => !!t.preview && (t.artist?.name || '').toLowerCase() === target)
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      name: t.title,
      previewUrl: t.preview,
      albumName: t.album?.title || '',
      albumArt: t.album?.cover_medium || t.album?.cover || null,
      duration: (t.duration || 30) * 1000,
      deezerUrl: t.link || null,
    }))
}

/**
 * Convenience: resolve an artist name straight to its playable tracks.
 * Tries the artist's top tracks first, then falls back to a name search.
 * @param {string} name
 * @param {number} limit
 * @returns {{ artist: object, tracks: Array }|null}
 */
export const getArtistTracks = async (name, limit = 5) => {
  const artist = await findArtist(name)
  if (!artist) return null
  let tracks = await getTopTracks(artist.id, limit)
  if (tracks.length === 0) tracks = await searchTracksByArtist(artist.name, limit)
  return { artist, tracks }
}

// Artist photo with a persistent localStorage cache. Deezer photos are stable,
// so once resolved we keep the URL in the browser — instant on later visits and
// shared across the Artists page and the profile's "followed artists". We cache
// misses too ('') so we don't repeatedly hit Deezer for an artist it can't find.
const IMG_PREFIX = 'rave:artistimg:'
export const getArtistImage = async (name) => {
  if (!name?.trim()) return null
  const key = IMG_PREFIX + name.trim().toLowerCase()
  try {
    const cached = localStorage.getItem(key)
    if (cached !== null) return cached || null
  } catch { /* localStorage unavailable — fall through to network */ }

  const artist = await findArtist(name)
  const url = artist?.picture || ''
  try { localStorage.setItem(key, url) } catch { /* quota/full — ignore */ }
  return url || null
}
