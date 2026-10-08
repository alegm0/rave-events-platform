import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { COMFORT_PREFERENCES, getComfortProfile, updateComfortProfile } from '../../lib/db'
import { FiMoon, FiCheck } from 'react-icons/fi'
import { MdAccessible, MdWc, MdChair, MdShortText } from 'react-icons/md'
import './ComfortProfile.css'

// Human-centered preferences with agency:
// nothing is assumed, everything is opt-in and editable at any time.
const ICONS = {
  moon: <FiMoon />,
  accessible: <MdAccessible />,
  toilet: <MdWc />,
  seat: <MdChair />,
  text: <MdShortText />,
}

const ComfortProfile = ({ compact = false }) => {
  const { currentUser } = useAuth()
  const [prefs, setPrefs] = useState({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!currentUser) { setLoading(false); return }
    getComfortProfile(currentUser.id).then((p) => {
      setPrefs(p || {})
      setLoading(false)
    })
  }, [currentUser])

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    if (currentUser) {
      await updateComfortProfile(currentUser.id, next)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    }
  }

  const activeCount = Object.values(prefs).filter(Boolean).length

  // Preferences fall into two groups with different, honest effects:
  //  - "highlight" ones add/prioritise pins on the venue map and your plan
  //  - "presentation" ones change HOW info is shown (simpler plan, less text)
  const HIGHLIGHT_KEYS = ['quieterAreas', 'stepFree', 'accessibleToilets', 'restAreas']
  const highlightOn = HIGHLIGHT_KEYS.filter((k) => prefs[k]).length
  const minimalOn = !!prefs.minimalText

  // Build a precise summary of what each active preference actually does.
  const effects = []
  if (highlightOn > 0) {
    effects.push(`resaltará ${highlightOn === 1 ? 'esta zona o servicio' : `estas ${highlightOn} zonas y servicios`} en el mapa del venue y en tu plan`)
  }
  if (minimalOn) effects.push('mostrará el briefing del evento con menos texto')

  if (loading) return null

  return (
    <div className={`comfort ${compact ? 'comfort--compact' : ''}`}>
      <div className="comfort-head">
        <div>
          <h3 className="comfort-title">Haz que los eventos funcionen para ti</h3>
          <p className="comfort-sub">
            Opcional. Tú eliges qué compartir. Rave adapta la información del evento a lo que
            marques, sin asumir nada. Puedes cambiarlo cuando quieras.
          </p>
        </div>
        {saved && <span className="comfort-saved"><FiCheck /> Guardado</span>}
      </div>

      <div className="comfort-grid">
        {COMFORT_PREFERENCES.map((p) => {
          const on = !!prefs[p.key]
          return (
            <button
              key={p.key}
              type="button"
              className={`comfort-pref ${on ? 'is-on' : ''}`}
              onClick={() => toggle(p.key)}
              aria-pressed={on}
            >
              <span className="comfort-pref-icon">{ICONS[p.icon]}</span>
              <span className="comfort-pref-label">{p.label}</span>
              <span className="comfort-pref-check">{on && <FiCheck />}</span>
            </button>
          )
        })}
      </div>

      {activeCount > 0 && effects.length > 0 && (
        <p className="comfort-agency">
          Según {activeCount === 1 ? 'tu preferencia' : `tus ${activeCount} preferencias`}, Rave{' '}
          {effects.length === 1
            ? effects[0]
            : `${effects.slice(0, -1).join(', ')} y ${effects[effects.length - 1]}`}
          . Lo aplicamos porque tú lo elegiste, no porque lo asumimos.
        </p>
      )}
    </div>
  )
}

export default ComfortProfile
