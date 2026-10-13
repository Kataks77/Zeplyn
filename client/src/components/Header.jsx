import React, { useEffect, useState } from 'react';
import { Sun, Moon, Bot, Bell, BellRing, BellOff, ArrowUp, Headphones, Coffee } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { desktopNotifications } from '../services/desktopNotifications';
import { useCapsLock } from '../hooks/useCapsLock';

export default function Header({ currentViewTitle }) {
  const { theme, toggleTheme, socketOnline, selectedBotId, setSelectedBotId, isAvailable, updateAvailability } = useAuth();
  const [bots, setBots] = useState([]);
  const [updatingAvail, setUpdatingAvail] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() => desktopNotifications.getPermission());
  const [notifEnabled, setNotifEnabled] = useState(() => desktopNotifications.isEnabled());
  const isCapsLock = useCapsLock();

  const handleToggleAvailability = async () => {
    if (updatingAvail) return;
    try {
      setUpdatingAvail(true);
      await updateAvailability(!isAvailable);
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: {
          message: !isAvailable 
            ? 'Você agora está DISPONÍVEL para receber novos atendimentos.' 
            : 'Você agora está PAUSADO e não receberá atendimentos automáticos da fila.',
          type: !isAvailable ? 'success' : 'warning'
        }
      }));
    } catch (err) {
      alert('Erro ao alterar status de disponibilidade: ' + err.message);
    } finally {
      setUpdatingAvail(false);
    }
  };

  useEffect(() => {
    async function loadBots() {
      try {
        const data = await api.getBots();
        if (Array.isArray(data)) {
          setBots(data);
        }
      } catch (err) {
        console.error('Erro ao listar bots no Header:', err);
      }
    }
    loadBots();

    const refreshBots = () => loadBots();
    const cleanup1 = socketService.on('bot_status_changed', refreshBots);
    const cleanup2 = socketService.on('bot-status', refreshBots);
    window.addEventListener('bots:updated', refreshBots);

    const updateNotifState = () => {
      setNotifPermission(desktopNotifications.getPermission());
      setNotifEnabled(desktopNotifications.isEnabled());
    };
    window.addEventListener('desktop:permission_changed', updateNotifState);

    return () => {
      cleanup1();
      cleanup2();
      window.removeEventListener('bots:updated', refreshBots);
      window.removeEventListener('desktop:permission_changed', updateNotifState);
    };
  }, []);

  const handleToggleNotifications = async () => {
    if (!desktopNotifications.isSupported()) {
      alert('Seu navegador não suporta notificações nativas da área de trabalho.');
      return;
    }

    if (notifPermission !== 'granted') {
      const res = await desktopNotifications.requestPermission();
      setNotifPermission(res);
      if (res === 'granted') {
        setNotifEnabled(true);
        desktopNotifications.sendTestNotification();
      } else if (res === 'denied') {
        alert('As notificações estão bloqueadas no navegador. Para receber alertas de clientes em espera no Windows, clique no cadeado ao lado da URL no navegador e permita as Notificações.');
      }
    } else {
      const nextState = !notifEnabled;
      desktopNotifications.setEnabled(nextState);
      setNotifEnabled(nextState);
      if (nextState) {
        desktopNotifications.sendTestNotification();
      }
    }
  };

  return (
    <header 
      style={{
        height: '70px',
        padding: '0 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        userSelect: 'none',
        gap: '16px'
      }}
    >
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentViewTitle}
        </h1>

        {isCapsLock && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              color: '#f59e0b',
              fontSize: '0.74rem',
              fontWeight: '700',
              letterSpacing: '0.3px',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.2)',
              flexShrink: 0
            }}
            title="A tecla Caps Lock (Fixa) do teclado está ligada. Você está digitando em maiúsculas."
            className="animate-fade-in"
          >
            <ArrowUp size={13} strokeWidth={3} />
            <span>FIXA ATIVADA</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Bot Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={18} color="var(--primary)" />
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '0.84rem',
              fontWeight: 500,
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <option value="all">Todos os Bots</option>
            {bots.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Status de Disponibilidade para Atendimentos (On / Off) */}
        <button
          onClick={handleToggleAvailability}
          disabled={updatingAvail}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1.5px solid ${isAvailable ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.45)'}`,
            color: isAvailable ? '#10b981' : '#f59e0b',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: updatingAvail ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isAvailable ? '0 0 10px rgba(16, 185, 129, 0.12)' : 'none',
            userSelect: 'none'
          }}
          title={
            isAvailable 
              ? 'Você está DISPONÍVEL para receber atendimentos automáticos da fila. Clique para pausar.' 
              : 'Você está PAUSADO e não receberá novos atendimentos da fila. Clique para ficar Disponível.'
          }
        >
          <div 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isAvailable ? '#10b981' : '#f59e0b',
              boxShadow: isAvailable ? '0 0 8px #10b981' : 'none'
            }}
          />
          {isAvailable ? (
            <>
              <Headphones size={14} />
              <span>Disponível</span>
            </>
          ) : (
            <>
              <Coffee size={14} />
              <span>Pausado</span>
            </>
          )}
        </button>

        {/* WebSocket Real-time Status */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '9999px',
            background: socketOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${socketOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: socketOnline ? '#10b981' : '#ef4444'
          }}
          title={socketOnline ? 'Conexão em tempo real ativa' : 'Reconectando socket...'}
        >
          <div 
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: socketOnline ? '#10b981' : '#ef4444',
              boxShadow: socketOnline ? '0 0 8px #10b981' : 'none'
            }}
          />
          {socketOnline ? 'Online' : 'Reconectando'}
        </div>

        {/* Windows Desktop Notifications Toggle */}
        <button
          onClick={handleToggleNotifications}
          className="btn-icon"
          title={
            notifPermission !== 'granted' 
              ? 'Ativar Notificações no Windows para clientes em espera' 
              : notifEnabled 
              ? 'Notificações no Windows ativas (Clique para testar ou desativar)' 
              : 'Notificações pausadas (Clique para ativar)'
          }
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            position: 'relative',
            backgroundColor: notifPermission === 'granted' && notifEnabled ? 'rgba(16, 185, 129, 0.1)' : undefined,
            color: notifPermission === 'granted' && notifEnabled ? '#10b981' : notifPermission === 'denied' ? '#ef4444' : '#f59e0b'
          }}
        >
          {notifPermission === 'granted' && notifEnabled ? (
            <Bell size={18} />
          ) : notifPermission === 'denied' ? (
            <BellOff size={18} />
          ) : (
            <BellRing size={18} />
          )}

          {/* Indicador de status/atenção */}
          {notifPermission !== 'granted' && (
            <span 
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                boxShadow: '0 0 6px #f59e0b'
              }} 
            />
          )}
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px'
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
