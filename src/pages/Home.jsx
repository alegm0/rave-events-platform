import { Link, Navigate } from 'react-router-dom'
import { FiCheck, FiArrowRight } from 'react-icons/fi'
import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import './Home.css'

const HeroScene = lazy(() => import('../components/ui/HeroScene'))

const useScrollReveal = () => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [ref, visible] = useScrollReveal()
  return (
    <div ref={ref} className={`reveal ${visible ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

const Home = () => {
  const { currentUser, userProfile } = useAuth()
  const [imgLoaded, setImgLoaded] = useState(false)

  // Redirect logged-in users to their home
  if (currentUser) {
    if (userProfile?.role === 'organizer') return <Navigate to="/organizer/dashboard" replace />
    return <Navigate to="/events" replace />
  }

  return (
    <div className="home">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          <img src="https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=1920&q=80"
            alt="" className={`hero-bg-img ${imgLoaded ? 'loaded' : ''}`}
            onLoad={() => setImgLoaded(true)} />
          <div className="hero-bg-overlay"></div>
          <div className="hero-bg-vignette"></div>
        </div>
        <Suspense fallback={null}><HeroScene /></Suspense>
        <div className="container hero-content">
          <div className="hero-badge animate-in">
            <span className="badge-dot"></span>
            Plataforma de Eventos Electrónicos
          </div>
          <h1 className="hero-title animate-in delay-1">RAVE</h1>
          <p className="hero-subtitle animate-in delay-2">Organiza. Asiste. Conecta con la escena.</p>
          <div className="hero-actions animate-in delay-3">
            <Link to="/events"><Button size="lg">Explorar Eventos</Button></Link>
            <Link to="/register"><Button variant="outline" size="lg">Crear Cuenta</Button></Link>
          </div>
        </div>
        <div className="hero-bottom">
          <div className="hero-genres">
            {['Techno', 'House', 'Minimal', 'Trance', 'Drum & Bass'].map((g, i) => (
              <span key={g} className="genre-tag" style={{ animationDelay: `${i * 0.1 + 0.6}s` }}>{g}</span>
            ))}
          </div>
          <div className="hero-scroll"><span>scroll</span><div className="scroll-line"></div></div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="marquee-strip">
        <div className="marquee-track">
          {[...Array(2)].map((_, k) => (
            <div className="marquee-content" key={k} aria-hidden={k > 0}>
              <span>TECHNO</span><span className="marquee-dot">●</span>
              <span>HOUSE</span><span className="marquee-dot">●</span>
              <span>MINIMAL</span><span className="marquee-dot">●</span>
              <span>TRANCE</span><span className="marquee-dot">●</span>
              <span>DRUM & BASS</span><span className="marquee-dot">●</span>
              <span>AMBIENT</span><span className="marquee-dot">●</span>
              <span>ACID</span><span className="marquee-dot">●</span>
              <span>INDUSTRIAL</span><span className="marquee-dot">●</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ── */}
      <section className="about-section section--light">
        <div className="container">
          <div className="about-grid">
            <Reveal>
              <div className="about-label">
                <span className="label-tag">01</span>
                <span className="label-line"></span>
                <span className="label-text">Sobre la plataforma</span>
              </div>
            </Reveal>
            <div className="about-content">
              <Reveal delay={100}>
                <h2>Una plataforma integral para la escena electrónica underground</h2>
              </Reveal>
              <Reveal delay={200}>
                <p>RAVE conecta organizadores de eventos con ravers a través de un sistema
                  de gestión completo: creación de eventos, venta de tickets digitales con QR,
                  validación de entrada y analytics en tiempo real.</p>
              </Reveal>
              <Reveal delay={300}>
                <p>Diseñada como proyecto de tesis para demostrar cómo la tecnología puede
                  potenciar la cultura de la música electrónica.</p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Visual Gallery ── */}
      <section className="gallery-section">
        <div className="gallery-grid">
          {[
            { img: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80', label: 'Festivales' },
            { img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', label: 'Clubs' },
            { img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80', label: 'Underground' },
            { img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80', label: 'Open Air' },
          ].map((item, i) => (
            <Reveal key={item.label} delay={i * 100}>
              <div className="gallery-item">
                <img src={item.img} alt={item.label} loading="lazy" />
                <div className="gallery-overlay">
                  <span className="gallery-label">{item.label}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="steps-section section--light">
        <div className="container">
          <Reveal>
            <div className="section-label">
              <span className="label-tag">02</span>
              <span className="label-line"></span>
              <span className="label-text">Cómo funciona</span>
            </div>
          </Reveal>
          <div className="steps-grid">
            {[
              { step: '01', title: 'Crea tu cuenta', desc: 'Regístrate como raver o como organizador de eventos en segundos.' },
              { step: '02', title: 'Explora o crea', desc: 'Descubre eventos cerca de ti o publica tu propio evento con todos los detalles.' },
              { step: '03', title: 'Compra tickets', desc: 'Adquiere tus entradas digitales con código QR único e intransferible.' },
              { step: '04', title: 'Vive la experiencia', desc: 'Presenta tu QR en la puerta y disfruta. Los organizadores validan con el scanner.' },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 120}>
                <div className="step-card">
                  <div className="step-number">{s.step}</div>
                  <div className="step-connector"></div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Profiles ── */}
      <section className="profiles-section">
        <div className="container">
          <Reveal>
            <div className="section-label">
              <span className="label-tag">03</span>
              <span className="label-line"></span>
              <span className="label-text">Dos perfiles</span>
            </div>
          </Reveal>
          <div className="profiles-grid">
            <Reveal delay={100}>
              <div className="profile-card">
                <div className="profile-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="profile-icon">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <h3 className="profile-title">Raver</h3>
                <p className="profile-desc">Descubre eventos, compra tickets digitales y gestiona tu experiencia en la escena.</p>
                <ul className="profile-list">
                  <li><FiCheck /> Explorar eventos por fecha y ubicación</li>
                  <li><FiCheck /> Compra de tickets con código QR</li>
                  <li><FiCheck /> Historial de eventos asistidos</li>
                  <li><FiCheck /> Calendario personalizado</li>
                </ul>
                <Link to="/register"><Button variant="outline" fullWidth>Registrarse como Raver</Button></Link>
              </div>
            </Reveal>
            <Reveal delay={250}>
              <div className="profile-card profile-card--accent">
                <div className="profile-icon-wrap profile-icon-wrap--accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="profile-icon">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3 className="profile-title">Organizador</h3>
                <p className="profile-desc">Crea eventos, gestiona ventas y analiza el rendimiento de tus producciones.</p>
                <ul className="profile-list">
                  <li><FiCheck /> Crear y publicar eventos</li>
                  <li><FiCheck /> Sistema de venta de tickets</li>
                  <li><FiCheck /> Scanner QR para validar entradas</li>
                  <li><FiCheck /> Dashboard con métricas</li>
                </ul>
                <Link to="/register"><Button fullWidth>Registrarse como Organizador</Button></Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Marquee 2 ── */}
      <div className="marquee-strip marquee-strip--reverse">
        <div className="marquee-track marquee-track--reverse">
          {[...Array(2)].map((_, k) => (
            <div className="marquee-content" key={k} aria-hidden={k > 0}>
              <span>TICKETS DIGITALES</span><span className="marquee-dot">◆</span>
              <span>QR SCANNER</span><span className="marquee-dot">◆</span>
              <span>ANALYTICS</span><span className="marquee-dot">◆</span>
              <span>DASHBOARD</span><span className="marquee-dot">◆</span>
              <span>CALENDARIO</span><span className="marquee-dot">◆</span>
              <span>EVENTOS</span><span className="marquee-dot">◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section className="features-section section--light">
        <div className="container">
          <Reveal>
            <div className="section-label">
              <span className="label-tag">04</span>
              <span className="label-line"></span>
              <span className="label-text">Funcionalidades</span>
            </div>
          </Reveal>
          <div className="features-grid">
            {[
              { num: '01', title: 'Tickets Digitales', desc: 'Códigos QR únicos por ticket para validación instantánea en la entrada del evento.', icon: '🎫' },
              { num: '02', title: 'Gestión de Eventos', desc: 'Herramientas para crear, editar y publicar eventos con toda la información necesaria.', icon: '🎛️' },
              { num: '03', title: 'Analytics', desc: 'Métricas de ventas, asistencia y engagement en tiempo real para organizadores.', icon: '📊' },
              { num: '04', title: 'Scanner QR', desc: 'Validación de tickets en puerta mediante escaneo de códigos QR desde el móvil.', icon: '📱' },
            ].map((f, i) => (
              <Reveal key={f.num} delay={i * 120}>
                <div className="feature-item">
                  <div className="feature-emoji">{f.icon}</div>
                  <div className="feature-num">{f.num}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Big visual CTA ── */}
      <section className="cta-section">
        <div className="cta-visual">
          <img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1920&q=80"
            alt="" className="cta-bg-img" loading="lazy" />
          <div className="cta-visual-overlay"></div>
          <div className="container cta-content">
            <Reveal>
              <p className="cta-tag">¿Listo para la experiencia?</p>
              <h2 className="cta-title">Forma parte<br/>de la escena</h2>
              <p className="cta-desc">Crea tu cuenta y comienza a explorar o crear eventos de música electrónica.</p>
              <div className="cta-actions">
                <Link to="/register"><Button size="lg">Crear Cuenta <FiArrowRight /></Button></Link>
                <Link to="/events"><Button variant="outline" size="lg">Ver Eventos</Button></Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
