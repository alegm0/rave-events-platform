import { Link } from 'react-router-dom'
import { FiInstagram, FiTwitter, FiMail } from 'react-icons/fi'
import './Footer.css'

const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-top">
        <div className="footer-brand">
          <h3 className="footer-logo">RAVE<span className="footer-dot">.</span></h3>
          <p className="footer-tagline">Plataforma de gestión de eventos de música electrónica</p>
          <div className="social-links">
            <a href="#" className="social-link" aria-label="Instagram"><FiInstagram /></a>
            <a href="#" className="social-link" aria-label="Twitter"><FiTwitter /></a>
            <a href="#" className="social-link" aria-label="Email"><FiMail /></a>
          </div>
        </div>
        <div className="footer-links-grid">
          <div className="footer-section">
            <h4 className="footer-title">Explorar</h4>
            <Link to="/events" className="footer-link">Todos los Eventos</Link>
            <Link to="/calendar" className="footer-link">Calendario</Link>
            <Link to="/coming-soon" className="footer-link">Próximamente</Link>
          </div>
          <div className="footer-section">
            <h4 className="footer-title">Organizadores</h4>
            <Link to="/organizer/dashboard" className="footer-link">Dashboard</Link>
            <Link to="/organizer/create-event" className="footer-link">Crear Evento</Link>
            <Link to="/register" className="footer-link">Ser Organizador</Link>
          </div>
          <div className="footer-section">
            <h4 className="footer-title">Proyecto</h4>
            <a href="#" className="footer-link">Sobre RAVE</a>
            <a href="#" className="footer-link">Documentación</a>
            <a href="#" className="footer-link">Contacto</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 RAVE — Proyecto de Tesis</p>
        <p className="footer-credit">Plataforma de eventos electrónicos</p>
      </div>
    </div>
  </footer>
)

export default Footer
