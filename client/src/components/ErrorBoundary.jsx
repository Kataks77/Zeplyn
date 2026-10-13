import React from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('💥 [ErrorBoundary] Erro capturado na interface:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onNavigateDashboard) {
      this.props.onNavigateDashboard();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          style={{
            height: '100%',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-main)',
            textAlign: 'center'
          }}
        >
          <div 
            className="glass-panel"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '36px 30px',
              borderRadius: '20px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '18px'
            }}
          >
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)'
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                {this.props.title || 'Ops! Ocorreu um erro nesta tela'}
              </h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Detectamos uma instabilidade inesperada ao renderizar este módulo. Seus dados estão seguros e o restante do sistema permanece em funcionamento.
              </p>
            </div>

            {this.state.error?.message && (
              <div 
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  textAlign: 'left',
                  maxHeight: '80px',
                  overflowY: 'auto',
                  wordBreak: 'break-all'
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} /> Recarregar Tela
              </button>

              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                <LayoutDashboard size={16} /> Ir para o Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
