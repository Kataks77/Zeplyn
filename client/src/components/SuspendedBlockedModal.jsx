import React from 'react';
import { ShieldAlert, AlertTriangle, MessageCircle, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SuspendedBlockedModal({ message, reason }) {
  const { logout, user } = useAuth();

  const handleContactFinancial = () => {
    // Abrir WhatsApp do financeiro/suporte
    const text = encodeURIComponent(`Olá, sou da empresa "${user?.companyName || user?.name || ''}" (ID: ${user?.companyId || user?.id || ''}). Meu acesso está suspenso por pendências financeiras e gostaria de falar com o financeiro para regularizar.`);
    window.open(`https://wa.me/5511999999999?text=${text}`, '_blank');
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '400px',
          borderRadius: '20px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(239, 68, 68, 0.15)',
          overflow: 'hidden',
          textAlign: 'center',
          padding: '24px 22px'
        }}
      >
        {/* Ícone de Alerta com Glow */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div 
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)',
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
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Acesso Suspenso
        </h3>

        {/* Subtítulo explicativo */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: '1.45', marginBottom: '14px' }}>
          {message || 'Sua conta foi suspensa por pendências financeiras ativas. Regularize com o departamento financeiro.'}
        </p>

        {/* Box compacto */}
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

        {/* Botões de Ação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={handleContactFinancial}
            className="btn btn-primary"
            style={{
              padding: '11px 16px',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#16a34a',
              borderColor: '#16a34a',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
              borderRadius: '10px'
            }}
          >
            <MessageCircle size={18} />
            Falar com o Financeiro
          </button>

          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                borderRadius: '10px'
              }}
            >
              <RefreshCw size={14} />
              Verificar Novamente
            </button>

            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                borderRadius: '10px'
              }}
            >
              <LogOut size={14} />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
