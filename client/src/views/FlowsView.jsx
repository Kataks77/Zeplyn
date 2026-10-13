import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bot, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  PhoneCall,
  MessageSquare,
  Headphones,
  PhoneOff,
  Star,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import CentralMenuBuilder from '../components/CentralAtendimento/CentralMenuBuilder';
import BotMessagesModules from '../components/CentralAtendimento/BotMessagesModules';

const MODULES = [
  { id: 'ura', label: '1. Menu URA & Autoatendimento', shortLabel: 'Menu URA', icon: Layers, badge: 'Interativo' },
  { id: 'welcome', label: '2. Boas-Vindas & Triagem', shortLabel: 'Boas-Vindas', icon: MessageSquare },
  { id: 'human', label: '3. Atendimento Humano', shortLabel: 'Atendimento Humano', icon: Headphones },
  { id: 'calls', label: '4. Chamadas WhatsApp', shortLabel: 'Chamadas', icon: PhoneOff },
  { id: 'csat', label: '5. Avaliação CSAT', shortLabel: 'CSAT', icon: Star },
  { id: 'hours', label: '6. Expediente & Recesso', shortLabel: 'Expediente', icon: Clock }
];

export default function FlowsView() {
  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [activeModule, setActiveModule] = useState('ura');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const fetchBots = async () => {
    try {
      setLoading(true);
      const data = await api.getBots();
      const botList = Array.isArray(data) ? data : [];
      setBots(botList);

      if (botList.length > 0) {
        setSelectedBotId(prev => {
          if (prev && botList.some(b => b.id === prev)) return prev;
          return botList[0].id;
        });
      }
    } catch (err) {
      console.error('Erro ao carregar bots para central de atendimento:', err);
      showNotification('error', 'Falha ao carregar conexões de bots do WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const selectedBot = useMemo(() => {
    return bots.find(b => b.id === selectedBotId) || null;
  }, [bots, selectedBotId]);

  const handleBotUpdated = (updatedBot) => {
    setBots(prev => prev.map(b => b.id === updatedBot.id ? { ...b, ...updatedBot } : b));
    showNotification('success', 'Menu e regras da Central salvos com sucesso!');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-muted)'
      }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '14px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
          Carregando Central de Atendimento...
        </h3>
        <p style={{ fontSize: '0.88rem', margin: 0 }}>
          Sincronizando robôs e módulos de mensagens automáticas.
        </p>
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div style={{
        padding: '40px 24px',
        maxWidth: '720px',
        margin: '60px auto',
        textAlign: 'center',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          color: '#10b981'
        }}>
          <PhoneCall size={32} />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
          Nenhum Bot WhatsApp Conectado
        </h2>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
          Para configurar a Central de Atendimento com menus interativos (1, 2, 3...) e direcionamento para departamentos, conecte ao menos um número de WhatsApp.
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'bots' }))}
          className="btn btn-primary"
          style={{ padding: '10px 24px', fontSize: '0.92rem', gap: '8px', cursor: 'pointer' }}
        >
          <Bot size={18} />
          Ir para Gestão de Bots WhatsApp
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-main)',
      overflow: 'hidden'
    }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: notification.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          fontSize: '0.88rem',
          fontWeight: 600,
          animation: 'slideInRight 0.25s ease'
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header com Título, Explicação e Seletor de Bot */}
      <div style={{
        padding: '14px 24px 10px 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        flexShrink: 0
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 2px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PhoneCall size={22} className="text-primary" /> Central de Atendimento & Mensagens
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Configure o menu interativo (URA) e todos os módulos de mensagens automáticas do Bot
          </p>
        </div>

        {/* Bot Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Bot Ativo:
          </span>
          <select
            value={selectedBotId || ''}
            onChange={(e) => setSelectedBotId(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.connected ? '🟢 Conectado' : '⚪ Desconectado'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navegação por Módulos (Tabs) */}
      <div style={{
        padding: '0 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActive = activeModule === mod.id;

          return (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.86rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{mod.label}</span>
              {mod.badge && (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--primary)' : 'var(--border-subtle)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600
                }}>
                  {mod.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Área de Conteúdo do Módulo Ativo */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {activeModule === 'ura' ? (
          selectedBot ? (
            <CentralMenuBuilder
              key={selectedBot.id}
              bot={selectedBot}
              onUpdateBot={handleBotUpdated}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Selecione um bot acima para configurar o menu da central.
            </div>
          )
        ) : (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
              <BotMessagesModules
                selectedModule={activeModule}
                onSelectModule={setActiveModule}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
