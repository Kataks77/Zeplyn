import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Smartphone, 
  QrCode, 
  RefreshCw, 
  Play, 
  Square, 
  Trash2, 
  Settings, 
  LogOut, 
  MessageSquare, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  Plus, 
  Search, 
  Users, 
  Bot, 
  Wifi, 
  WifiOff, 
  Clock, 
  Phone,
  Shield,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export const TelegramIcon = ({ size = 20, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export const InstagramIcon = ({ size = 20, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

export const WhatsAppIcon = ({ size = 20, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

export default function ConnectionsView({ onOpenChat }) {
  const { user } = useAuth();
  const [bots, setBots] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'running', 'stopped'
  const [channelFilter, setChannelFilter] = useState('all'); // 'all', 'whatsapp', 'telegram', 'instagram'

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBot, setSelectedBot] = useState(null);

  // Estados de QR Code
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrStatus, setQrStatus] = useState('Iniciando conexão e gerando QR Code...');
  const [qrLoading, setQrLoading] = useState(false);
  const [isConnectedSuccess, setIsConnectedSuccess] = useState(false);

  // Notificações / Toast
  const [notification, setNotification] = useState(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState(null);

  // Form de Criação de Conexão
  const [createForm, setCreateForm] = useState({
    name: '',
    channel: 'whatsapp', // 'whatsapp', 'telegram', 'instagram'
    operationMode: 'human_only', // Padrão: 100% humano para controle e CRM
    companyId: '',
    ignoreGroups: true,
    adminPhoneNumber: '',
    telegramToken: '',
    instagramPageId: '',
    instagramAccessToken: ''
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Form de Edição de Conexão
  const [editForm, setEditForm] = useState({
    name: '',
    channel: 'whatsapp',
    operationMode: 'human_only',
    ignoreGroups: true,
    adminPhoneNumber: '',
    telegramToken: '',
    instagramPageId: '',
    instagramAccessToken: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api.getBots();
      if (Array.isArray(data)) {
        setBots(data);
      }
    } catch (err) {
      console.error('Erro ao carregar conexões WhatsApp:', err);
      showToast(err.message || 'Erro ao carregar conexões', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    if (user?.role === 'superadmin') {
      try {
        const data = await api.getCompanies();
        if (Array.isArray(data)) {
          setCompanies(data);
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err);
      }
    }
  };

  useEffect(() => {
    loadBots();
    loadCompanies();

    // Atualização de status em tempo real via WebSockets
    const handleStatusUpdate = (data) => {
      if (!data?.botId) return;
      setBots(prev => prev.map(b => {
        if (b.id === data.botId) {
          return {
            ...b,
            status: data.status,
            phoneNumber: data.phone || b.phoneNumber,
            profileName: data.profileName || b.profileName
          };
        }
        return b;
      }));

      // Se o modal de QR estiver aberto para este bot e ele conectou
      if (selectedBot && selectedBot.id === data.botId) {
        if (data.status === 'running' || data.status === 'connected') {
          setIsConnectedSuccess(true);
          setQrStatus('WhatsApp conectado com sucesso!');
          setTimeout(() => {
            setShowQRModal(false);
            setIsConnectedSuccess(false);
            loadBots();
          }, 1800);
        }
      }
    };

    const cleanupStatus1 = socketService.on('bot_status_changed', handleStatusUpdate);
    const cleanupStatus2 = socketService.on('bot-status', handleStatusUpdate);

    return () => {
      cleanupStatus1();
      cleanupStatus2();
    };
  }, [selectedBot]);

  // Listener de QR Code quando modal está aberto
  useEffect(() => {
    if (!showQRModal || !selectedBot) return;

    let isSubscribed = true;
    let pollInterval = null;

    const onQrReceived = (data) => {
      if (!isSubscribed) return;
      if (data.botId && data.botId !== selectedBot.id) return;
      const code = data.qrCode || data.qr;
      if (code) {
        setQrCodeData(code);
        setQrStatus('Escaneie o código QR com a câmera do seu WhatsApp');
        setQrLoading(false);
      } else if (data.status === 'connected' || data.status === 'running') {
        setIsConnectedSuccess(true);
        setQrStatus('WhatsApp conectado com sucesso!');
        setTimeout(() => {
          if (isSubscribed) {
            setShowQRModal(false);
            setIsConnectedSuccess(false);
            loadBots();
          }
        }, 1800);
      }
    };

    const unsub1 = socketService.on(`qr_${selectedBot.id}`, onQrReceived);
    const unsub2 = socketService.on('qr-code', onQrReceived);

    const checkQR = async () => {
      try {
        const res = await api.getBotQR(selectedBot.id);
        if (!isSubscribed) return;
        if (res?.qr) {
          setQrCodeData(res.qr);
          setQrStatus('Escaneie o código QR com a câmera do seu WhatsApp');
          setQrLoading(false);
        }
      } catch { }
    };

    // Polling a cada 2.5s como garantia de sincronização
    checkQR();
    pollInterval = setInterval(checkQR, 2500);

    return () => {
      isSubscribed = false;
      unsub1();
      unsub2();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [showQRModal, selectedBot]);

  // Ações de Conexão
  const handleOpenQR = async (bot) => {
    setSelectedBot(bot);
    setQrCodeData(null);
    setIsConnectedSuccess(false);
    setQrLoading(true);
    setQrStatus('Iniciando serviço e gerando código QR...');
    setShowQRModal(true);

    try {
      await api.startBot(bot.id);
      loadBots();
    } catch (err) {
      setQrLoading(false);
      setQrStatus(`Erro ao iniciar conexão: ${err.message}`);
    }
  };

  const handleResetQR = async (bot) => {
    setSelectedBot(bot);
    setQrCodeData(null);
    setIsConnectedSuccess(false);
    setQrLoading(true);
    setQrStatus('Limpando sessão antiga e gerando novo QR limpo...');
    setShowQRModal(true);

    try {
      await api.stopBot(bot.id).catch(() => {});
      await api.startBot(bot.id, true); // forceNewAuth = true
      loadBots();
    } catch (err) {
      setQrLoading(false);
      setQrStatus(`Erro ao renovar QR: ${err.message}`);
    }
  };

  const handleRestartBot = async (botId) => {
    try {
      showToast('Reiniciando conexão do WhatsApp...', 'info');
      await api.stopBot(botId).catch(() => {});
      await api.startBot(botId);
      loadBots();
      showToast('Conexão reiniciada com sucesso!');
    } catch (err) {
      showToast(`Erro ao reiniciar: ${err.message}`, 'error');
    }
  };

  const handleStartBot = async (botId) => {
    try {
      showToast('Iniciando conexão do WhatsApp...', 'info');
      await api.startBot(botId);
      loadBots();
      showToast('Conexão iniciada com sucesso!');
    } catch (err) {
      showToast(`Erro ao iniciar conexão: ${err.message}`, 'error');
    }
  };

  const handleStopBot = async (botId) => {
    try {
      showToast('Parando conexão do WhatsApp...', 'info');
      await api.stopBot(botId);
      loadBots();
      showToast('Conexão parada/pausada com sucesso.');
    } catch (err) {
      showToast(`Erro ao parar conexão: ${err.message}`, 'error');
    }
  };

  const handleDisconnect = async (bot) => {
    const confirm = window.confirm(
      `Deseja realmente desconectar a sessão do WhatsApp de "${bot.name}"?\n\nOs dados de pareamento do aparelho serão removidos, sendo necessário ler novo QR Code para reconectar.`
    );
    if (!confirm) return;

    try {
      await api.disconnectBot(bot.id);
      loadBots();
      showToast(`Sessão de "${bot.name}" desconectada com sucesso.`);
    } catch (err) {
      showToast(`Erro ao desconectar: ${err.message}`, 'error');
    }
  };

  const handleDeleteBot = async (bot) => {
    const confirm = window.confirm(
      `ATENÇÃO: Deseja realmente excluir permanentemente a conexão "${bot.name}"?\n\nEsta ação removerá a configuração do canal.`
    );
    if (!confirm) return;

    try {
      await api.deleteBot(bot.id);
      loadBots();
      showToast(`Conexão "${bot.name}" excluída.`);
    } catch (err) {
      showToast(`Erro ao excluir conexão: ${err.message}`, 'error');
    }
  };

  // Abrir Modal de Criação
  const handleOpenCreateModal = () => {
    setCreateForm({
      name: '',
      channel: 'whatsapp',
      operationMode: 'human_only',
      companyId: user?.role === 'superadmin' ? (companies[0]?.id || '') : (user?.companyId || ''),
      ignoreGroups: true,
      adminPhoneNumber: '',
      telegramToken: '',
      instagramPageId: '',
      instagramAccessToken: ''
    });
    setShowCreateModal(true);
  };

  // Submeter Criação
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast('O nome do canal é obrigatório.', 'error');
      return;
    }

    if (createForm.channel === 'telegram' && !createForm.telegramToken.trim()) {
      showToast('O Token do Bot do Telegram é obrigatório.', 'error');
      return;
    }

    if (createForm.channel === 'instagram') {
      if (!createForm.instagramPageId.trim() || !createForm.instagramAccessToken.trim()) {
        showToast('O ID da Página e o Token de Acesso do Instagram são obrigatórios.', 'error');
        return;
      }
    }

    try {
      setSubmittingCreate(true);
      const newBot = await api.createBot({
        name: createForm.name.trim(),
        channel: createForm.channel,
        telegramToken: createForm.telegramToken.trim() || null,
        instagramPageId: createForm.instagramPageId.trim() || null,
        instagramAccessToken: createForm.instagramAccessToken.trim() || null,
        operationMode: createForm.operationMode,
        companyId: createForm.companyId || user?.companyId,
        ignoreGroups: createForm.ignoreGroups,
        adminPhoneNumber: createForm.adminPhoneNumber.trim() || null,
        // Configurações neutras para modo humano (sem IA)
        model: 'gpt-3.5-turbo',
        maxTokens: 500,
        temperature: 0.7,
        systemPrompt: 'Você é um assistente virtual para atendimento ao cliente.'
      });

      setShowCreateModal(false);
      await loadBots();

      if (createForm.channel === 'whatsapp') {
        showToast('Nova conexão criada! Abrindo leitor de QR Code...');
        if (newBot && newBot.id) {
          handleOpenQR(newBot);
        }
      } else if (createForm.channel === 'telegram') {
        showToast('Canal do Telegram criado! Conectando...', 'info');
        if (newBot && newBot.id) {
          await api.startBot(newBot.id);
          loadBots();
          showToast('Bot do Telegram conectado com sucesso!');
        }
      } else if (createForm.channel === 'instagram') {
        showToast('Canal do Instagram configurado com sucesso!');
        if (newBot && newBot.id) {
          await api.startBot(newBot.id);
          loadBots();
        }
      }
    } catch (err) {
      showToast(`Erro ao criar canal: ${err.message}`, 'error');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (bot) => {
    setSelectedBot(bot);
    setEditForm({
      name: bot.name || '',
      channel: bot.channel || 'whatsapp',
      operationMode: bot.operationMode || 'human_only',
      ignoreGroups: bot.ignoreGroups !== undefined ? bot.ignoreGroups : true,
      adminPhoneNumber: bot.adminPhoneNumber || '',
      telegramToken: bot.telegramToken || '',
      instagramPageId: bot.instagramPageId || '',
      instagramAccessToken: bot.instagramAccessToken || ''
    });
    setShowEditModal(true);
  };

  // Salvar Edição
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBot) return;
    if (!editForm.name.trim()) {
      showToast('O nome do canal é obrigatório.', 'error');
      return;
    }

    try {
      setSavingEdit(true);
      await api.updateBot(selectedBot.id, {
        name: editForm.name.trim(),
        operationMode: editForm.operationMode,
        ignoreGroups: editForm.ignoreGroups,
        adminPhoneNumber: editForm.adminPhoneNumber.trim() || null,
        telegramToken: editForm.telegramToken.trim() || null,
        instagramPageId: editForm.instagramPageId.trim() || null,
        instagramAccessToken: editForm.instagramAccessToken.trim() || null
      });

      setShowEditModal(false);
      loadBots();
      showToast('Configurações do canal atualizadas com sucesso!');
    } catch (err) {
      showToast(`Erro ao salvar: ${err.message}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyPhone = (phone, id) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  // Formatar número do WhatsApp para visualização bonita
  const formatPhoneNumber = (rawPhone) => {
    if (!rawPhone) return null;
    const clean = String(rawPhone).replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('55')) {
      // Ex: 55 11 9999-9999
      return `+${clean.substring(0, 2)} (${clean.substring(2, 4)}) ${clean.substring(4, 8)}-${clean.substring(8)}`;
    } else if (clean.length === 13 && clean.startsWith('55')) {
      // Ex: 55 11 99999-9999
      return `+${clean.substring(0, 2)} (${clean.substring(2, 4)}) ${clean.substring(4, 9)}-${clean.substring(9)}`;
    }
    return `+${clean}`;
  };

  // Filtragem
  const filteredBots = useMemo(() => {
    return bots.filter(bot => {
      const botChannel = bot.channel || 'whatsapp';
      const matchesSearch = 
        (bot.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bot.phoneNumber || '').includes(searchTerm) ||
        (bot.profileName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bot.instagramPageId || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'running') return bot.status === 'running';
      if (statusFilter === 'stopped') return bot.status !== 'running';

      if (channelFilter !== 'all' && botChannel !== channelFilter) return false;

      return true;
    });
  }, [bots, searchTerm, statusFilter, channelFilter]);

  // Contadores de status
  const runningCount = bots.filter(b => b.status === 'running').length;
  const stoppedCount = bots.length - runningCount;

  return (
    <div 
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-main)',
        padding: '24px 32px'
      }}
    >
      {/* Toast Notification */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: notification.type === 'error' ? '#ef4444' : (notification.type === 'info' ? '#3b82f6' : '#10b981'),
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : (notification.type === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />)}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header com Banner Informativo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #0284c7 50%, #e1306c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Canais & Conexões
              </h1>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Conecte WhatsApp, Telegram e Instagram Direct em um só lugar com zero custo de intermediação.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={loadBots}
            disabled={loading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '0.86rem', cursor: 'pointer' }}
            title="Atualizar lista de conexões"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '9px 18px', 
              fontSize: '0.88rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Plus size={17} />
            <span>Adicionar Novo Canal</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Status Rápido */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Card 1: Total */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total de Canais</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)' }}>{bots.length}</div>
          </div>
        </div>

        {/* Card 2: Conectados Online */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Wifi size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Canais Online</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#10b981' }}>{runningCount}</div>
          </div>
        </div>

        {/* Card 3: Desconectados */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <WifiOff size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Desconectados</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#ef4444' }}>{stoppedCount}</div>
          </div>
        </div>

        {/* Card 4: Modo Atendimento */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#a78bfa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Omnichannel</div>
            <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#a78bfa', marginTop: '2px' }}>
              WhatsApp • Telegram • Instagram
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, canal ou perfil..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '0.88rem'
            }}
          />
        </div>

        {/* Filtros de Canal e Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Canais */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setChannelFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: channelFilter === 'all' ? 'var(--primary)' : 'transparent',
                color: channelFilter === 'all' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setChannelFilter('whatsapp')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: channelFilter === 'whatsapp' ? '#10b981' : 'transparent',
                color: channelFilter === 'whatsapp' ? '#ffffff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <WhatsAppIcon size={13} />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => setChannelFilter('telegram')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: channelFilter === 'telegram' ? '#0284c7' : 'transparent',
                color: channelFilter === 'telegram' ? '#ffffff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <TelegramIcon size={13} />
              <span>Telegram</span>
            </button>
            <button
              onClick={() => setChannelFilter('instagram')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: channelFilter === 'instagram' ? '#e1306c' : 'transparent',
                color: channelFilter === 'instagram' ? '#ffffff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <InstagramIcon size={13} />
              <span>Instagram</span>
            </button>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setStatusFilter(statusFilter === 'running' ? 'all' : 'running')}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: statusFilter === 'running' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                backgroundColor: statusFilter === 'running' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                color: statusFilter === 'running' ? '#10b981' : 'var(--text-muted)'
              }}
            >
              🟢 Online ({runningCount})
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'stopped' ? 'all' : 'stopped')}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: statusFilter === 'stopped' ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                backgroundColor: statusFilter === 'stopped' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
                color: statusFilter === 'stopped' ? '#ef4444' : 'var(--text-muted)'
              }}
            >
              🔴 Offline ({stoppedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Conexões */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '16px' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Carregando conexões do WhatsApp...</p>
        </div>
      ) : filteredBots.length === 0 ? (
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: '16px',
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '12px'
          }}
        >
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Smartphone size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              {searchTerm ? 'Nenhuma conexão encontrada com os termos buscados' : 'Nenhuma conexão WhatsApp configurada'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '480px', margin: 0 }}>
              {searchTerm 
                ? 'Tente buscar com outro nome de conexão ou limpe os filtros para visualizar todos os aparelhos.'
                : 'Conecte seu aparelho celular via QR Code para que seus atendentes humanos possam controlar conversas, receber mensagens e gerenciar clientes no CRM.'}
            </p>
          </div>
          {!searchTerm && (
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              style={{
                marginTop: '8px',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Plus size={18} style={{ marginRight: '6px' }} />
              Conectar Primeiro WhatsApp
            </button>
          )}
        </div>
      ) : (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredBots.map((bot) => {
            const isOnline = bot.status === 'running';
            const isConnecting = bot.status === 'connecting';
            const isHumanOnly = bot.operationMode === 'human_only';
            const formattedPhone = formatPhoneNumber(bot.phoneNumber);
            const botChannel = bot.channel || 'whatsapp';

            const channelMeta = {
              whatsapp: {
                label: 'WhatsApp',
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.15)',
                border: 'rgba(16, 185, 129, 0.35)',
                icon: <WhatsAppIcon size={22} color="#10b981" />
              },
              telegram: {
                label: 'Telegram',
                color: '#0284c7',
                bg: 'rgba(2, 132, 199, 0.15)',
                border: 'rgba(2, 132, 199, 0.35)',
                icon: <TelegramIcon size={22} color="#0284c7" />
              },
              instagram: {
                label: 'Instagram',
                color: '#e1306c',
                bg: 'rgba(225, 48, 108, 0.15)',
                border: 'rgba(225, 48, 108, 0.35)',
                icon: <InstagramIcon size={22} color="#e1306c" />
              }
            }[botChannel] || {
              label: 'Canal',
              color: '#10b981',
              bg: 'rgba(16, 185, 129, 0.15)',
              border: 'rgba(16, 185, 129, 0.35)',
              icon: <Smartphone size={22} />
            };

            return (
              <div 
                key={bot.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: isOnline ? `1px solid ${channelMeta.border}` : '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: isOnline ? `0 4px 20px ${channelMeta.bg}` : '0 2px 10px rgba(0, 0, 0, 0.15)',
                  position: 'relative',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
              >
                {/* Header do Card */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: channelMeta.bg,
                        color: channelMeta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        flexShrink: 0
                      }}
                    >
                      {channelMeta.icon}
                      <span 
                        style={{
                          position: 'absolute',
                          top: '-3px',
                          right: '-3px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#10b981' : (isConnecting ? '#f59e0b' : '#ef4444'),
                          border: '2px solid var(--bg-secondary)'
                        }}
                      />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {bot.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {/* Tag de Canal */}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: channelMeta.bg,
                            color: channelMeta.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {channelMeta.label}
                        </span>

                        {/* Tag de Modo */}
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: isHumanOnly ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: isHumanOnly ? '#c4b5fd' : '#93c5fd',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isHumanOnly ? <Users size={11} /> : <Bot size={11} />}
                          {isHumanOnly ? 'Humano' : 'IA'}
                        </span>

                        {bot.companyName && (
                          <span 
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)'
                            }}
                          >
                            {bot.companyName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menu Rápido de Ações de Topo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isOnline ? (
                      <button
                        onClick={() => handleStopBot(bot.id)}
                        className="btn-icon"
                        style={{ width: '32px', height: '32px', borderRadius: '8px', color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', cursor: 'pointer' }}
                        title="Pausar Canal"
                      >
                        <Square size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartBot(bot.id)}
                        className="btn-icon"
                        style={{ width: '32px', height: '32px', borderRadius: '8px', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer' }}
                        title="Iniciar Conexão do Canal"
                      >
                        <Play size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(bot)}
                      className="btn-icon"
                      style={{ width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer' }}
                      title="Configurações do Canal"
                    >
                      <Settings size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteBot(bot)}
                      className="btn-icon"
                      style={{ width: '32px', height: '32px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                      title="Excluir Canal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Detalhes do Canal e Status */}
                <div 
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Linha 1: Identificador Principal */}
                  {botChannel === 'whatsapp' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>WhatsApp:</span>
                        <strong style={{ color: isOnline ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {formattedPhone || (isOnline ? 'Aparelho Sincronizado' : 'Não conectado')}
                        </strong>
                      </div>
                      {formattedPhone && (
                        <button
                          onClick={() => handleCopyPhone(bot.phoneNumber, bot.id)}
                          className="btn-icon"
                          style={{ width: '26px', height: '26px', cursor: 'pointer' }}
                          title="Copiar número de telefone"
                        >
                          {copiedPhoneId === bot.id ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                  )}

                  {botChannel === 'telegram' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <TelegramIcon size={14} color="#0284c7" />
                        <span style={{ color: 'var(--text-muted)' }}>Bot:</span>
                        <strong style={{ color: isOnline ? '#0284c7' : 'var(--text-muted)' }}>
                          {bot.profileName ? `@${bot.profileName}` : (isOnline ? '@BotAtivo' : 'Aguardando inicialização')}
                        </strong>
                      </div>
                    </div>
                  )}

                  {botChannel === 'instagram' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <InstagramIcon size={14} color="#e1306c" />
                        <span style={{ color: 'var(--text-muted)' }}>Page ID:</span>
                        <strong style={{ color: isOnline ? '#e1306c' : 'var(--text-muted)' }}>
                          {bot.instagramPageId || 'Configurado'}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Linha 2: Nome do Perfil */}
                  {bot.profileName && botChannel === 'whatsapp' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <span>Perfil:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{bot.profileName}</span>
                    </div>
                  )}

                  {/* Linha 3: Status em Tempo Real */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.83rem' }}>
                      <span 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#10b981' : (isConnecting ? '#f59e0b' : '#ef4444')
                        }}
                      />
                      <span style={{ fontWeight: 600, color: isOnline ? '#10b981' : (isConnecting ? '#f59e0b' : '#ef4444') }}>
                        {isOnline ? 'Online & Ativo' : (isConnecting ? 'Conectando / Aguardando' : 'Desconectado')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {botChannel === 'whatsapp' ? (bot.ignoreGroups ? 'Grupos Ignorados' : 'Grupos Monitorados') : 'API Oficial (Gratuita)'}
                    </div>
                  </div>
                </div>

                {/* Ações Primárias e Secundárias */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                  {isOnline ? (
                    <>
                      {/* Botão de Ir para Atendimento */}
                      <button
                        onClick={() => {
                          if (onOpenChat) onOpenChat();
                        }}
                        className="btn btn-primary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: botChannel === 'telegram'
                            ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                            : botChannel === 'instagram'
                            ? 'linear-gradient(135deg, #e1306c 0%, #c13584 100%)'
                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          boxShadow: `0 4px 12px ${channelMeta.bg}`
                        }}
                      >
                        <MessageSquare size={16} />
                        <span>Abrir Atendimento ao Vivo</span>
                      </button>

                      {/* Botões Auxiliares */}
                      <div style={{ display: 'grid', gridTemplateColumns: botChannel === 'whatsapp' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                        <button
                          onClick={() => handleStopBot(bot.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '8px',
                            transition: 'all 0.15s ease'
                          }}
                          title="Pausa a recepção de mensagens deste canal"
                        >
                          <Square size={13} />
                          <span>Pausar</span>
                        </button>

                        <button
                          onClick={() => handleRestartBot(bot.id)}
                          className="btn btn-secondary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Reinicia o serviço do canal"
                        >
                          <RefreshCw size={13} />
                          <span>Reiniciar</span>
                        </button>

                        {botChannel === 'whatsapp' && (
                          <button
                            onClick={() => handleDisconnect(bot)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '8px 4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '8px',
                              transition: 'all 0.15s ease'
                            }}
                            title="Desconecta o WhatsApp e exige nova leitura de QR Code"
                          >
                            <LogOut size={13} />
                            <span>Desconectar</span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : isConnecting ? (
                    <>
                      {botChannel === 'whatsapp' ? (
                        <button
                          onClick={() => handleOpenQR(bot)}
                          className="btn btn-primary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: '#f59e0b',
                            borderColor: '#f59e0b'
                          }}
                        >
                          <QrCode size={16} />
                          <span>Visualizar QR Code</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="btn btn-secondary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            fontSize: '0.88rem'
                          }}
                        >
                          <RefreshCw size={16} className="spin" />
                          <span>Conectando canal...</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleStopBot(bot.id)}
                        className="btn btn-secondary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Square size={13} />
                        <span>Cancelar Conexão</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {botChannel === 'whatsapp' ? (
                        <>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleStartBot(bot.id)}
                              className="btn btn-primary"
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '10px 14px',
                                fontSize: '0.86rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                              }}
                              title="Iniciar conexão usando sessão salva"
                            >
                              <Play size={15} />
                              <span>Iniciar Conexão</span>
                            </button>

                            <button
                              onClick={() => handleOpenQR(bot)}
                              className="btn btn-secondary"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '10px 14px',
                                fontSize: '0.84rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Abrir leitor de QR Code"
                            >
                              <QrCode size={15} />
                              <span>QR Code</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleResetQR(bot)}
                            className="btn btn-secondary"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '8px',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                            title="Inicia do zero limpando sessões residuais no servidor"
                          >
                            <RefreshCw size={13} />
                            <span>Gerar Novo Pareamento Limpo</span>
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleStartBot(bot.id)}
                            className="btn btn-primary"
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '10px 14px',
                              fontSize: '0.86rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: botChannel === 'telegram'
                                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                                : 'linear-gradient(135deg, #e1306c 0%, #c13584 100%)',
                              border: 'none',
                              boxShadow: `0 4px 12px ${channelMeta.bg}`
                            }}
                            title="Ativar canal"
                          >
                            <Play size={15} />
                            <span>Ativar / Conectar</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(bot)}
                            className="btn btn-secondary"
                            style={{
                              padding: '10px 14px',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Settings size={15} />
                            <span>Configurar</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: LEITOR DE QR CODE */}
      {showQRModal && selectedBot && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '680px',
              padding: '30px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            {/* Fechar */}
            <button
              onClick={() => setShowQRModal(false)}
              className="btn-icon"
              style={{ position: 'absolute', top: '20px', right: '20px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* Cabeçalho do Modal */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div 
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}
              >
                <QrCode size={28} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                Conectar Aparelho WhatsApp
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Vincule o número de WhatsApp da conexão: <strong>{selectedBot.name}</strong>
              </p>
            </div>

            {/* Conteúdo em 2 Colunas: QR à Esquerda, Instruções à Direita */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '24px',
                alignItems: 'center'
              }}
            >
              {/* Lado Esquerdo: Área do QR Code */}
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--bg-primary)',
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                  minHeight: '290px'
                }}
              >
                {isConnectedSuccess ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div 
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '14px'
                      }}
                    >
                      <CheckCircle2 size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', color: '#10b981', margin: '0 0 6px 0', fontWeight: 700 }}>
                      WhatsApp Conectado!
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                      Sincronização concluída com sucesso. Redirecionando...
                    </p>
                  </div>
                ) : qrCodeData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <div 
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '14px',
                        borderRadius: '12px',
                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
                        lineHeight: 0
                      }}
                    >
                      <img 
                        src={qrCodeData} 
                        alt="QR Code do WhatsApp" 
                        style={{ width: '220px', height: '220px', display: 'block' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {qrStatus}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
                    <RefreshCw size={36} className="spin" style={{ color: 'var(--primary)' }} />
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '200px' }}>
                      {qrStatus}
                    </p>
                  </div>
                )}
              </div>

              {/* Lado Direito: Instruções Passo a Passo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Como conectar seu WhatsApp:
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div 
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    1
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                    Abra o aplicativo do <strong>WhatsApp</strong> no celular que deseja utilizar.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div 
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    2
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                    Toque no menu <strong>Mais opções (⋮)</strong> no Android ou em <strong>Ajustes / Configurações</strong> no iPhone.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div 
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    3
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                    Toque em <strong>Aparelhos Conectados</strong> e depois em <strong>Conectar um aparelho</strong>.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div 
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    4
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                    Aponte a câmera do seu smartphone para o código QR para sincronizar.
                  </div>
                </div>

                {/* Botões do Rodapé do Modal */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    onClick={() => handleResetQR(selectedBot)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '9px 12px', fontSize: '0.84rem', cursor: 'pointer' }}
                  >
                    <RefreshCw size={14} style={{ marginRight: '6px' }} />
                    Gerar Novo Código
                  </button>
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="btn btn-secondary"
                    style={{ padding: '9px 16px', fontSize: '0.84rem', cursor: 'pointer' }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVA CONEXÃO WHATSAPP */}
      {showCreateModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '540px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn-icon"
              style={{ position: 'absolute', top: '20px', right: '20px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: createForm.channel === 'telegram' ? 'rgba(2, 132, 199, 0.15)' : (createForm.channel === 'instagram' ? 'rgba(225, 48, 108, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                  color: createForm.channel === 'telegram' ? '#0284c7' : (createForm.channel === 'instagram' ? '#e1306c' : '#10b981'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Plus size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Adicionar Novo Canal
                </h2>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Selecione o canal desejado e configure as credenciais de conexão.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '4px' }}>
              {/* Seleção do Canal */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                  Escolha o Canal *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {/* Opção WhatsApp */}
                  <div
                    onClick={() => setCreateForm({ ...createForm, channel: 'whatsapp' })}
                    style={{
                      border: createForm.channel === 'whatsapp' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      backgroundColor: createForm.channel === 'whatsapp' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ color: '#10b981' }}><WhatsAppIcon size={24} /></div>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>WhatsApp</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>QR Code Celular</span>
                  </div>

                  {/* Opção Telegram */}
                  <div
                    onClick={() => setCreateForm({ ...createForm, channel: 'telegram' })}
                    style={{
                      border: createForm.channel === 'telegram' ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                      backgroundColor: createForm.channel === 'telegram' ? 'rgba(2, 132, 199, 0.1)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ color: '#0284c7' }}><TelegramIcon size={24} /></div>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>Telegram</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bot Oficial Grátis</span>
                  </div>

                  {/* Opção Instagram */}
                  <div
                    onClick={() => setCreateForm({ ...createForm, channel: 'instagram' })}
                    style={{
                      border: createForm.channel === 'instagram' ? '2px solid #e1306c' : '1px solid var(--border-subtle)',
                      backgroundColor: createForm.channel === 'instagram' ? 'rgba(225, 48, 108, 0.1)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ color: '#e1306c' }}><InstagramIcon size={24} /></div>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>Instagram</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Direct (Graph API)</span>
                  </div>
                </div>
              </div>

              {/* Nome da Conexão */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Nome de Identificação do Canal *
                </label>
                <input
                  type="text"
                  placeholder={
                    createForm.channel === 'telegram'
                      ? 'Ex: Suporte Telegram, Bot Oficial'
                      : createForm.channel === 'instagram'
                      ? 'Ex: Instagram Loja Oficial, Direct Atendimento'
                      : 'Ex: WhatsApp Comercial, Recepção, Suporte'
                  }
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {/* Campos específicos do Telegram */}
              {createForm.channel === 'telegram' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                      Token do Bot do Telegram (BotFather) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      value={createForm.telegramToken}
                      onChange={(e) => setCreateForm({ ...createForm, telegramToken: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  {/* Guia Rápido BotFather */}
                  <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                    <div style={{ fontWeight: 600, color: '#0284c7', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TelegramIcon size={14} color="#0284c7" />
                      <span>Como criar seu Bot do Telegram em 1 minuto (100% Grátis):</span>
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                      <li>Abra o Telegram e busque por <strong>@BotFather</strong></li>
                      <li>Envie a mensagem <code>/newbot</code></li>
                      <li>Escolha um nome e um username finalizado em <code>bot</code> (Ex: <code>MeuSuporte_bot</code>)</li>
                      <li>Copie o <strong>HTTP API Token</strong> gerado e cole no campo acima!</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Campos específicos do Instagram */}
              {createForm.channel === 'instagram' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                      ID da Página do Facebook/Instagram *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 109283746501928"
                      value={createForm.instagramPageId}
                      onChange={(e) => setCreateForm({ ...createForm, instagramPageId: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                      Token de Acesso da Página (Page Access Token) *
                    </label>
                    <input
                      type="password"
                      placeholder="Cole o Page Access Token do Meta for Developers"
                      value={createForm.instagramAccessToken}
                      onChange={(e) => setCreateForm({ ...createForm, instagramAccessToken: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  {/* Informações do Webhook Meta */}
                  <div style={{ backgroundColor: 'rgba(225, 48, 108, 0.08)', border: '1px solid rgba(225, 48, 108, 0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                    <div style={{ fontWeight: 600, color: '#e1306c', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <InstagramIcon size={14} color="#e1306c" />
                      <span>Configuração do Webhook no Meta for Developers:</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)' }}>
                      <div><strong>URL de Retorno:</strong> <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/instagram` : '/api/webhooks/instagram'}</code></div>
                      <div><strong>Verify Token:</strong> <code>zeplyn_verify_token</code></div>
                      <div style={{ marginTop: '4px' }}><strong>Campos do Webhook:</strong> Assine <code>messages</code> e <code>messaging_postbacks</code>.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modo de Operação (Cards) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                  Modo de Operação do Canal
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Opção 1: 100% Humano */}
                  <div 
                    onClick={() => setCreateForm({ ...createForm, operationMode: 'human_only' })}
                    style={{
                      border: createForm.operationMode === 'human_only' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      backgroundColor: createForm.operationMode === 'human_only' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div 
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Users size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          Atendimento 100% Humano (Controle & CRM)
                        </strong>
                        <span style={{ fontSize: '0.72rem', backgroundColor: '#10b981', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Recomendado
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Todas as mensagens chegam direto na fila de espera do LiveChat para seus atendentes humanos. Nenhuma IA responde ou consome créditos.
                      </p>
                    </div>
                  </div>

                  {/* Opção 2: Híbrido com IA */}
                  <div 
                    onClick={() => setCreateForm({ ...createForm, operationMode: 'standard' })}
                    style={{
                      border: createForm.operationMode === 'standard' ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                      backgroundColor: createForm.operationMode === 'standard' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div 
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Bot size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        Híbrido com Inteligência Artificial
                      </strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Habilita respostas automatizadas de IA caso você deseje configurar prompts e perguntas frequentes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Se for Superadmin: Empresa */}
              {user?.role === 'superadmin' && companies.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                    Empresa Proprietária
                  </label>
                  <select
                    value={createForm.companyId}
                    onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Checkbox: Ignorar Grupos (Apenas WhatsApp) */}
              {createForm.channel === 'whatsapp' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="ignoreGroupsCheck"
                    checked={createForm.ignoreGroups}
                    onChange={(e) => setCreateForm({ ...createForm, ignoreGroups: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
                  />
                  <label htmlFor="ignoreGroupsCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                    Ignorar mensagens de grupos do WhatsApp
                  </label>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="btn btn-primary"
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: createForm.channel === 'telegram'
                      ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                      : createForm.channel === 'instagram'
                      ? 'linear-gradient(135deg, #e1306c 0%, #c13584 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {submittingCreate ? (
                    <RefreshCw size={16} className="spin" />
                  ) : createForm.channel === 'whatsapp' ? (
                    <QrCode size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                  <span>
                    {createForm.channel === 'whatsapp'
                      ? 'Criar & Ler QR Code'
                      : createForm.channel === 'telegram'
                      ? 'Criar & Conectar Telegram'
                      : 'Criar Canal do Instagram'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR CONFIGURAÇÕES DA CONEXÃO */}
      {showEditModal && selectedBot && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setShowEditModal(false)}
              className="btn-icon"
              style={{ position: 'absolute', top: '20px', right: '20px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Settings size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Configurar Canal: {editForm.name || selectedBot.name}
                </h2>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Ajuste os parâmetros operacionais e as credenciais do canal.
                </p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '4px' }}>
              {/* Nome */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Nome da Conexão / Canal *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {/* Credenciais específicas de Telegram */}
              {editForm.channel === 'telegram' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                    Token do Bot do Telegram (BotFather)
                  </label>
                  <input
                    type="text"
                    value={editForm.telegramToken}
                    onChange={(e) => setEditForm({ ...editForm, telegramToken: e.target.value })}
                    placeholder="Token HTTP API fornecido pelo @BotFather"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}

              {/* Credenciais específicas de Instagram */}
              {editForm.channel === 'instagram' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                      ID da Página do Facebook/Instagram
                    </label>
                    <input
                      type="text"
                      value={editForm.instagramPageId}
                      onChange={(e) => setEditForm({ ...editForm, instagramPageId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                      Token de Acesso da Página (Page Access Token)
                    </label>
                    <input
                      type="password"
                      value={editForm.instagramAccessToken}
                      onChange={(e) => setEditForm({ ...editForm, instagramAccessToken: e.target.value })}
                      placeholder="Deixe em branco para manter o token atual"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Modo de Operação */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                  Modo de Operação
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setEditForm({ ...editForm, operationMode: 'human_only' })}
                    style={{
                      border: editForm.operationMode === 'human_only' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      backgroundColor: editForm.operationMode === 'human_only' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <Users size={20} style={{ color: '#10b981', marginBottom: '4px' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      100% Humano
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Sem IA (Modo CRM)
                    </div>
                  </div>

                  <div
                    onClick={() => setEditForm({ ...editForm, operationMode: 'standard' })}
                    style={{
                      border: editForm.operationMode === 'standard' ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
                      backgroundColor: editForm.operationMode === 'standard' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <Bot size={20} style={{ color: '#3b82f6', marginBottom: '4px' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Híbrido com IA
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Autoatendimento
                    </div>
                  </div>
                </div>
              </div>

              {/* Telefone de Notificação do Administrador */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
                  WhatsApp do Administrador (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5511999998888"
                  value={editForm.adminPhoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, adminPhoneNumber: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem'
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Recebe alertas de erro de conexão e avisos do sistema no WhatsApp.
                </span>
              </div>

              {/* Checkbox: Ignorar Grupos (Apenas WhatsApp) */}
              {editForm.channel === 'whatsapp' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="editIgnoreGroupsCheck"
                    checked={editForm.ignoreGroups}
                    onChange={(e) => setEditForm({ ...editForm, ignoreGroups: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
                  />
                  <label htmlFor="editIgnoreGroupsCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                    Ignorar mensagens de grupos do WhatsApp
                  </label>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary"
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
