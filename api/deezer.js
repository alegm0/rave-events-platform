// Vercel Serverless Function — Deezer proxy.
//
// Deezer's public API blocks browser CORS, so the browser cannot call
// api.deezer.com directly. In dev this is handled by the Vite proxy
// (see vite.config.js: '/deezer' -> https://api.deezer.com). In production
// that proxy does not exist, so this serverless function takes its place.
//
// The client keeps calling '/deezer/<path>' unchanged; vercel.json rewrites
// '/deezer/:path*' to this function, which forwards the request server-side
// (no CORS restriction) and returns the JSON.
//
// No API key or secret is required — Deezer's public read endpoints are open.
//
// Usage from the client (unchanged from dev):
//   GET /deezer/search/artist?q=Amelie%20Lens&limit=5
//   GET /deezer/artist/<id>/top?limit=5

const DEEZER_BASE = 'https://api.deezer.com'

export default async function handler(req, res) {
  // Everything after '/deezer' is the Deezer API path (plus query string).
  // e.g. req.url === '/deezer/search/artist?q=...'  ->  '/search/artist?q=...'
  const forwardPath = req.url.replace(/^\/deezer/, '') || '/'

  try {
    const upstream = await fetch(`${DEEZER_BASE}${forwardPath}`)
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'deezer_request_failed' })
    }
    const data = await upstream.json()

    // Artist/track data barely changes; cache at the edge to stay well within
    // Deezer's rate limits and keep the lineup player snappy.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'deezer_proxy_error' })
  }
}
