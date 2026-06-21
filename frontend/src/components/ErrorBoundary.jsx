import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          fontFamily: 'var(--font-body, sans-serif)',
          color: 'var(--ink, #1a1008)',
          background: 'var(--fog, #faf6f0)',
        }}>
          <svg viewBox="0 0 32 32" fill="none" width="40" height="40">
            <rect width="32" height="32" rx="6" fill="#b8862a"/>
            <rect x="4" y="20" width="7" height="8" fill="white"/>
            <rect x="12.5" y="12" width="7" height="16" fill="white"/>
            <rect x="21" y="4" width="7" height="24" fill="white"/>
          </svg>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>Reload the page to continue.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '10px 20px',
              background: '#b8862a',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
