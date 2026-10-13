import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, Phone, ArrowRight, ShieldAlert, MessageCircle, X, AlertTriangle } from 'lucide-react';
import ZeplynLogo from '../components/ZeplynLogo';
import { useCapsLock } from '../hooks/useCapsLock';

export default function LoginView() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suspensionModal, setSuspensionModal] = useState({ open: false, message: '' });

  const isCapsLock = useCapsLock();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    const handleAuthSuspended = (e) => {
      const msg = e.detail?.message || 'Acesso suspenso por pendências financeiras.';
      setSuspensionModal({
        open: true,
        message: msg
      });
      setError('');
    };

    window.addEventListener('auth:suspended', handleAuthSuspended);
    return () => window.removeEventListener('auth:suspended', handleAuthSuspended);
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Informe seu email e senha.');
      }
      await login(formData.email, formData.password);
    } catch (err) {
      const msg = err.message || 'Falha ao processar solicitação.';
      const lower = msg.toLowerCase();
      if (
        lower.includes('suspens') ||
        lower.includes('pendênci') ||
        lower.includes('financeir') ||
        lower.includes('inativ') ||
        err.suspended
      ) {
        setSuspensionModal({
          open: true,
          message: msg
        });
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(ellipse at 50% -20%, rgba(16, 185, 129, 0.15), transparent 70%), radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.12), transparent 70%)',
        padding: '20px'
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <ZeplynLogo size={64} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-main)', marginBottom: '6px' }}>
            Zep<span style={{ color: 'var(--primary)' }}>lyn</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Faça login para acessar o painel de atendimento
          </p>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '20px',
              fontWeight: 500
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              E-mail *
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                name="email"
                placeholder="seu.email@empresa.com"
                value={formData.email}
                onChange={handleChange}
                required
                style={{ width: '100%', paddingLeft: '40px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Senha *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                style={{ width: '100%', paddingLeft: '40px' }}
              />
            </div>
            {isCapsLock && (
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  color: '#f59e0b',
                  fontSize: '0.80rem',
                  fontWeight: 600
                }}
                className="animate-fade-in"
              >
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Caps Lock (Fixa) ATIVADO:</strong> As letras digitadas serão maiúsculas, o que pode incorrer em erro de senha.
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
          >
            {loading ? 'Processando...' : 'Acessar Painel'}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Informação sobre os acessos */}
        <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
            Acessos corporativos gerenciados pelo Administrador Geral do Sistema.
          </p>
        </div>
      </div>

      {/* JANELA / MODAL DE CONTA SUSPENSA POR PENDÊNCIAS FINANCEIRAS */}
      {suspensionModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(10, 15, 29, 0.84)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSuspensionModal({ open: false, message: '' });
            }
          }}
        >
          <div
            className="glass-panel animate-scale-up"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '390px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary, #1e293b)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(239, 68, 68, 0.15)',
              padding: '24px 22px',
              textAlign: 'center',
              overflow: 'hidden'
            }}
          >
            {/* Botão fechar modal */}
            <button
              type="button"
              onClick={() => setSuspensionModal({ open: false, message: '' })}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Fechar janela"
            >
              <X size={16} />
            </button>

            {/* Ícone de Escudo de Alerta */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
                  border: '1.5px solid rgba(239, 68, 68, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
                }}
              >
                <ShieldAlert size={28} color="#ef4444" />
              </div>
            </div>

            {/* Tag / Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
              <AlertTriangle size={12} />
              <span>Pendências Financeiras</span>
            </div>

            {/* Título Principal */}
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main, #ffffff)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Acesso Suspenso
            </h3>

            {/* Mensagem explicativa */}
            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.84rem', lineHeight: '1.45', marginBottom: '14px' }}>
              {suspensionModal.message || 'A empresa vinculada a esta conta está suspensa. Entre em contato com a administração.'}
            </p>

            {/* Aviso compacto */}
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
                padding: '8px 12px',
                textAlign: 'center',
                fontSize: '0.76rem',
                color: '#fca5a5',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Robôs e atendimentos pausados temporariamente.</span>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const accountInfo = formData.email ? ` (Conta: ${formData.email})` : '';
                  const text = encodeURIComponent(`Olá! Meu acesso ao sistema Zeplyn está suspenso por pendências financeiras${accountInfo}. Gostaria de falar com o departamento financeiro para regularizar.`);
                  window.open(`https://wa.me/5511999999999?text=${text}`, '_blank');
                }}
                className="btn btn-primary"
                style={{
                  padding: '11px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(22, 163, 74, 0.3)',
                  cursor: 'pointer'
                }}
              >
                <MessageCircle size={18} />
                <span>Falar com o Financeiro</span>
              </button>

              <button
                type="button"
                onClick={() => setSuspensionModal({ open: false, message: '' })}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Fechar Janela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
