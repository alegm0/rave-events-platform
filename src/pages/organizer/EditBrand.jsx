import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FiCheck, FiImage, FiInstagram, FiGlobe, FiMapPin } from 'react-icons/fi'
import Button from '../../components/ui/Button'
import '../organizer/Dashboard.css'
import './EditBrand.css'

const COVER_OPTIONS = [
  'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=1200&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&q=80',
  'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1200&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80',
]

const LOGO_OPTIONS = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80',
  'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=200&q=80',
  'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=200&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200&q=80',
]

const EditBrand = () => {
  const { userProfile, updateProfile, currentUser } = useAuth()
  const navigate = useNavigate()
  const brand = userProfile?.brand || {}

  const [form, setForm] = useState({
    name: brand.name || userProfile?.displayName || '',
    bio: brand.bio || '',
    city: brand.city || '',
    instagram: brand.instagram || '',
    website: brand.website || '',
    founded: brand.founded || '',
    logo: brand.logo || '',
    cover: brand.cover || '',
    uploadedLogo: null,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    updateProfile({
      displayName: form.name,
      brand: {
        name: form.name,
        bio: form.bio,
        city: form.city,
        instagram: form.instagram,
        website: form.website,
        founded: form.founded,
        logo: form.uploadedLogo || form.logo,
        cover: form.cover,
      }
    })
    navigate(`/organizer/${currentUser.id}`)
  }

  const handleFileUpload = (e, field) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (field === 'logo') { set('uploadedLogo', ev.target.result); set('logo', ev.target.result) }
      else set('cover', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const logoSrc = form.uploadedLogo || form.logo

  return (
    <div className="dash-page">
      <div className="container">
        <span className="dash-tag">Personaliza tu marca</span>
        <h1 className="dash-title">Editar Perfil</h1>

        <div className="eb-layout">
          <div className="eb-form">
            {/* Cover */}
            <div className="eb-section">
              <label className="eb-label">Imagen de portada</label>
              <div className="eb-cover-preview">
                <img src={form.cover || COVER_OPTIONS[0]} alt="" />
                <div className="eb-cover-actions">
                  <label className="eb-upload-btn">
                    <FiImage /> Subir imagen
                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'cover')} hidden />
                  </label>
                </div>
              </div>
              <div className="eb-cover-grid">
                {COVER_OPTIONS.map((img, i) => (
                  <button key={i} type="button" className={`eb-cover-opt ${form.cover === img ? 'active' : ''}`}
                    onClick={() => set('cover', img)}>
                    <img src={img} alt="" />
                    {form.cover === img && <div className="eb-check"><FiCheck /></div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div className="eb-section">
              <label className="eb-label">Logo / Avatar</label>
              <div className="eb-logo-row">
                <div className="eb-logo-preview">
                  {logoSrc ? <img src={logoSrc} alt="" /> : <span>{(form.name || '?')[0]}</span>}
                </div>
                <div className="eb-logo-options">
                  <label className="eb-upload-btn">
                    <FiImage /> Subir logo
                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'logo')} hidden />
                  </label>
                  <div className="eb-logo-grid">
                    {LOGO_OPTIONS.map((img, i) => (
                      <button key={i} type="button" className={`eb-logo-opt ${form.logo === img ? 'active' : ''}`}
                        onClick={() => { set('logo', img); set('uploadedLogo', null) }}>
                        <img src={img} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="eb-section">
              <label className="eb-label">Información de la marca</label>
              <div className="eb-field">
                <label>Nombre de la marca *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Ej: NOCTURN Collective" />
              </div>
              <div className="eb-field">
                <label>Bio / Descripción</label>
                <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                  placeholder="Describe tu marca, tu estilo, tu historia..."
                  rows={4} />
                <span className="eb-hint">{form.bio.length}/300 caracteres</span>
              </div>
              <div className="eb-row">
                <div className="eb-field">
                  <label><FiMapPin /> Ciudad</label>
                  <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                    placeholder="Ej: Bogotá" />
                </div>
                <div className="eb-field">
                  <label>Año de fundación</label>
                  <input type="text" value={form.founded} onChange={e => set('founded', e.target.value)}
                    placeholder="Ej: 2020" maxLength={4} />
                </div>
              </div>
            </div>

            {/* Social */}
            <div className="eb-section">
              <label className="eb-label">Redes sociales</label>
              <div className="eb-field">
                <label><FiInstagram /> Instagram</label>
                <input type="text" value={form.instagram} onChange={e => set('instagram', e.target.value)}
                  placeholder="@tu_marca" />
              </div>
              <div className="eb-field">
                <label><FiGlobe /> Sitio web</label>
                <input type="text" value={form.website} onChange={e => set('website', e.target.value)}
                  placeholder="tumarca.com" />
              </div>
            </div>

            <div className="eb-actions">
              <Button variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
              <Button size="lg" onClick={handleSave} icon={<FiCheck />}>Guardar Perfil</Button>
            </div>
          </div>

          {/* Live preview */}
          <div className="eb-preview">
            <span className="eb-preview-label">Vista previa</span>
            <div className="eb-preview-card">
              <div className="eb-preview-cover">
                <img src={form.cover || COVER_OPTIONS[0]} alt="" />
              </div>
              <div className="eb-preview-header">
                <div className="eb-preview-logo">
                  {logoSrc ? <img src={logoSrc} alt="" /> : <span>{(form.name || '?')[0]}</span>}
                </div>
                <div>
                  <h3>{form.name || 'Nombre de la marca'}</h3>
                  {form.city && <p><FiMapPin /> {form.city}</p>}
                </div>
              </div>
              {form.bio && <p className="eb-preview-bio">{form.bio}</p>}
              <div className="eb-preview-socials">
                {form.instagram && <span><FiInstagram /> {form.instagram}</span>}
                {form.website && <span><FiGlobe /> {form.website}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditBrand
