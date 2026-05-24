import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEvent } from '../../lib/db'
import { useAuth } from '../../context/AuthContext'
import { FiArrowRight, FiArrowLeft, FiCheck, FiMapPin, FiCalendar, FiClock, FiUsers, FiDollarSign, FiImage, FiMusic } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
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

const today = new Date().toISOString().split('T')[0]

const CreateEvent = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [genreSearch, setGenreSearch] = useState('')
  const [showGenres, setShowGenres] = useState(false)
  const [lineupMode, setLineupMode] = useState('individual')
  const [bulkLineup, setBulkLineup] = useState('')
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    title: '', description: '', date: '', time: '22:00', duration: '6',
    multiDay: false, endDate: '',
    location: '', address: '', city: '', price: '0', capacity: '200',
    genre: '', imageUrl: '', imagePos: 50, minAge: '18',
    lineup: [],
    uploadedImage: null,
    pricingMode: 'single', // 'single' or 'tiers'
    tiers: [
      { name: 'Early Bird', price: '', qty: '' },
      { name: 'First Release', price: '', qty: '' },
    ],
  })

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const validateStep = (s) => {
    const e = {}
    if (s === 1) {
      if (!form.title.trim()) e.title = 'El nombre es obligatorio'
      if (form.title.length > 60) e.title = 'Máximo 60 caracteres'
      if (!form.genre) e.genre = 'Selecciona un género'
      if (!form.description.trim()) e.description = 'Agrega una descripción'
      if (form.description.length < 20) e.description = 'Mínimo 20 caracteres'
    }
    if (s === 2) {
      if (!form.date) e.date = 'La fecha es obligatoria'
      if (form.date && form.date < today) e.date = 'La fecha debe ser hoy o en el futuro'
      if (!form.time) e.time = 'La hora es obligatoria'
      if (!form.location.trim()) e.location = 'El venue es obligatorio'
      if (!form.city.trim()) e.city = 'La ciudad es obligatoria'
    }
    if (s === 3) {
      const price = parseFloat(form.price)
      if (isNaN(price) || price < 0) e.price = 'Precio inválido'
      const cap = parseInt(form.capacity)
      if (isNaN(cap) || cap < 10) e.capacity = 'Mínimo 10 personas'
      if (cap > 50000) e.capacity = 'Máximo 50,000 personas'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const nextStep = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, 4)) }
  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  const handleSubmit = () => {
    if (!validateStep(3)) { setStep(3); return }
    createEvent({
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
      imageUrl: form.imageUrl || IMAGES[0],
      minAge: parseInt(form.minAge) || 18,
      lineup: form.lineup.filter(a => a.name.trim()),
      organizerId: currentUser.id,
      status: 'active',
      ticketsSold: 0,
    })
    navigate('/organizer/dashboard')
    toast.success('¡Evento publicado exitosamente!')
  }

  return (
    <div className="ce-page">
      <div className="container">
        <div className="ce-layout">
          {/* Form side */}
          <div className="ce-form-side">
            {/* Progress */}
            <div className="ce-progress">
              {['Información', 'Fecha y lugar', 'Tickets', 'Imagen'].map((label, i) => (
                <button key={i} type="button"
                  className={`ce-prog-step ${step > i + 1 ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}
                  onClick={() => { if (step > i + 1 || (i + 1 <= step)) setStep(i + 1) }}>
                  <div className="ce-prog-dot">{step > i + 1 ? <FiCheck /> : i + 1}</div>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Step 1: Info */}
            {step === 1 && (
              <div className="ce-step">
                <h2 className="ce-step-title">Información del evento</h2>
                <p className="ce-step-desc">Lo esencial: nombre, género y descripción.</p>

                <div className="ce-field">
                  <label>Nombre del evento *</label>
                  <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                    placeholder="Ej: Berghain Nights" maxLength={60} className={errors.title ? 'error' : ''} />
                  <div className="ce-field-footer">
                    {errors.title && <span className="ce-error">{errors.title}</span>}
                    <span className="ce-counter">{form.title.length}/60</span>
                  </div>
                </div>

                <div className="ce-field">
                  <label>Género musical *</label>
                  <div className="ce-genre-search-wrap">
                    <input type="text" value={form.genre || genreSearch}
                      onChange={e => { setGenreSearch(e.target.value); set('genre', ''); setShowGenres(true) }}
                      onFocus={() => setShowGenres(true)}
                      placeholder="Buscar género: techno, house, afro house..."
                      className={errors.genre ? 'error' : ''} />
                    {form.genre && (
                      <button type="button" className="ce-genre-clear" onClick={() => { set('genre', ''); setGenreSearch('') }}>✕</button>
                    )}
                    {showGenres && (
                      <div className="ce-genre-dropdown">
                        {GENRES.filter(g => g.toLowerCase().includes((genreSearch || '').toLowerCase())).slice(0, 10).map(g => (
                          <button key={g} type="button" className="ce-genre-option"
                            onClick={() => { set('genre', g); setGenreSearch(''); setShowGenres(false) }}>{g}</button>
                        ))}
                        {genreSearch && !GENRES.find(g => g.toLowerCase() === genreSearch.toLowerCase()) && (
                          <button type="button" className="ce-genre-option ce-genre-custom"
                            onClick={() => { set('genre', genreSearch); setShowGenres(false) }}>
                            Usar "{genreSearch}" como género
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.genre && <span className="ce-error">{errors.genre}</span>}
                </div>

                <div className="ce-field">
                  <label>Descripción *</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)}
                    placeholder="Describe la experiencia: ambiente, artistas, qué hace único a tu evento..."
                    rows={4} className={errors.description ? 'error' : ''} />
                  <div className="ce-field-footer">
                    {errors.description && <span className="ce-error">{errors.description}</span>}
                    <span className="ce-counter">{form.description.length} caracteres</span>
                  </div>
                </div>

                <div className="ce-field">
                  <label>Line-up (opcional)</label>
                  <div className="ce-lineup-modes">
                    <button type="button" className={`ce-lineup-mode ${lineupMode === 'individual' ? 'active' : ''}`}
                      onClick={() => setLineupMode('individual')}>Uno por uno</button>
                    <button type="button" className={`ce-lineup-mode ${lineupMode === 'bulk' ? 'active' : ''}`}
                      onClick={() => setLineupMode('bulk')}>Pegar lista</button>
                  </div>

                  {lineupMode === 'individual' ? (
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
                  ) : (
                    <div>
                      <textarea value={bulkLineup} onChange={e => setBulkLineup(e.target.value)}
                        placeholder="Pega tu lista de artistas, uno por línea:&#10;23:00 Amelie Lens&#10;01:00 FJAAK&#10;03:00 Kobosil&#10;&#10;O solo nombres:&#10;Amelie Lens&#10;FJAAK&#10;Kobosil"
                        rows={6} style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem', fontFamily: 'var(--font-body)', resize: 'vertical' }} />
                      <button type="button" className="ce-lineup-add" style={{ marginTop: '0.5rem' }} onClick={() => {
                        const lines = bulkLineup.split('\n').filter(l => l.trim())
                        const parsed = lines.map(line => {
                          const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)/)
                          if (timeMatch) return { time: timeMatch[1], name: timeMatch[2].trim() }
                          return { time: '', name: line.trim() }
                        })
                        set('lineup', [...form.lineup, ...parsed])
                        setBulkLineup('')
                        setLineupMode('individual')
                      }}>Importar {bulkLineup.split('\n').filter(l => l.trim()).length} artistas</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Date & Location */}
            {step === 2 && (
              <div className="ce-step">
                <h2 className="ce-step-title">Fecha y lugar</h2>
                <p className="ce-step-desc">¿Cuándo y dónde será la experiencia?</p>

                <div className="ce-row">
                  <div className="ce-field">
                    <label><FiCalendar /> Fecha de inicio *</label>
                    <input type="date" value={form.date} min={today}
                      onChange={e => set('date', e.target.value)} className={errors.date ? 'error' : ''} />
                    {errors.date && <span className="ce-error">{errors.date}</span>}
                  </div>
                  <div className="ce-field">
                    <label><FiClock /> Hora de inicio *</label>
                    <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                      className={errors.time ? 'error' : ''} />
                    {errors.time && <span className="ce-error">{errors.time}</span>}
                  </div>
                </div>

                <div className="ce-field">
                  <label><FiClock /> Duración del evento</label>
                  <div className="ce-duration-grid">
                    {[
                      { val: '3', label: '3h', sub: 'Set corto' },
                      { val: '6', label: '6h', sub: 'Club night' },
                      { val: '10', label: '10h', sub: 'Noche completa' },
                      { val: '12', label: '12h', sub: 'After incluido' },
                      { val: '24', label: '24h', sub: 'Maratón' },
                      { val: '48', label: '48h', sub: 'Festival' },
                    ].map(d => (
                      <button key={d.val} type="button"
                        className={`ce-dur-btn ${form.duration === d.val ? 'active' : ''}`}
                        onClick={() => { set('duration', d.val); set('multiDay', parseInt(d.val) > 20) }}>
                        <strong>{d.label}</strong>
                        <span>{d.sub}</span>
                      </button>
                    ))}
                  </div>
                  <div className="ce-custom-dur">
                    <span>O personaliza:</span>
                    <input type="number" value={form.duration} min="1" max="168"
                      onChange={e => { set('duration', e.target.value); set('multiDay', parseInt(e.target.value) > 20) }}
                      style={{ width: '70px' }} />
                    <span>horas</span>
                  </div>
                  {form.date && form.time && (
                    <div className="ce-duration-preview">
                      📅 {new Date(form.date + 'T' + form.time).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} {form.time}
                      {' → '}
                      {(() => {
                        const start = new Date(form.date + 'T' + form.time)
                        const end = new Date(start.getTime() + parseInt(form.duration || 6) * 3600000)
                        return end.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + end.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                      })()}
                      {parseInt(form.duration) > 20 && <span className="ce-multiday-badge">Multi-día</span>}
                    </div>
                  )}
                </div>

                <div className="ce-field">
                  <label><FiMapPin /> Nombre del venue *</label>
                  <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                    placeholder="Ej: Warehouse District" className={errors.location ? 'error' : ''} />
                  {errors.location && <span className="ce-error">{errors.location}</span>}
                </div>

                <div className="ce-row">
                  <div className="ce-field">
                    <label>Dirección</label>
                    <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                      placeholder="Calle y número" />
                  </div>
                  <div className="ce-field">
                    <label>Ciudad *</label>
                    <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                      placeholder="Ej: Bogotá" className={errors.city ? 'error' : ''} />
                    {errors.city && <span className="ce-error">{errors.city}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Tickets */}
            {step === 3 && (
              <div className="ce-step">
                <h2 className="ce-step-title">Tickets y capacidad</h2>
                <p className="ce-step-desc">Define el precio y cuántas personas pueden asistir.</p>

                <div className="ce-field">
                  <label><FiUsers /> Capacidad máxima</label>
                  <input type="number" value={form.capacity} min="10" max="50000"
                    onChange={e => set('capacity', e.target.value)} className={errors.capacity ? 'error' : ''} />
                  {errors.capacity && <span className="ce-error">{errors.capacity}</span>}
                </div>

                <div className="ce-field">
                  <label><FiDollarSign /> Tipo de precio</label>
                  <div className="ce-lineup-modes">
                    <button type="button" className={`ce-lineup-mode ${form.pricingMode === 'single' ? 'active' : ''}`} onClick={() => set('pricingMode', 'single')}>Precio unico</button>
                    <button type="button" className={`ce-lineup-mode ${form.pricingMode === 'tiers' ? 'active' : ''}`} onClick={() => set('pricingMode', 'tiers')}>Por fases</button>
                  </div>
                </div>

                {form.pricingMode === 'single' ? (
                  <div className="ce-field">
                    <label>Precio (USD)</label>
                    <input type="number" value={form.price} min="0" step="1"
                      onChange={e => set('price', e.target.value)} className={errors.price ? 'error' : ''} />
                    {errors.price && <span className="ce-error">{errors.price}</span>}
                    <span className="ce-hint">{parseFloat(form.price) === 0 ? 'Evento gratuito' : `$${parseFloat(form.price || 0)} por ticket`}</span>
                  </div>
                ) : (
                  <div className="ce-field">
                    <label>Fases de precio</label>
                    <div className="ce-tiers">
                      {form.tiers.map((tier, i) => (
                        <div key={i} className="ce-tier-row">
                          <input type="text" value={tier.name} placeholder="Ej: Early Bird" onChange={e => { const t = [...form.tiers]; t[i] = { ...t[i], name: e.target.value }; set('tiers', t) }} className="ce-tier-name" />
                          <div className="ce-tier-price-wrap"><span className="ce-tier-dollar">$</span><input type="number" value={tier.price} placeholder="0" min="0" onChange={e => { const t = [...form.tiers]; t[i] = { ...t[i], price: e.target.value }; set('tiers', t) }} className="ce-tier-price" /></div>
                          <input type="number" value={tier.qty} placeholder="Cant." min="1" onChange={e => { const t = [...form.tiers]; t[i] = { ...t[i], qty: e.target.value }; set('tiers', t) }} className="ce-tier-qty" />
                          {form.tiers.length > 1 && <button type="button" className="ce-lineup-remove" onClick={() => set('tiers', form.tiers.filter((_, j) => j !== i))}>x</button>}
                        </div>
                      ))}
                      <button type="button" className="ce-lineup-add" onClick={() => set('tiers', [...form.tiers, { name: '', price: '', qty: '' }])}>+ Agregar fase</button>
                    </div>
                    <span className="ce-hint">Cuando se agotan los tickets de una fase, se activa la siguiente.</span>
                  </div>
                )}

                <div className="ce-field">
                  <label>Edad minima</label>
                  <div className="ce-age-options">
                    {['16', '18', '21'].map(age => (
                      <button key={age} type="button" className={`ce-age-btn ${form.minAge === age ? 'active' : ''}`} onClick={() => set('minAge', age)}>+{age}</button>
                    ))}
                  </div>
                </div>

                {(() => {
                  let rev = 0
                  if (form.pricingMode === 'single') rev = parseFloat(form.price || 0) * parseInt(form.capacity || 0)
                  else form.tiers.forEach(t => { rev += parseFloat(t.price || 0) * parseInt(t.qty || 0) })
                  return rev > 0 ? (<div className="ce-revenue-preview"><span>Ingreso potencial</span><strong>{'$' + rev.toLocaleString()}</strong></div>) : null
                })()}
              </div>
            )}

            {/* Step 4: Image */}
            {step === 4 && (
              <div className="ce-step">
                <h2 className="ce-step-title">Imagen del evento</h2>
                <p className="ce-step-desc">Sube tu propia imagen o elige una de la galería.</p>

                {/* Upload */}
                <div className="ce-field">
                  <label><FiImage /> Subir imagen</label>
                  <div className="ce-upload-zone"
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragging') }}
                    onDragLeave={e => e.currentTarget.classList.remove('dragging')}
                    onDrop={e => {
                      e.preventDefault(); e.currentTarget.classList.remove('dragging')
                      const file = e.dataTransfer.files[0]
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader()
                        reader.onload = (ev) => { set('uploadedImage', ev.target.result); set('imageUrl', ev.target.result) }
                        reader.readAsDataURL(file)
                      }
                    }}>
                    <input type="file" accept="image/*" id="ce-file-input" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (ev) => { set('uploadedImage', ev.target.result); set('imageUrl', ev.target.result) }
                          reader.readAsDataURL(file)
                        }
                      }} />
                    {form.uploadedImage ? (
                      <div className="ce-upload-preview">
                        <img src={form.uploadedImage} alt="" style={{ objectPosition: `center ${form.imagePos}%` }} />
                        <div className="ce-upload-actions">
                          <button type="button" onClick={() => { set('uploadedImage', null); set('imageUrl', '') }}>✕ Quitar</button>
                          <button type="button" onClick={() => document.getElementById('ce-file-input').click()}>Cambiar</button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="ce-file-input" className="ce-upload-label">
                        <FiImage size={28} />
                        <strong>Arrastra una imagen aquí</strong>
                        <span>o haz clic para seleccionar</span>
                        <span className="ce-upload-formats">JPG, PNG, WebP · Máx 5MB</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Image position */}
                {(form.uploadedImage || form.imageUrl) && (
                  <div className="ce-field">
                    <label>Ajustar posición vertical</label>
                    <div className="ce-pos-slider">
                      <span>Arriba</span>
                      <input type="range" min="0" max="100" value={form.imagePos}
                        onChange={e => set('imagePos', parseInt(e.target.value))} />
                      <span>Abajo</span>
                    </div>
                  </div>
                )}

                {/* Gallery */}
                <div className="ce-field">
                  <label>O elige de la galería</label>
                  <div className="ce-image-grid">
                    {IMAGES.map((img, i) => (
                      <button key={i} type="button"
                        className={`ce-image-option ${form.imageUrl === img ? 'active' : ''}`}
                        onClick={() => { set('imageUrl', img); set('uploadedImage', null) }}>
                        <img src={img} alt="" loading="lazy" />
                        {form.imageUrl === img && <div className="ce-image-check"><FiCheck /></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ce-field">
                  <label>O pega una URL</label>
                  <input type="url" value={form.uploadedImage ? '' : form.imageUrl}
                    onChange={e => { set('imageUrl', e.target.value); set('uploadedImage', null) }}
                    placeholder="https://tu-imagen.com/foto.jpg"
                    disabled={!!form.uploadedImage} />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="ce-nav">
              {step > 1 && (
                <Button variant="ghost" onClick={prevStep} icon={<FiArrowLeft />}>Anterior</Button>
              )}
              <div style={{ flex: 1 }}></div>
              {step < 4 ? (
                <Button onClick={nextStep}>Siguiente <FiArrowRight /></Button>
              ) : (
                <Button onClick={handleSubmit} size="lg">Publicar Evento <FiCheck /></Button>
              )}
            </div>
          </div>

          {/* Preview side */}
          <div className="ce-preview">
            <div className="ce-preview-label">Vista previa</div>
            <div className="ce-preview-card">
              <div className="ce-preview-img">
                <img src={form.imageUrl || IMAGES[0]} alt="" style={{ objectPosition: `center ${form.imagePos}%` }} />
                {form.genre && (
                  <span className="ce-preview-genre">{form.genre}</span>
                )}
                {parseInt(form.duration) > 20 && <span className="ce-preview-multiday">Multi-día</span>}
              </div>
              <div className="ce-preview-body">
                <h3>{form.title || 'Nombre del evento'}</h3>
                {form.date && (
                  <p className="ce-preview-meta">
                    <FiCalendar /> {new Date(form.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {form.time && ` · ${form.time}`}
                    {form.duration && ` · ${form.duration}h`}
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

export default CreateEvent
