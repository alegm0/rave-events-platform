import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEvent, updateEvent } from '../../lib/db'
import { uploadImage } from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'
import { FiArrowLeft, FiCheck, FiMapPin, FiCalendar, FiClock, FiUsers, FiDollarSign, FiImage, FiLoader } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import VenueEditor from '../../components/venue/VenueEditor'
import { VENUE_LAYOUT_VERSION } from '../../lib/db'
import './CreateEvent.css'

const GENRES = [
  'Techno', 'House', 'Trance', 'Hardstyle', 'Drum & Bass', 'Ambient', 'Minimal', 'Acid',
  'Deep House', 'Tech House', 'Afro House', 'Melodic Techno', 'Industrial Techno', 'Dark Techno',
  'Progressive House', 'Progressive Trance', 'Psytrance', 'Goa Trance',
  'Dubstep', 'Future Bass', 'Garage', 'UK Garage', 'Breakbeat', 'Electro',
  'Downtempo', 'Lo-Fi', 'IDM', 'Experimental', 'Synthwave', 'EBM',
  'Disco', 'Nu Disco', 'Italo Disco', 'Funk', 'Afrobeat',
  'Hardcore', 'Gabber', 'Frenchcore', 'Hard Techno',
  'Dub Techno', 'Microhouse', 'Organic House', 'Tribal',
]

const IMAGES = [
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&q=80',
  'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=800&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
]

const EditEvent = () => {
  const { id } = useParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [genreSearch, setGenreSearch] = useState('')
  const [showGenres, setShowGenres] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(null)

  useEffect(() => {
    const load = async () => {
      const event = await getEvent(id)
      if (!event || event.organizerId !== currentUser?.id) {
        navigate('/organizer/my-events')
        toast.error('Evento no encontrado')
        return
      }
      setForm({
        title: event.title || '',
        description: event.description || '',
        date: event.date || '',
        time: event.time || '22:00',
        duration: String(event.duration || 6),
        location: event.location || '',
        address: event.address || '',
        city: event.city || '',
        price: String(event.price || 0),
        capacity: String(event.capacity || 200),
        genre: event.genre || '',
        imageUrl: event.imageUrl || '',
        imagePos: event.imagePos || 50,
        minAge: String(event.minAge || 18),
        lineup: event.lineup || [],
        uploadedImage: null,
        uploadedFile: null,
        pricingMode: event.pricingMode || 'single',
        tiers: event.tiers?.length ? event.tiers : [
          { name: 'Early Bird', price: '', qty: '' },
          { name: 'First Release', price: '', qty: '' },
        ],
        venue: event.venue || null,
      })
      setLoading(false)
    }
    load()
  }, [id, currentUser])

  if (loading || !form) return <div className="ce-page"><div className="container" style={{ padding: '8rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Cargando evento...</div></div>

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const handleSave = async () => {
    const e = {}
    if (!form.title.trim()) e.title = 'El nombre es obligatorio'
    if (!form.genre) e.genre = 'Selecciona un género'
    if (!form.date) e.date = 'La fecha es obligatoria'
    if (!form.location.trim()) e.location = 'El venue es obligatorio'
    if (!form.city.trim()) e.city = 'La ciudad es obligatoria'
    setErrors(e)
    if (Object.keys(e).length > 0) { toast.error('Revisa los campos marcados'); return }

    setSaving(true)
    try {
      let finalImageUrl = form.imageUrl
      if (form.uploadedFile) {
        finalImageUrl = await uploadImage(form.uploadedFile, `events/${currentUser.id}`)
      }

      await updateEvent(id, {
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date,
        time: form.time,
        duration: parseInt(form.duration) || 6,
        imagePos: form.imagePos,
        location: form.location.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        price: form.pricingMode === 'single' ? (parseFloat(form.price) || 0) : parseFloat(form.tiers[0]?.price || 0),
        pricingMode: form.pricingMode,
        tiers: form.pricingMode === 'tiers' ? form.tiers.filter(t => t.name && t.price) : [],
        capacity: parseInt(form.capacity) || 200,
        genre: form.genre,
        imageUrl: finalImageUrl,
        minAge: parseInt(form.minAge) || 18,
        lineup: form.lineup.filter(a => a.name.trim()),
        // Saving here means the organizer reviewed the venue: from now on it is
        // theirs and the automatic template backfill leaves it alone.
        venue: form.venue || null,
        venueAuthored: !!form.venue,
        venueVersion: VENUE_LAYOUT_VERSION,
      })
      navigate(`/organizer/event/${id}/analytics`)
      toast.success('¡Evento actualizado!')
    } catch (err) {
      toast.error('Error guardando: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ce-page">
      <div className="container">
        <div className="ce-layout">
          <div className="ce-form-side">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                <FiArrowLeft /> Volver
              </button>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>Editar Evento</h1>
            </div>

            {/* Info section */}
            <div className="ce-step">
              <h2 className="ce-step-title">Información</h2>

              <div className="ce-field">
                <label>Nombre del evento *</label>
                <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder="Ej: Berghain Nights" maxLength={60} className={errors.title ? 'error' : ''} />
                {errors.title && <span className="ce-error">{errors.title}</span>}
              </div>

              <div className="ce-field">
                <label>Género musical *</label>
                <div className="ce-genre-search-wrap">
                  <input type="text" value={form.genre || genreSearch}
                    onChange={e => { setGenreSearch(e.target.value); set('genre', ''); setShowGenres(true) }}
                    onFocus={() => setShowGenres(true)}
                    placeholder="Buscar género..." className={errors.genre ? 'error' : ''} />
                  {form.genre && <button type="button" className="ce-genre-clear" onClick={() => { set('genre', ''); setGenreSearch('') }}>✕</button>}
                  {showGenres && (
                    <div className="ce-genre-dropdown">
                      {GENRES.filter(g => g.toLowerCase().includes((genreSearch || '').toLowerCase())).slice(0, 10).map(g => (
                        <button key={g} type="button" className="ce-genre-option"
                          onClick={() => { set('genre', g); setGenreSearch(''); setShowGenres(false) }}>{g}</button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.genre && <span className="ce-error">{errors.genre}</span>}
              </div>

              <div className="ce-field">
                <label>Descripción</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Describe la experiencia..." rows={4} />
              </div>

              <div className="ce-field">
                <label>Line-up</label>
                <div className="ce-lineup-list">
                  {form.lineup.map((artist, i) => (
                    <div key={i} className="ce-lineup-row">
                      <input type="time" value={artist.time} onChange={e => {
                        const updated = [...form.lineup]; updated[i] = { ...updated[i], time: e.target.value }; set('lineup', updated)
                      }} className="ce-lineup-time" />
                      <input type="text" value={artist.name} onChange={e => {
                        const updated = [...form.lineup]; updated[i] = { ...updated[i], name: e.target.value }; set('lineup', updated)
                      }} placeholder="Nombre del DJ / Artista" className="ce-lineup-name" />
                      <button type="button" className="ce-lineup-remove" onClick={() => {
                        set('lineup', form.lineup.filter((_, j) => j !== i))
                      }}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="ce-lineup-add" onClick={() => {
                    set('lineup', [...form.lineup, { name: '', time: '' }])
                  }}>+ Agregar artista</button>
                </div>
              </div>
            </div>

            {/* Date & Location */}
            <div className="ce-step" style={{ marginTop: '2rem' }}>
              <h2 className="ce-step-title">Fecha y lugar</h2>
              <div className="ce-row">
                <div className="ce-field">
                  <label><FiCalendar /> Fecha *</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={errors.date ? 'error' : ''} />
                  {errors.date && <span className="ce-error">{errors.date}</span>}
                </div>
                <div className="ce-field">
                  <label><FiClock /> Hora</label>
                  <input type="time" value={form.time} onChange={e => set('time', e.target.value)} />
                </div>
              </div>
              <div className="ce-field">
                <label>Duración (horas)</label>
                <input type="number" value={form.duration} min="1" max="168"
                  onChange={e => set('duration', e.target.value)} style={{ width: '100px' }} />
              </div>
              <div className="ce-field">
                <label><FiMapPin /> Venue *</label>
                <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                  className={errors.location ? 'error' : ''} />
                {errors.location && <span className="ce-error">{errors.location}</span>}
              </div>
              <div className="ce-row">
                <div className="ce-field">
                  <label>Dirección</label>
                  <input type="text" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>
                <div className="ce-field">
                  <label>Ciudad *</label>
                  <input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={errors.city ? 'error' : ''} />
                  {errors.city && <span className="ce-error">{errors.city}</span>}
                </div>
              </div>
            </div>

            {/* Tickets */}
            <div className="ce-step" style={{ marginTop: '2rem' }}>
              <h2 className="ce-step-title">Tickets</h2>
              <div className="ce-row">
                <div className="ce-field">
                  <label><FiUsers /> Capacidad</label>
                  <input type="number" value={form.capacity} min="10" onChange={e => set('capacity', e.target.value)} />
                </div>
                <div className="ce-field">
                  <label><FiDollarSign /> Precio (USD)</label>
                  <input type="number" value={form.price} min="0" onChange={e => set('price', e.target.value)} />
                </div>
              </div>
              <div className="ce-field">
                <label>Edad mínima</label>
                <div className="ce-age-options">
                  {['16', '18', '21'].map(age => (
                    <button key={age} type="button" className={`ce-age-btn ${form.minAge === age ? 'active' : ''}`} onClick={() => set('minAge', age)}>+{age}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Venue experience */}
            <div className="ce-step" style={{ marginTop: '2rem' }}>
              <h2 className="ce-step-title">Experiencia en el venue</h2>
              <VenueEditor value={form.venue} onChange={v => set('venue', v)} />
            </div>

            {/* Image */}
            <div className="ce-step" style={{ marginTop: '2rem' }}>
              <h2 className="ce-step-title">Imagen</h2>
              <div className="ce-field">
                <label><FiImage /> Subir nueva imagen</label>
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files[0]
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }
                    set('uploadedFile', file)
                    set('uploadedImage', URL.createObjectURL(file))
                    set('imageUrl', URL.createObjectURL(file))
                  }
                }} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }} />
              </div>
              <div className="ce-field">
                <label>O elige de la galería</label>
                <div className="ce-image-grid">
                  {IMAGES.map((img, i) => (
                    <button key={i} type="button"
                      className={`ce-image-option ${form.imageUrl === img ? 'active' : ''}`}
                      onClick={() => { set('imageUrl', img); set('uploadedImage', null); set('uploadedFile', null) }}>
                      <img src={img} alt="" loading="lazy" />
                      {form.imageUrl === img && <div className="ce-image-check"><FiCheck /></div>}
                    </button>
                  ))}
                </div>
              </div>
              {form.imageUrl && (
                <div className="ce-field">
                  <label>Posición vertical</label>
                  <div className="ce-pos-slider">
                    <span>Arriba</span>
                    <input type="range" min="0" max="100" value={form.imagePos}
                      onChange={e => set('imagePos', parseInt(e.target.value))} />
                    <span>Abajo</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="ce-nav" style={{ marginTop: '2rem' }}>
              <Button variant="ghost" onClick={() => navigate(-1)} icon={<FiArrowLeft />}>Cancelar</Button>
              <div style={{ flex: 1 }}></div>
              <Button size="lg" onClick={handleSave} disabled={saving}>
                {saving ? <><FiLoader className="spin" /> Guardando...</> : <>Guardar Cambios <FiCheck /></>}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="ce-preview">
            <div className="ce-preview-label">Vista previa</div>
            <div className="ce-preview-card">
              <div className="ce-preview-img">
                <img src={form.imageUrl || IMAGES[0]} alt="" style={{ objectPosition: `center ${form.imagePos}%` }} />
                {form.genre && <span className="ce-preview-genre">{form.genre}</span>}
              </div>
              <div className="ce-preview-body">
                <h3>{form.title || 'Nombre del evento'}</h3>
                {form.date && (
                  <p className="ce-preview-meta">
                    <FiCalendar /> {new Date(form.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {form.time && ` · ${form.time}`}
                  </p>
                )}
                {form.location && (
                  <p className="ce-preview-meta"><FiMapPin /> {form.location}{form.city ? `, ${form.city}` : ''}</p>
                )}
                <div className="ce-preview-footer">
                  <span className="ce-preview-price">
                    {parseFloat(form.price) === 0 ? 'Gratis' : `$${parseFloat(form.price || 0).toFixed(2)}`}
                  </span>
                  {form.capacity && <span className="ce-preview-cap"><FiUsers /> {form.capacity}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditEvent
