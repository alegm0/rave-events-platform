import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getComfortProfile, getTicketsByUser, getEvent } from '../../lib/db'
import { buildPreRaveBrief } from '../../lib/briefing'
import { FiStar, FiCheck, FiX, FiInfo, FiHeadphones, FiClock, FiMapPin } from 'react-icons/fi'
import './PreRaveBrief.css'

// AI Pre-Rave Brief: organizes verified event data around what this person needs.
// Grounded, not generated — every line comes from real event/venue/preference data.

const PreRaveBrief = ({ event, onMeetLineup }) => {
  const { currentUser } = useAuth()
  const [brief, setBrief] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!event) return
    let cancelled = false

    const load = async () => {
      const comfortProfile = currentUser ? await getComfortProfile(currentUser.id) : {}

      // "Known artists" = acts from events the user already has tickets for.
      let knownArtists = []
      if (currentUser) {
        const tickets = await getTicketsByUser(currentUser.id)
        const otherEventIds = [...new Set(tickets.map((t) => t.eventId).filter((eid) => eid !== event.id))]
        for (const eid of otherEventIds) {
          const e = await getEvent(eid)
          ;(e?.lineup || []).forEach((a) => knownArtists.push(typeof a === 'string' ? a : a.name))
        }
      }

      const savedArtists = currentUser?.savedArtists || []
      const b = buildPreRaveBrief(event, { comfortProfile, knownArtists, savedArtists })
      if (!cancelled) { setBrief(b); setReady(true) }
    }
    load()
    return () => { cancelled = true }
  }, [event, currentUser])

  if (!ready || !brief) return null

  const whenLabel =
    brief.days === 0 ? 'Hoy' :
    brief.days === 1 ? 'Mañana' :
    brief.days > 1 ? `En ${brief.days} días` :
    'Ya ocurrió'

  const { discovery } = brief

  return (
    <div className="brief">
      <div className="brief-head">
        <div>
          <span className="brief-kicker">Pre-Rave Brief</span>
          <h2 className="brief-title">Tu noche · {whenLabel}</h2>
        </div>
        <span className="brief-ai">Organizado para ti</span>
      </div>

      {/* Timetable */}
      <div className="brief-block">
        <h3 className="brief-block-title"><FiClock /> Cómo se desarrolla</h3>
        <ul className="brief-timetable">
          {brief.timetable.map((row, i) => (
            <li key={i} className={`brief-tt-row ${row.kind} ${row.saved ? 'is-saved' : ''}`}>
              <span className="brief-tt-time">{row.time}</span>
              <span className="brief-tt-label">
                {row.label}
                {row.saved && <FiStar className="brief-tt-star" />}
                {row.peak && <span className="brief-tt-peak">Peak</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Venue */}
      {brief.setting && (
        <div className="brief-block">
          <h3 className="brief-block-title"><FiMapPin /> Tu venue</h3>
          <p className="brief-setting">{brief.setting}</p>
        </div>
      )}

      {/* Accessibility — only if user set preferences */}
      {brief.accessibility.length > 0 && (
        <div className="brief-block">
          <h3 className="brief-block-title">Según tus preferencias</h3>
          <ul className="brief-acc">
            {brief.accessibility.map((n, i) => (
              <li key={i} className={n.ok ? 'ok' : 'no'}>
                {n.ok ? <FiCheck /> : <FiX />} {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Know before you go */}
      {brief.knowBeforeYouGo.length > 0 && (
        <div className="brief-block">
          <h3 className="brief-block-title"><FiInfo /> Antes de ir</h3>
          <ul className="brief-kbyg">
            {brief.knowBeforeYouGo.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
      )}

      {/* Music discovery */}
      {discovery.total > 0 && (
        <div className="brief-discovery">
          <div className="brief-disc-text">
            <FiHeadphones />
            <span>
              {discovery.toDiscoverCount === 0
                ? `Ya conoces a los ${discovery.total} artistas.`
                : discovery.knownCount === 0
                  ? `No conoces a ninguno de los ${discovery.total} artistas todavía.`
                  : `Conoces a ${discovery.knownCount} de ${discovery.total}. Descubre los otros ${discovery.toDiscoverCount}.`}
            </span>
          </div>
          {discovery.toDiscoverCount > 0 && onMeetLineup && (
            <button className="brief-disc-btn" onClick={onMeetLineup}>
              Conoce el lineup
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default PreRaveBrief
