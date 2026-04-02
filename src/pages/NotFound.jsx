import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

const NotFound = () => (
  <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
    <div>
      <div style={{ fontSize: '6rem', fontWeight: 900, color: 'rgba(255,255,255,0.05)', lineHeight: 1, marginBottom: '1rem' }}>404</div>
      <h1 style={{ fontSize: '1.5rem', color: '#fff', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Página no encontrada</h1>
      <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '2rem', fontSize: '0.9rem' }}>La página que buscas no existe o fue movida.</p>
      <Link to="/"><Button size="lg">Volver al inicio</Button></Link>
    </div>
  </div>
)

export default NotFound
