import { useState, useEffect, useRef } from 'react'
import { searchArtist, analyzeLineupStyle } from '../../lib/ai/spotify'
import { getTopTracks as getDeezerTracks, findArtist as findDeezerArtist, searchTracksByArtist } from '../../lib/ai/deezer'
import { useAuth } from '../../context/AuthContext'
import { getSavedArtists, toggleSavedArtist } from '../../lib/db'
import { FiMusic, FiExternalLink, FiPlay, FiPause, FiStar } from 'react-icons/fi'
import './AIComponents.css'

const SpotifyLineup = ({ lineup }) => {
  const { currentUser, userProfile } = useAuth()
  // Only ravers (not organizers) can save favourite artists — it feeds their
  // Pre-Rave Brief and recommendations, which an organizer account doesn't have.
  const isRaver = !!currentUser && userProfile?.role !== 'organizer'
  const [artists, setArtists] = useState([])
  const [styleProfile, setStyleProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playingTrack, setPlayingTrack] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState([])
  // Hold the active audio in a ref so the unmount cleanup always sees the
  // CURRENT audio element and can stop it (fixes "music keeps playing after
  // navigating back").
  const audioRef = useRef(null)

  useEffect(() => {
    if (!lineup || lineup.length === 0) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        // For each artist: identity/branding from Spotify, playable audio from Deezer
        const results = []
        for (const entry of lineup.slice(0, 6)) {
          const name = typeof entry === 'string' ? entry : entry.name
          if (!name?.trim()) continue

          // Spotify = the recognizable brand + image + genres (visual only)
          const spotify = await searchArtist(name)

          // Deezer = the audio engine (real playable 30s previews, no login)
          let tracks = []
          const deezer = await findDeezerArtist(name)
          if (deezer) {
            tracks = await getDeezerTracks(deezer.id, 5)
            // Some underground artists have an empty /top endpoint — fall back
            // to a name search so the player still has real previews to play.
            if (tracks.length === 0) tracks = await searchTracksByArtist(deezer.name, 5)
          }

          // Merge: prefer Spotify branding, fall back to Deezer picture
          if (spotify || deezer) {
            results.push({
              id: spotify?.id || `dz-${deezer?.id}`,
              name: spotify?.name || deezer?.name || name,
              image: spotify?.image || deezer?.picture || null,
              genres: spotify?.genres || [],
              spotifyUrl: spotify?.spotifyUrl || null,
              deezerUrl: deezer?.deezerUrl || null,
              tracks
            })
          }
        }
        setArtists(results)

        // Style analysis (Spotify metadata)
        const style = await analyzeLineupStyle(lineup)
        setStyleProfile(style)
      } catch (err) {
        console.error('Lineup player load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [lineup])

  // Stop any playing preview when the component unmounts (navigating away).
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  // Load the user's saved artists so the ⭐ reflects their real state (ravers only)
  useEffect(() => {
    if (!isRaver) { setSaved([]); return }
    getSavedArtists(currentUser.id).then(setSaved)
  }, [isRaver, currentUser])

  const isSaved = (name) => saved.some((a) => a.toLowerCase() === name.toLowerCase())

  const toggleSave = async (name) => {
    if (!isRaver || !name) return
    const next = await toggleSavedArtist(currentUser.id, name)
    setSaved(next)
  }

  const playPreview = (track) => {
    if (!track.previewUrl) return

    // Toggle off if the same track is playing.
    if (playingTrack === track.id) {
      audioRef.current?.pause()
      setPlayingTrack(null)
      return
    }

    // Stop whatever was playing before starting the new track.
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    const a = new Audio(track.previewUrl)
    a.volume = 0.5
    a.play()
    a.onended = () => setPlayingTrack(null)
    audioRef.current = a
    setPlayingTrack(track.id)
  }

  if (loading) return <div className="ai-section"><div className="ai-loading">🎵 Analizando lineup...</div></div>
  if (artists.length === 0) return null

  const playableCount = artists.filter(a => a.tracks.length > 0).length

  return (
    <div className="ai-section">
      <div className="ai-section-header">
        <h2 className="ai-section-title"><FiMusic /> AI Playlist · Style Fingerprint</h2>
        <span className="ai-badge">AI-Powered</span>
      </div>

      {/* Style Profile */}
      {styleProfile && (
        <div className="ai-style-profile">
          <div className="ai-style-moods">
            {styleProfile.moods.map(m => (
              <span key={m} className="ai-mood-tag">{m}</span>
            ))}
          </div>
          <div className="ai-style-genres">
            {styleProfile.topGenres.slice(0, 5).map(g => (
              <span key={g} className="ai-genre-pill">{g}</span>
            ))}
          </div>
          <div className="ai-style-meta">
            <span>Underground Score: <strong>{styleProfile.undergroundScore}%</strong></span>
            <span>·</span>
            <span>{playableCount} artistas con preview reproducible</span>
          </div>
        </div>
      )}

      {/* Artist Cards with Tracks */}
      <div className="ai-artists-grid">
        {artists.slice(0, expanded ? 10 : 3).map(artist => (
          <div key={artist.id} className="ai-artist-card">
            <div className="ai-artist-header">
              {artist.image && <img src={artist.image} alt="" className="ai-artist-img" />}
              <div className="ai-artist-info">
                <h4>{artist.name}</h4>
                <span className="ai-artist-genres">{artist.genres.slice(0, 2).join(', ')}</span>
              </div>
              {isRaver && (
                <button
                  type="button"
                  className={`ai-save-artist ${isSaved(artist.name) ? 'is-saved' : ''}`}
                  onClick={() => toggleSave(artist.name)}
                  aria-pressed={isSaved(artist.name)}
                  title={isSaved(artist.name) ? 'Quitar de los que quieres ver' : 'Marca los que quieres ver'}>
                  <FiStar />
                </button>
              )}
              {(artist.spotifyUrl || artist.deezerUrl) && (
                <a href={artist.spotifyUrl || artist.deezerUrl} target="_blank" rel="noopener noreferrer"
                  className="ai-spotify-link" title={artist.spotifyUrl ? 'Abrir en Spotify' : 'Abrir en Deezer'}>
                  <FiExternalLink />
                </a>
              )}
            </div>
            {artist.tracks.length > 0 && (
              <div className="ai-tracks">
                {artist.tracks.slice(0, 3).map(track => (
                  <div key={track.id} className="ai-track">
                    <button className="ai-track-play" onClick={() => playPreview(track)}
                      disabled={!track.previewUrl}>
                      {playingTrack === track.id ? <FiPause /> : <FiPlay />}
                    </button>
                    <div className="ai-track-info">
                      <span className="ai-track-name">{track.name}</span>
                      <span className="ai-track-album">{track.albumName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {artists.length > 3 && (
        <button className="ai-show-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Ver menos' : `Ver ${artists.length - 3} artistas más`}
        </button>
      )}
    </div>
  )
}

export default SpotifyLineup
