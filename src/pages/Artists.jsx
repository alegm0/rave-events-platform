import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getAllLineupArtists, getSavedArtists, toggleSavedArtist } from '../lib/db'
import { findArtist, getArtistTracks, getArtistImage } from '../lib/ai/deezer'
import { useAuth } from '../context/AuthContext'
import { FiStar, FiSearch, FiPlay, FiPause, FiCalendar, FiMapPin, FiX } from 'react-icons/fi'
import './Artists.css'

// Module-level cache of artist name → photo URL, so revisiting the page or
// re-rendering cards doesn't re-hit Deezer for images already resolved.
const ARTIST_IMG_CACHE = new Map()

// Artists page: discover + follow acts WITHOUT needing an event open.
// Shows every artist across the platform's line-ups, lets you search ANY artist
// (via Deezer), follow/unfollow with ⭐, and open a detail with playable
// previews + the upcoming events where they play. Closes the loop with the
// "Artistas que sigues" section in the profile and the recommendations engine.

const Artists = () => {
  const { currentUser } = useAuth()
  const [platformArtists, setPlatformArtists] = useState([])
  const [saved, setSaved] = useState([])
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null) // artist found via Deezer (not on platform)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // { name, image, tracks, events }
  const [detailLoading, setDetailLoading] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const [artists, mine] = await Promise.all([
        getAllLineupArtists(),
        currentUser ? getSavedArtists(currentUser.id) : [],
      ])
      setPlatformArtists(artists)
      setSaved(mine)
      setLoading(false)
    }
    load()
  }, [currentUser])

  // Stop audio on unmount.
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }, [])

  // Debounced Deezer search for artists NOT already in the platform list.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setSearchResult(null); return }
    // If it already matches a platform artist, no need to hit Deezer.
    if (platformArtists.some((a) => a.name.toLowerCase().includes(q.toLowerCase()))) { setSearchResult(null); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const found = await findArtist(q)
      setSearchResult(found ? { name: found.name, image: found.picture, fans: found.fans, events: [] } : null)
      setSearching(false)
    }, 450)
    return () => clearTimeout(t)
  }, [query, platformArtists])

  const isSaved = (name) => saved.some((a) => a.toLowerCase() === name.toLowerCase())

  const toggleFollow = async (name) => {
    if (!currentUser || !name) return
    const next = await toggleSavedArtist(currentUser.id, name)
    setSaved(next)
  }

  const openArtist = async (name, eventsHint = [], imageHint = null) => {
    // Show the already-loaded card photo immediately; tracks load in.
    setSelected({ name, image: imageHint, tracks: [], events: eventsHint })
    setDetailLoading(true)
    const res = await getArtistTracks(name, 5)
    const pic = res?.artist?.picture || imageHint || null
    if (pic) ARTIST_IMG_CACHE.set(name.toLowerCase(), pic)
    setSelected((prev) => prev && prev.name === name
      ? { name, image: pic, tracks: res?.tracks || [], events: eventsHint }
      : prev)
    setDetailLoading(false)
  }

  const playPreview = (track) => {
    if (!track.previewUrl) return
    if (playingId === track.id) { audioRef.current?.pause(); setPlayingId(null); return }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    const a = new Audio(track.previewUrl)
    a.volume = 0.5
    a.play()
    a.onended = () => setPlayingId(null)
    audioRef.current = a
    setPlayingId(track.id)
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? platformArtists.filter((a) => a.name.toLowerCase().includes(q))
    : platformArtists

  // Followed artists that aren't in the platform list (e.g. searched + followed)
  const extraFollowed = saved
    .filter((n) => !platformArtists.some((a) => a.name.toLowerCase() === n.toLowerCase()))
    .map((n) => ({ name: n, events: [] }))

  const ArtistCard = ({ artist }) => {
    // Lazily fetch each artist's photo from Deezer when the card mounts, so the
    // list renders instantly and photos fill in without 41 blocking requests.
    // Seed from the in-memory cache so already-resolved photos show instantly.
    const [img, setImg] = useState(() => ARTIST_IMG_CACHE.get(artist.name.toLowerCase()) ?? artist.image ?? null)
    useEffect(() => {
      if (img) return
      let active = true
      getArtistImage(artist.name).then((pic) => {
        ARTIST_IMG_CACHE.set(artist.name.toLowerCase(), pic)
        if (active) setImg(pic)
      })
      return () => { active = false }
    }, [artist.name]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="art-card">
        <button className="art-card-main" onClick={() => openArtist(artist.name, artist.events, img)}>
          <div className="art-avatar">{img ? <img src={img} alt="" loading="lazy" /> : <span>{artist.name[0]}</span>}</div>
          <div className="art-card-info">
            <strong>{artist.name}</strong>
            {artist.events?.length > 0
              ? <span>{artist.events.length} evento{artist.events.length > 1 ? 's' : ''} próximo{artist.events.length > 1 ? 's' : ''}</span>
              : <span className="art-card-sub-muted">Ver tracks</span>}
          </div>
        </button>
        {currentUser && (
          <button
            className={`art-follow ${isSaved(artist.name) ? 'is-on' : ''}`}
            onClick={() => toggleFollow(artist.name)}
            aria-pressed={isSaved(artist.name)}
            title={isSaved(artist.name) ? 'Dejar de seguir' : 'Seguir'}>
            <FiStar />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="art-page">
      <div className="container">
        <span className="art-tag">Descubre</span>
        <h1 className="art-title">Artistas</h1>
        <p className="art-sub">Explora los DJs de la escena, escúchalos y sigue a tus favoritos. Los que sigas se usan en tus recomendaciones y tu Pre-Rave Brief.</p>

        <div className="art-search">
          <FiSearch />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca cualquier artista (ej: Nina Kraviz)…"
          />
          {query && <button className="art-search-clear" onClick={() => setQuery('')}><FiX /></button>}
        </div>

        {loading ? (
          <div className="art-loading"><div className="loader" /></div>
        ) : (
          <>
            {/* Searched artist not on the platform → still followable */}
            {searchResult && (
              <div className="art-section">
                <h2 className="art-section-title">Resultado de búsqueda</h2>
                <div className="art-grid">
                  <ArtistCard artist={searchResult} />
                </div>
              </div>
            )}
            {searching && <p className="art-searching">Buscando "{query}"…</p>}

            <div className="art-section">
              <h2 className="art-section-title">
                {q ? `Coincidencias en la escena (${filtered.length})` : `En la escena (${platformArtists.length})`}
              </h2>
              {filtered.length > 0 ? (
                <div className="art-grid">
                  {filtered.map((a) => <ArtistCard key={a.name} artist={a} />)}
                </div>
              ) : !searchResult && !searching ? (
                <p className="art-empty">No hay artistas que coincidan con "{query}" en los eventos. Prueba el buscador — puede estar en Deezer.</p>
              ) : null}
            </div>

            {/* Artists you follow that aren't currently in any line-up */}
            {extraFollowed.length > 0 && !q && (
              <div className="art-section">
                <h2 className="art-section-title">Sigues (sin eventos próximos)</h2>
                <div className="art-grid">
                  {extraFollowed.map((a) => <ArtistCard key={a.name} artist={a} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Artist detail modal */}
      {selected && (
        <div className="art-modal-backdrop" onClick={() => { audioRef.current?.pause(); setPlayingId(null); setSelected(null) }}>
          <div className="art-modal" onClick={(e) => e.stopPropagation()}>
            <button className="art-modal-close" onClick={() => { audioRef.current?.pause(); setPlayingId(null); setSelected(null) }}><FiX /></button>
            <div className="art-modal-head">
              <div className="art-avatar art-avatar--lg">{selected.image ? <img src={selected.image} alt="" /> : <span>{selected.name[0]}</span>}</div>
              <div>
                <h2>{selected.name}</h2>
                {currentUser && (
                  <button className={`art-follow-btn ${isSaved(selected.name) ? 'is-on' : ''}`} onClick={() => toggleFollow(selected.name)}>
                    <FiStar /> {isSaved(selected.name) ? 'Siguiendo' : 'Seguir'}
                  </button>
                )}
              </div>
            </div>

            {/* Tracks */}
            <div className="art-modal-section">
              <h3>Escucha</h3>
              {detailLoading ? (
                <p className="art-modal-muted">Cargando tracks…</p>
              ) : selected.tracks.length > 0 ? (
                <div className="art-tracks">
                  {selected.tracks.map((t) => (
                    <div key={t.id} className="art-track">
                      <button className="art-track-play" onClick={() => playPreview(t)} disabled={!t.previewUrl}>
                        {playingId === t.id ? <FiPause /> : <FiPlay />}
                      </button>
                      <div className="art-track-info">
                        <span className="art-track-name">{t.name}</span>
                        <span className="art-track-album">{t.albumName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="art-modal-muted">No encontramos previews reproducibles para este artista.</p>
              )}
            </div>

            {/* Upcoming events where they play */}
            {selected.events?.length > 0 && (
              <div className="art-modal-section">
                <h3>Próximos eventos</h3>
                <div className="art-ev-list">
                  {selected.events.map((e) => (
                    <Link key={e.id} to={`/event/${e.id}`} className="art-ev" onClick={() => setSelected(null)}>
                      <strong>{e.title}</strong>
                      <span><FiCalendar /> {new Date(e.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · <FiMapPin /> {e.location}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Artists
