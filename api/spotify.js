// Vercel Serverless Function — Spotify proxy.
//
// The Spotify Client Credentials flow needs a client secret. Doing it in the
// browser would ship that secret in the public bundle, so the whole exchange
// happens here instead, on the server. The browser only ever talks to this
// endpoint; the secret never leaves Vercel.
//
// Configure in the Vercel project (NOT with the VITE_ prefix, so it stays
// server-side): SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
//
// Usage from the client:
//   GET /api/spotify?action=search&q=Amelie%20Lens
//   GET /api/spotify?action=top-tracks&id=<artistId>
//   GET /api/spotify?action=related&id=<artistId>

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

// Token cached across warm invocations of the same function instance.
let accessToken = null
let tokenExpiry = 0

const getToken = async () => {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  if (!CLIENT_ID || !CLIENT_SECRET) return null

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  const data = await res.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return accessToken
}

const spotifyGet = async (path, token) => {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export default async function handler(req, res) {
  const { action, q, id, market = 'CO' } = req.query || {}

  if (!CLIENT_ID || !CLIENT_SECRET) {
    // Not configured: report it clearly so the client can degrade gracefully.
    return res.status(200).json({ configured: false })
  }

  const token = await getToken()
  if (!token) return res.status(502).json({ error: 'spotify_auth_failed' })

  try {
    let data = null
    if (action === 'search') {
      if (!q) return res.status(400).json({ error: 'missing_q' })
      data = await spotifyGet(`/search?q=${encodeURIComponent(q)}&type=artist&limit=1`, token)
    } else if (action === 'top-tracks') {
      if (!id) return res.status(400).json({ error: 'missing_id' })
      data = await spotifyGet(`/artists/${id}/top-tracks?market=${encodeURIComponent(market)}`, token)
    } else if (action === 'related') {
      if (!id) return res.status(400).json({ error: 'missing_id' })
      data = await spotifyGet(`/artists/${id}/related-artists`, token)
    } else {
      return res.status(400).json({ error: 'unknown_action' })
    }

    // Cache successful responses at the edge for a few minutes: artist data
    // barely changes and this keeps us well within Spotify's rate limits.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ configured: true, data })
  } catch (err) {
    return res.status(502).json({ error: 'spotify_request_failed' })
  }
}
