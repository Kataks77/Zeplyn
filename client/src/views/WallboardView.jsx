import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Radio, 
  AlertTriangle, 
  Clock, 
  Users, 
  UserCheck, 
  UserX, 
  MessageSquare, 
  Search, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Flame, 
  Sparkles, 
  Send, 
  Lock, 
  ArrowRight, 
  X, 
  Eye, 
  CheckCircle2, 
  ShieldAlert, 
  Filter, 
  Building2, 
  Bot, 
  CornerDownRight, 
  Zap, 
  ChevronRight,
  TrendingUp,
  Activity,
  PhoneCall,
  SlidersHorizontal,
  UserPlus
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';

// Função utilitária para tocar som suave de alerta usando Web Audio API nativo (sem dependências externas)
function playSlaAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Primeiro tom suave
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    // Segundo tom de confirmação/urgência
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (_) {}
}

// Formatar segundos em HH:MM:SS ou MM:SS
function formatSeconds(totalSec) {
  if (!totalSec || isNaN(totalSec) || totalSec < 0) return '00:00';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function WallboardView({ onNavigate, onOpenChat }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Estados principais de dados
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [clockTime, setClockTime] = useState('');

  const [kpis, setKpis] = useState({
    waitingCount: 0,
    criticalWaitingCount: 0,
    warningWaitingCount: 0,
    longestWaitSeconds: 0,
    avgWaitSeconds: 0,
    activeChatsCount: 0,
    totalAttendants: 0,
    onlineAttendantsCount: 0,
    availableAttendantsCount: 0,
    busyAttendantsCount: 0,
    pausedAttendantsCount: 0,
    offlineAttendantsCount: 0,
    capacityOccupancyPercent: 0
  });

  const [waitingChats, setWaitingChats] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [attendants, setAttendants] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Configurações da Torre
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'queue' | 'attendants' | 'active'
  const [slaWarningMinutes, setSlaWarningMinutes] = useState(5);
  const [slaCriticalMinutes, setSlaCriticalMinutes] = useState(10);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('wallboard_sound') !== 'false';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  // Modal de Supervisão Oculta (Modo Espiar & Sussurrar)
  const [spyingChat, setSpyingChat] = useState(null);
  const [spyMessages, setSpyMessages] = useState([]);
  const [spyLoading, setSpyLoading] = useState(false);
  const [whisperText, setWhisperText] = useState('');
  const [whisperSending, setWhisperSending] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const lastAlertTimeRef = useRef(0);
  const spyMessagesEndRef = useRef(null);

  // Relógio de Brasília / Local
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cronômetro que incrementa localmente a cada segundo para precisão absoluta em tempo real
  useEffect(() => {
    const ticker = setInterval(() => {
      setWaitingChats(prev => prev.map(c => ({
        ...c,
        waitSeconds: (c.waitSeconds || 0) + 1,
        isWarning: (c.waitSeconds + 1) >= (slaWarningMinutes * 60) && (c.waitSeconds + 1) < (slaCriticalMinutes * 60),
        isCritical: (c.waitSeconds + 1) >= (slaCriticalMinutes * 60)
      })));

      setActiveChats(prev => prev.map(c => ({
        ...c,
        durationSeconds: (c.durationSeconds || 0) + 1
      })));
    }, 1000);

    return () => clearInterval(ticker);
  }, [slaWarningMinutes, slaCriticalMinutes]);

  // Carregar dados de empresas se for Superadmin
  useEffect(() => {
    if (isSuperAdmin) {
      api.getCompanies().then(res => {
        setCompanies(Array.isArray(res) ? res : []);
      }).catch(() => {});
    }
  }, [isSuperAdmin]);

  // Função central de carregamento
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);

      const queryParams = selectedCompanyId ? `companyId=${encodeURIComponent(selectedCompanyId)}` : '';
      const res = await api.getWallboard(queryParams);

      if (res && res.success) {
        setKpis(res.kpis || {});
        setWaitingChats(res.waitingChats || []);
        setActiveChats(res.activeChats || []);
        setAttendants(res.attendants || []);
        setLastSyncTime(new Date());

        // Verificar se há chats com SLA crítico e tocar som se habilitado
        if (soundEnabled && (res.kpis?.criticalWaitingCount > 0)) {
          const now = Date.now();
          // Tocar no máximo uma vez a cada 60 segundos para não incomodar
          if (now - lastAlertTimeRef.current > 60000) {
            lastAlertTimeRef.current = now;
            playSlaAlertSound();
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do Wallboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompanyId, soundEnabled]);

  // Carregamento inicial e polling de segurança a cada 15 segundos
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Escuta eventos em tempo real via Socket.IO
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      loadData(true);
    };

    const cleanupChatUpdated = socketService.on('chat-updated', handleRealtimeUpdate);
    const cleanupClientWaiting = socketService.on('client-waiting', () => {
      loadData(true);
      if (soundEnabled) playSlaAlertSound();
    });
    const cleanupMsgReceived = socketService.on('whatsapp-message-received', (msg) => {
      // Se estiver espiando a conversa que recebeu a mensagem, atualiza o histórico na hora!
      if (spyingChat && (msg.contactJid === spyingChat.contactJid || msg.botId === spyingChat.botId)) {
        setSpyMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, {
            id: msg.id || `msg_${Date.now()}`,
            role: msg.role || 'user',
            content: msg.message || msg.content || '',
            senderName: msg.senderName || '',
            timestamp: msg.timestamp || Date.now()
          }];
        });
      }
      loadData(true);
    });
    const cleanupPresence = socketService.on('attendant:presence-changed', handleRealtimeUpdate);
    const cleanupAvail = socketService.on('user:availability-changed', handleRealtimeUpdate);

    return () => {
      cleanupChatUpdated?.();
      cleanupClientWaiting?.();
      cleanupMsgReceived?.();
      cleanupPresence?.();
      cleanupAvail?.();
    };
  }, [loadData, soundEnabled, spyingChat]);

  // Alternar som de alerta
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('wallboard_sound', String(next));
    if (next) playSlaAlertSound();
  };

  // Alternar Tela Cheia (Modo TV / Wallboard)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Abrir Modo Espiar (Supervisão Oculta)
  const handleOpenSpy = async (chat) => {
    setSpyingChat(chat);
    setSpyLoading(true);
    setWhisperText('');
    setActionSuccessMsg('');
    try {
      const messages = await api.getChatMessages(chat.botId, chat.contactJid);
      setSpyMessages(Array.isArray(messages) ? messages : []);
    } catch (err) {
      console.error('Erro ao carregar mensagens para espiar:', err);
      setSpyMessages([]);
    } finally {
      setSpyLoading(false);
      setTimeout(() => {
        spyMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleCloseSpy = () => {
    setSpyingChat(null);
    setSpyMessages([]);
    setWhisperText('');
  };

  // Enviar Sussurro / Nota Interna
  const handleSendWhisper = async (e) => {
    e?.preventDefault();
    if (!whisperText.trim() || !spyingChat) return;

    setWhisperSending(true);
    try {
      await api.saveInternalNote({
        botId: spyingChat.botId,
        contactJid: spyingChat.contactJid,
        chatId: spyingChat.id,
        note: whisperText.trim()
      });

      // Adiciona na visualização local
      setSpyMessages(prev => [
        ...prev,
        {
          id: `whisper_${Date.now()}`,
          role: 'internal_note',
          content: whisperText.trim(),
          senderName: `${user?.name || 'Supervisor'} (Sussurro)`,
          timestamp: Date.now()
        }
      ]);
      setWhisperText('');
      setActionSuccessMsg('Sussurro enviado com sucesso! O operador recebeu a orientação na tela.');
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      alert('Erro ao enviar sussurro: ' + err.message);
    } finally {
      setWhisperSending(false);
    }
  };

  // Supervisor Assume o Atendimento (Takeover)
  const handleTakeover = async (chat) => {
    if (!window.confirm(`Deseja assumir o atendimento de ${chat.contactName || chat.contactPhone}? Você se tornará o atendente responsável.`)) {
      return;
    }
    try {
      await api.takeOverChat(chat.id);
      setActionSuccessMsg('Atendimento assumido com sucesso!');
      loadData(true);
      setTimeout(() => {
        handleCloseSpy();
        if (onOpenChat) onOpenChat({ botId: chat.botId, contactJid: chat.contactJid });
      }, 1000);
    } catch (err) {
      alert('Erro ao assumir atendimento: ' + err.message);
    }
  };

  // Atribuir Atendimento a um Operador
  const handleAssignToAttendant = async (chat, attendantId) => {
    if (!attendantId) return;
    try {
      await api.transferChat({
        chatId: chat.id,
        botId: chat.botId,
        contactJid: chat.contactJid,
        attendantId,
        transferType: 'attendant'
      });
      loadData(true);
      setActionSuccessMsg('Atendimento atribuído com sucesso!');
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } catch (err) {
      alert('Erro ao atribuir: ' + err.message);
    }
  };

  // Filtros de Setor e Busca
  const departmentsList = useMemo(() => {
    const set = new Set();
    waitingChats.forEach(c => c.department && set.add(c.department));
    activeChats.forEach(c => c.department && set.add(c.department));
    attendants.forEach(a => a.department && set.add(a.department));
    return ['ALL', ...Array.from(set)];
  }, [waitingChats, activeChats, attendants]);

  const filteredWaiting = useMemo(() => {
    return waitingChats.filter(c => {
      const matchDep = selectedDepartment === 'ALL' || c.department === selectedDepartment;
      const term = searchFilter.toLowerCase();
      const matchSearch = !term || 
        (c.contactName || '').toLowerCase().includes(term) || 
        (c.contactPhone || '').includes(term) ||
        (c.lastMessage || '').toLowerCase().includes(term);
      return matchDep && matchSearch;
    });
  }, [waitingChats, selectedDepartment, searchFilter]);

  const filteredActive = useMemo(() => {
    return activeChats.filter(c => {
      const matchDep = selectedDepartment === 'ALL' || c.department === selectedDepartment;
      const term = searchFilter.toLowerCase();
      const matchSearch = !term || 
        (c.contactName || '').toLowerCase().includes(term) || 
        (c.contactPhone || '').includes(term) ||
        (c.attendantName || '').toLowerCase().includes(term);
      return matchDep && matchSearch;
    });
  }, [activeChats, selectedDepartment, searchFilter]);

  const onlineAttendants = useMemo(() => {
    return attendants.filter(a => a.liveStatus === 'available' || a.liveStatus === 'busy');
  }, [attendants]);

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-main)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ========================================================
          BARRA DE COMANDO SUPERIOR / HEADER MISSÃO CRÍTICA
      ======================================================== */}
      <header 
        style={{
          padding: '14px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div 
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)'
            }}
          >
            <Radio size={22} className="animate-pulse" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Torre de Controle
              </h1>
              
              {/* Badge AO VIVO Pulsante */}
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                <span 
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }}
                  className="animate-pulse"
                />
                Ao Vivo
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Supervisão em tempo real de filas, atendimento e equipes
            </p>
          </div>
        </div>

        {/* Controles de Topo: Relógio, Filtro Empresa, Alarme, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Relógio Digital de Alta Precisão */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.86rem',
              fontWeight: 700,
              color: 'var(--accent-cyan)'
            }}
          >
            <Clock size={15} />
            <span>{clockTime || '00:00:00'}</span>
          </div>

          {/* Seletor Multi-Empresa (Superadmin) */}
          {isSuperAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} color="var(--text-muted)" />
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <option value="">Todas as Empresas (Global)</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor de Setor/Departamento */}
          {departmentsList.length > 1 && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              {departmentsList.map(dep => (
                <option key={dep} value={dep}>
                  {dep === 'ALL' ? 'Todos os Setores' : dep}
                </option>
              ))}
            </select>
          )}

          {/* Botão Som de Alarme SLA */}
          <button
            onClick={toggleSound}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: soundEnabled ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-tertiary)',
              border: `1px solid ${soundEnabled ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)'}`,
              color: soundEnabled ? '#34d399' : 'var(--text-muted)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'var(--transition)'
            }}
            title={soundEnabled ? 'Alarme sonoro ativado para estouro de SLA' : 'Alarme sonoro desativado'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{soundEnabled ? 'Alarme On' : 'Alarme Mudo'}</span>
          </button>

          {/* Botão Tela Cheia (Modo TV / Call Center) */}
          <button
            onClick={toggleFullscreen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: isFullscreen ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
              border: `1px solid ${isFullscreen ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)'}`,
              color: isFullscreen ? '#a5b4fc' : 'var(--text-main)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
            title="Alternar Modo TV / Tela Cheia"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{isFullscreen ? 'Sair Tela Cheia' : 'Modo TV'}</span>
          </button>

          {/* Atualizar Manualmente */}
          <button
            onClick={() => loadData(false)}
            disabled={refreshing}
            style={{
              padding: '7px 10px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: refreshing ? 'not-allowed' : 'pointer'
            }}
            title="Sincronizar agora"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* ========================================================
          BARRA DE KPIS & MÉTRICAS DE SLA EM TEMPO REAL
      ======================================================== */}
      <div 
        style={{
          padding: '16px 24px 8px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          flexShrink: 0
        }}
      >
        {/* KPI 1: Fila de Espera */}
        <div 
          style={{
            backgroundColor: kpis.criticalWaitingCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-secondary)',
            border: `1px solid ${kpis.criticalWaitingCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}`,
            borderRadius: '12px',
            padding: '14px 16px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: kpis.criticalWaitingCount > 0 ? '0 0 20px rgba(239, 68, 68, 0.15)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Fila de Espera</span>
            <AlertTriangle size={18} color={kpis.criticalWaitingCount > 0 ? '#ef4444' : '#f59e0b'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 800, color: kpis.criticalWaitingCount > 0 ? '#ef4444' : 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {kpis.waitingCount || 0}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>clientes</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {kpis.criticalWaitingCount > 0 ? (
              <span style={{ color: '#ef4444', fontWeight: 700 }}>
                🚨 {kpis.criticalWaitingCount} acima do SLA ({slaCriticalMinutes}m+)
              </span>
            ) : (
              <span style={{ color: '#10b981', fontWeight: 600 }}>
                ✓ Todos dentro do tempo seguro
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Maior Tempo na Fila */}
        <div 
          style={{
            backgroundColor: kpis.longestWaitSeconds >= slaCriticalMinutes * 60 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
            border: `1px solid ${kpis.longestWaitSeconds >= slaCriticalMinutes * 60 ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-subtle)'}`,
            borderRadius: '12px',
            padding: '14px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Maior Espera Atual</span>
            <Flame size={18} color={kpis.longestWaitSeconds >= slaCriticalMinutes * 60 ? '#ef4444' : '#6366f1'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span 
              style={{ 
                fontSize: '1.9rem', 
                fontWeight: 800, 
                fontFamily: 'var(--font-mono)',
                color: kpis.longestWaitSeconds >= slaCriticalMinutes * 60 ? '#ef4444' : (kpis.longestWaitSeconds >= slaWarningMinutes * 60 ? '#f59e0b' : 'var(--text-main)')
              }}
            >
              {formatSeconds(kpis.longestWaitSeconds)}
            </span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Limite Crítico configurado: {slaCriticalMinutes} min
          </div>
        </div>

        {/* KPI 3: Tempo Médio de Espera (TME) */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TME da Fila</span>
            <Clock size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
              {formatSeconds(kpis.avgWaitSeconds)}
            </span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Média de tempo até primeiro atendimento
          </div>
        </div>

        {/* KPI 4: Atendimentos em Andamento */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Atendimentos Ativos</span>
            <MessageSquare size={18} color="var(--primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
              {kpis.activeChatsCount || 0}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>em curso</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Conversas com operador humano
          </div>
        </div>

        {/* KPI 5: Equipe Escalada & Capacidade */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px 16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Equipe ao Vivo</span>
            <Users size={18} color="#a855f7" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#a855f7' }}>
              {kpis.onlineAttendantsCount || 0}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>/ {kpis.totalAttendants || 0} online</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>🟢 {kpis.availableAttendantsCount} Livres</span>
            <span style={{ color: '#6366f1' }}>🔵 {kpis.busyAttendantsCount} Ocupados</span>
            <span style={{ color: '#f59e0b' }}>🟡 {kpis.pausedAttendantsCount} Pausa</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          BARRA DE ABAS & BUSCA DE ATENDIMENTOS
      ======================================================== */}
      <div 
        style={{
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        {/* Seletor de Abas da Torre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('split')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'split' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: activeTab === 'split' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <Activity size={15} />
            <span>Painel Dividido</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'queue' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: activeTab === 'queue' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <AlertTriangle size={15} color={kpis.criticalWaitingCount > 0 ? '#ef4444' : 'currentColor'} />
            <span>Fila de Espera ({filteredWaiting.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'active' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: activeTab === 'active' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <MessageSquare size={15} />
            <span>Atendimentos em Curso ({filteredActive.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('attendants')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'attendants' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: activeTab === 'attendants' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <Users size={15} />
            <span>Operadores ({attendants.length})</span>
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '280px', maxWidth: '100%' }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 12px',
              width: '100%'
            }}
          >
            <Search size={15} color="var(--text-muted)" />
            <input 
              type="text"
              placeholder="Buscar cliente, número..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
                width: '100%'
              }}
            />
            {searchFilter && (
              <button 
                onClick={() => setSearchFilter('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          CORPO PRINCIPAL DOS PAINÉIS
      ======================================================== */}
      <div 
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '16px 24px 20px 24px',
          display: 'flex',
          gap: '16px'
        }}
      >
        {/* COLUNA 1: FILA DE ESPERA CRÍTICA */}
        {(activeTab === 'split' || activeTab === 'queue') && (
          <div 
            style={{
              flex: activeTab === 'split' ? '1.2' : '1',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {/* Header do Painel de Fila */}
            <div 
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color={kpis.criticalWaitingCount > 0 ? '#ef4444' : '#f59e0b'} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  Fila de Espera Crítica
                </h3>
                <span 
                  style={{
                    backgroundColor: kpis.criticalWaitingCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)',
                    color: kpis.criticalWaitingCount > 0 ? '#ef4444' : 'var(--text-secondary)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}
                >
                  {filteredWaiting.length} na fila
                </span>
              </div>

              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Ordenado por tempo de espera
              </span>
            </div>

            {/* Lista com Scroll */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {filteredWaiting.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={38} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>Fila zerada!</p>
                  <p style={{ fontSize: '0.78rem' }}>Nenhum cliente aguardando atendimento no momento.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredWaiting.map((item) => {
                    const isCrit = item.isCritical;
                    const isWarn = item.isWarning;

                    return (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: isCrit ? 'rgba(239, 68, 68, 0.08)' : (isWarn ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-tertiary)'),
                          border: `1px solid ${isCrit ? 'rgba(239, 68, 68, 0.4)' : (isWarn ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-subtle)')}`,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '14px',
                          transition: 'var(--transition)'
                        }}
                      >
                        {/* Info do Cliente */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <div 
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              overflow: 'hidden',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            {item.profilePicUrl ? (
                              <img src={item.profilePicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (item.contactName || 'C').charAt(0).toUpperCase()
                            )}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.contactName || item.contactPhone}
                              </span>
                              {item.department && (
                                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                                  {item.department}
                                </span>
                              )}
                            </div>

                            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.lastMessage || 'Solicitou atendimento humano'}
                            </p>
                          </div>
                        </div>

                        {/* Cronômetro SLA & Ações Rápidas */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          {/* Cronômetro */}
                          <div style={{ textAlign: 'right' }}>
                            <div 
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.92rem',
                                fontWeight: 800,
                                color: isCrit ? '#ef4444' : (isWarn ? '#f59e0b' : 'var(--text-main)')
                              }}
                            >
                              <Clock size={14} />
                              <span>{formatSeconds(item.waitSeconds)}</span>
                            </div>
                            <span 
                              style={{ 
                                fontSize: '0.66rem', 
                                fontWeight: 700, 
                                textTransform: 'uppercase',
                                color: isCrit ? '#ef4444' : (isWarn ? '#f59e0b' : '#10b981')
                              }}
                            >
                              {isCrit ? 'SLA Estourado' : (isWarn ? 'Alerta SLA' : 'Dentro do SLA')}
                            </span>
                          </div>

                          {/* Botão Espiar Conversa (Stealth Peek) */}
                          <button
                            onClick={() => handleOpenSpy(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-main)',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Espiar conversa e enviar notas internas (whisper)"
                          >
                            <Eye size={14} color="#60a5fa" />
                            <span>Espiar</span>
                          </button>

                          {/* Seletor Rápido de Atribuição */}
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignToAttendant(item, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              borderRadius: '8px',
                              padding: '6px 8px',
                              color: '#34d399',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="" disabled>⚡ Atribuir...</option>
                            {onlineAttendants.map(op => (
                              <option key={op.id} value={op.id}>
                                {op.name} ({op.activeChatsCount || 0} chats)
                              </option>
                            ))}
                          </select>

                          {/* Assumir Diretamente */}
                          <button
                            onClick={() => handleTakeover(item)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: 'var(--primary)',
                              color: '#fff',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Assumir este atendimento agora"
                          >
                            Assumir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* COLUNA 2: ATENDIMENTOS EM CURSO & STATUS DE OPERADORES */}
        {(activeTab === 'split' || activeTab === 'active' || activeTab === 'attendants') && (
          <div 
            style={{
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'hidden'
            }}
          >
            {/* Bloco: Status da Equipe de Operadores */}
            {(activeTab === 'split' || activeTab === 'attendants') && (
              <div 
                style={{
                  flex: activeTab === 'attendants' ? '1' : '0.45',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div 
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#a855f7" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                      Operadores ao Vivo
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    🟢 Disponível &nbsp; 🟡 Pausado &nbsp; ⚪ Offline
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {attendants.map((att) => {
                      const isAvail = att.liveStatus === 'available';
                      const isBusy = att.liveStatus === 'busy';
                      const isPaused = att.liveStatus === 'paused';
                      const isOff = att.liveStatus === 'offline';

                      return (
                        <div
                          key={att.id}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: `1px solid ${isAvail ? 'rgba(16, 185, 129, 0.35)' : (isBusy ? 'rgba(99, 102, 241, 0.35)' : (isPaused ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-subtle)'))}`,
                            borderRadius: '10px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {att.name}
                            </span>
                            <span 
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isAvail ? '#10b981' : (isBusy ? '#6366f1' : (isPaused ? '#f59e0b' : '#64748b')),
                                boxShadow: isAvail ? '0 0 8px #10b981' : 'none'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <span>{att.department || 'Geral'}</span>
                            <span style={{ fontWeight: 700, color: att.activeChatsCount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                              {att.activeChatsCount || 0} chats
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bloco: Atendimentos em Andamento (Active Attendances) */}
            {(activeTab === 'split' || activeTab === 'active') && (
              <div 
                style={{
                  flex: activeTab === 'active' ? '1' : '0.55',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div 
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                      Atendimentos em Curso
                    </h3>
                    <span 
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}
                    >
                      {filteredActive.length} ativos
                    </span>
                  </div>

                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Supervisão invisível e notas whisper
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                  {filteredActive.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <p style={{ fontSize: '0.86rem' }}>Nenhum atendimento em curso no momento.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {filteredActive.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {item.contactName || item.contactPhone}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                com <b>{item.attendantName || 'Atendente'}</b>
                              </span>
                            </div>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.lastMessage || 'Conversa em andamento'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {formatSeconds(item.durationSeconds)}
                            </div>

                            <button
                              onClick={() => handleOpenSpy(item)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                color: '#a5b4fc',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                              title="Espiar conversa e sussurrar instruções"
                            >
                              <Eye size={14} />
                              <span>Espiar & Sussurrar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL DE SUPERVISÃO OCULTA (MODO ESPIAR & SUSSURRAR)
      ======================================================== */}
      {spyingChat && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          className="animate-fade-in"
        >
          <div 
            style={{
              width: '800px',
              maxWidth: '95vw',
              height: '85vh',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal */}
            <div 
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(16, 21, 34, 0.95)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8'
                  }}
                >
                  <Eye size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                      Espiar: {spyingChat.contactName || spyingChat.contactPhone}
                    </h3>
                    <span 
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        padding: '1px 8px',
                        borderRadius: '12px',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}
                    >
                      🔒 Invisível
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Canal: {spyingChat.botName || 'WhatsApp'} | Atendente atual: {spyingChat.attendantName || 'Aguardando na fila'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => handleTakeover(spyingChat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🚀 Assumir Atendimento
                </button>

                <button
                  onClick={handleCloseSpy}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Banner de Aviso de Modo Oculto */}
            <div 
              style={{
                padding: '8px 20px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.76rem',
                color: '#fbbf24'
              }}
            >
              <Lock size={14} />
              <span>
                <b>Modo Supervisão Oculta:</b> O cliente <b>NÃO</b> sabe que você está assistindo. Suas notas abaixo serão vistas <b>apenas pelo operador</b>.
              </span>
            </div>

            {/* Histórico de Mensagens da Conversa */}
            <div 
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'var(--bg-primary)'
              }}
            >
              {spyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  <p style={{ fontSize: '0.82rem' }}>Carregando histórico do atendimento...</p>
                </div>
              ) : spyMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.82rem' }}>Nenhuma mensagem registrada nesta conversa ainda.</p>
                </div>
              ) : (
                spyMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isWhisper = msg.role === 'internal_note';
                  const isBotOrAgent = !isUser && !isWhisper;

                  if (isWhisper) {
                    return (
                      <div 
                        key={msg.id || idx}
                        style={{
                          alignSelf: 'center',
                          maxWidth: '85%',
                          backgroundColor: 'rgba(245, 158, 11, 0.14)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          borderRadius: '10px',
                          padding: '8px 14px',
                          color: '#fef3c7',
                          fontSize: '0.82rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700, marginBottom: '2px' }}>
                          <Lock size={12} />
                          <span>NOTA INTERNA (SUSSURRO) • {msg.senderName || 'Supervisor'}</span>
                        </div>
                        <p style={{ margin: 0, lineHeight: 1.4 }}>{msg.content}</p>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={msg.id || idx}
                      style={{
                        alignSelf: isUser ? 'flex-start' : 'flex-end',
                        maxWidth: '75%',
                        backgroundColor: isUser ? 'var(--bg-secondary)' : 'rgba(16, 185, 129, 0.15)',
                        border: `1px solid ${isUser ? 'var(--border-subtle)' : 'rgba(16, 185, 129, 0.3)'}`,
                        borderRadius: '12px',
                        padding: '10px 14px',
                        color: 'var(--text-main)',
                        fontSize: '0.84rem'
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
                        {isUser ? (spyingChat.contactName || 'Cliente') : (msg.senderName || 'Atendente / Bot')}
                      </div>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                        {msg.content}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={spyMessagesEndRef} />
            </div>

            {/* Aviso de feedback de ação */}
            {actionSuccessMsg && (
              <div 
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{actionSuccessMsg}</span>
              </div>
            )}

            {/* Barra Inferior: Enviar Sussurro (Whisper) ao Atendente */}
            <form 
              onSubmit={handleSendWhisper}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}
            >
              <div 
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '10px',
                  padding: '8px 14px'
                }}
              >
                <Lock size={16} color="#fbbf24" />
                <input 
                  type="text"
                  placeholder="Sussurrar orientação confidencial para o operador (Enter para enviar)..."
                  value={whisperText}
                  onChange={(e) => setWhisperText(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '0.84rem',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={whisperSending || !whisperText.trim()}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: (whisperSending || !whisperText.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (whisperSending || !whisperText.trim()) ? 0.6 : 1
                }}
              >
                <Send size={15} />
                <span>Sussurrar</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
