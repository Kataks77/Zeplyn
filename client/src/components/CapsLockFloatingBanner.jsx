import React from 'react';
import { AlertTriangle, ArrowUp } from 'lucide-react';
import { useCapsLock } from '../hooks/useCapsLock';

export default function CapsLockFloatingBanner() {
  const isCapsLock = useCapsLock();

  if (!isCapsLock) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 18px',
        borderRadius: '14px',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        border: '1.5px solid rgba(245, 158, 11, 0.65)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.25)',
        backdropFilter: 'blur(10px)',
        color: '#fff',
        pointerEvents: 'auto',
        maxWidth: '360px',
        animation: 'slideUp 0.25s ease-out'
      }}
      className="animate-fade-in"
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f59e0b',
          flexShrink: 0
        }}
      >
        <ArrowUp size={18} strokeWidth={2.8} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: '700', color: '#f59e0b' }}>
            Caps Lock (Fixa) Ativado
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: '800',
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: '#f59e0b',
              color: '#0f172a'
            }}
          >
            A
          </span>
        </div>
        <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', lineHeight: '1.3' }}>
          Você está digitando em letras maiúsculas. Cuidado ao digitar senhas ou mensagens.
        </p>
      </div>
    </div>
  );
}
