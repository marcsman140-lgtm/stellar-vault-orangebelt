import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ProductionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.toString() };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Frontend execution exception intercepted by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', maxWidth: '600px', margin: '10vh auto', textAlign: 'center', background: 'rgba(24, 30, 41, 0.75)', border: '1px solid #ff4e50', borderRadius: '24px', backdropFilter: 'blur(20px)', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
          <h2 style={{ color: '#ff4e50', marginBottom: '1rem' }}>🛡️ Protocol UI Preservation Shield</h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1.5rem', fontSize: '1.05rem' }}>
            An unexpected cryptographic XDR rendering exception occurred during block consensus synchronization.
          </p>
          <div style={{ background: '#0b0f19', padding: '1rem', borderRadius: '12px', textAlign: 'left', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
            <code style={{ fontSize: '0.85rem', color: '#ff7675' }}>{this.state.errorMessage}</code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '0.8rem 2rem', background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)', border: 'none', borderRadius: '12px', fontWeight: 'bold', color: '#000', cursor: 'pointer', fontSize: '1rem', transition: '0.2s' }}
          >
            🔄 Reload Protocol State
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProductionErrorBoundary>
      <App />
    </ProductionErrorBoundary>
  </StrictMode>,
)
