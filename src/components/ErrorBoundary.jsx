import { Component } from 'react'

// Catches render-time errors anywhere below it so a single broken component
// shows a friendly recovery screen instead of a blank white page. Error
// boundaries have to be class components — there is no hook equivalent.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Kept for debugging; in production this is where an error reporter would go.
    console.error('[rave] Error no controlado:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.emoji}>🎛️</div>
          <h1 style={styles.title}>Algo salió mal</h1>
          <p style={styles.text}>
            Tuvimos un problema al mostrar esta pantalla. Puedes volver al inicio e intentarlo de nuevo.
          </p>
          <button style={styles.button} onClick={this.handleReload}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }
}

const styles = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0d0d0d', padding: '1.5rem', textAlign: 'center',
  },
  card: { maxWidth: 420 },
  emoji: { fontSize: '3rem', marginBottom: '1rem' },
  title: { color: '#fff', fontSize: '1.6rem', margin: '0 0 0.75rem', fontWeight: 700 },
  text: { color: '#999', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.75rem' },
  button: {
    background: '#ff3d00', color: '#000', border: 'none', padding: '0.85rem 1.75rem',
    fontSize: '0.9rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer',
  },
}

export default ErrorBoundary
