import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  Megaphone, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Image, 
  Mic, 
  Eye, 
  Calendar, 
  Sparkles, 
  Tag, 
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Coffee
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';

const WEEKDAYS = [
  { id: '1', label: 'Seg' },
  { id: '2', label: 'Ter' },
  { id: '3', label: 'Qua' },
  { id: '4', label: 'Qui' },
  { id: '5', label: 'Sex' },
  { id: '6', label: 'Sáb' },
  { id: '0', label: 'Dom' },
];

export default function CampaignsView() {
  const [campaigns, setCampaigns] = useState([]);
  const [bots, setBots] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignLogs, setCampaignLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    botId: '',
    targetType: 'all', // 'all', 'tag', 'manual'
    targetTags: [],
    manualNumbersText: '',
    messageTemplate: 'Olá, {{nome}}! Tudo bem?\n\nPassando para compartilhar uma novidade exclusiva com você.',
    mediaType: 'none', // 'none', 'image', 'audio_ptt', 'document'
    mediaUrl: '',
    delayMin: 30,
    delayMax: 75,
    scheduleEnabled: false,
    scheduledAt: '',
    // Configurações de Horários Aleatórios do Dia e Anti-Ban
    randomTimeEnabled: true,
    windowStartTime: '08:30',
    windowEndTime: '18:00',
    dispatchDays: ['1', '2', '3', '4', '5', '6'], // Seg a Sáb
    distributionMode: 'random_day', // 'random_day' ou 'interval'
    batchMin: 5,
    batchMax: 12,
    batchPauseMin: 5,
    batchPauseMax: 15,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [campsRes, botsRes, tagsRes] = await Promise.all([
        api.getCampaigns().catch(() => []),
        api.getBots().catch(() => []),
        api.getUserTags().catch(() => [])
      ]);

      setCampaigns(Array.isArray(campsRes) ? campsRes : []);
      const botList = Array.isArray(botsRes) ? botsRes : (botsRes?.bots || []);
      setBots(botList);
      setUserTags(Array.isArray(tagsRes) ? tagsRes : []);

      if (botList.length > 0 && !formData.botId) {
        setFormData(prev => ({ ...prev, botId: botList[0].id }));
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Ouvintes Socket.IO para atualizações em tempo real
    const cleanupProgress = socketService.on('campaign:progress', (data) => {
      setCampaigns(prev => prev.map(c => {
        if (c.id === data.campaignId) {
          return {
            ...c,
            sentCount: data.sentCount !== undefined ? data.sentCount : c.sentCount,
            failedCount: data.failedCount !== undefined ? data.failedCount : c.failedCount,
            totalCount: data.totalCount || c.totalCount,
            status: data.status || c.status,
            waitReason: data.waitReason !== undefined ? data.waitReason : c.waitReason,
            nextDispatchAt: data.nextDispatchAt !== undefined ? data.nextDispatchAt : c.nextDispatchAt
          };
        }
        return c;
      }));
    });

    const cleanupStatus = socketService.on('campaign:status-change', (data) => {
      setCampaigns(prev => prev.map(c => {
        if (c.id === data.campaignId) {
          return { 
            ...c, 
            status: data.status,
            waitReason: data.waitReason !== undefined ? data.waitReason : c.waitReason,
            nextDispatchAt: data.nextDispatchAt !== undefined ? data.nextDispatchAt : c.nextDispatchAt
          };
        }
        return c;
      }));
    });

    return () => {
      cleanupProgress();
      cleanupStatus();
    };
  }, []);

  // Métricas do Topo
  const stats = useMemo(() => {
    const total = campaigns.length;
    const running = campaigns.filter(c => c.status === 'running').length;
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
    const sumAttempts = totalSent + totalFailed;
    const successRate = sumAttempts > 0 ? Math.round((totalSent / sumAttempts) * 100) : 100;

    return { total, running, totalSent, successRate };
  }, [campaigns]);

  // Ações de Campanha
  const handleStart = async (id) => {
    try {
      setActionLoading(id);
      await api.startCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c));
    } catch (err) {
      alert(err.message || 'Erro ao iniciar campanha');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (id) => {
    try {
      setActionLoading(id);
      await api.pauseCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'paused', waitReason: null, nextDispatchAt: null } : c));
    } catch (err) {
      alert(err.message || 'Erro ao pausar campanha');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta campanha? Os envios restantes serão suspensos.')) return;
    try {
      setActionLoading(id);
      await api.cancelCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'canceled', waitReason: null, nextDispatchAt: null } : c));
    } catch (err) {
      alert(err.message || 'Erro ao cancelar campanha');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta campanha e todo o seu histórico de relatórios?')) return;
    try {
      setActionLoading(id);
      await api.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err.message || 'Erro ao excluir campanha');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenLogs = async (camp) => {
    setSelectedCampaign(camp);
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const logs = await api.getCampaignLogs(camp.id);
      setCampaignLogs(logs);
    } catch (err) {
      console.error('Erro ao buscar logs da campanha:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Presets Rápidos Anti-Ban
  const applyAntiBanPreset = (presetKey) => {
    if (presetKey === 'max_protection') {
      setFormData(prev => ({
        ...prev,
        randomTimeEnabled: true,
        distributionMode: 'random_day',
        delayMin: 45,
        delayMax: 120,
        batchMin: 5,
        batchMax: 10,
        batchPauseMin: 8,
        batchPauseMax: 18,
        windowStartTime: '08:30',
        windowEndTime: '18:00',
        dispatchDays: ['1', '2', '3', '4', '5', '6']
      }));
    } else if (presetKey === 'balanced') {
      setFormData(prev => ({
        ...prev,
        randomTimeEnabled: true,
        distributionMode: 'random_day',
        delayMin: 30,
        delayMax: 70,
        batchMin: 8,
        batchMax: 15,
        batchPauseMin: 5,
        batchPauseMax: 10,
        windowStartTime: '08:00',
        windowEndTime: '19:00',
        dispatchDays: ['1', '2', '3', '4', '5', '6']
      }));
    } else if (presetKey === 'fast') {
      setFormData(prev => ({
        ...prev,
        randomTimeEnabled: false,
        distributionMode: 'interval',
        delayMin: 15,
        delayMax: 35
      }));
    }
  };

  // Submit Criar Campanha
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Informe o nome da campanha.');
    if (!formData.botId) return alert('Selecione uma conexão de WhatsApp.');
    if (!formData.messageTemplate.trim()) return alert('Digite a mensagem a ser enviada.');

    try {
      setActionLoading('create');

      // Processar lista manual se aplicável
      let manualNumbers = [];
      if (formData.targetType === 'manual') {
        manualNumbers = formData.manualNumbersText
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean);
        if (manualNumbers.length === 0) {
          alert('Insira pelo menos um número de telefone na lista manual.');
          setActionLoading(null);
          return;
        }
      }

      const payload = {
        name: formData.name,
        botId: formData.botId,
        targetType: formData.targetType,
        targetTags: formData.targetTags,
        manualNumbers,
        messageTemplate: formData.messageTemplate,
        mediaType: formData.mediaType,
        mediaUrl: formData.mediaUrl || null,
        delayMin: parseInt(formData.delayMin, 10) || 30,
        delayMax: parseInt(formData.delayMax, 10) || 75,
        scheduledAt: formData.scheduleEnabled && formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
        // Proteção Anti-Ban e Horários Aleatórios do Dia
        randomTimeEnabled: Boolean(formData.randomTimeEnabled),
        windowStartTime: formData.windowStartTime || '08:30',
        windowEndTime: formData.windowEndTime || '18:00',
        dispatchDays: formData.dispatchDays,
        batchMin: parseInt(formData.batchMin, 10) || 5,
        batchMax: parseInt(formData.batchMax, 10) || 12,
        batchPauseMin: parseInt(formData.batchPauseMin, 10) || 5,
        batchPauseMax: parseInt(formData.batchPauseMax, 10) || 15,
        distributionMode: formData.distributionMode || 'random_day'
      };

      await api.createCampaign(payload);
      setShowCreateModal(false);
      loadData();
      alert('Campanha criada com sucesso!');
    } catch (err) {
      alert(err.message || 'Erro ao criar campanha');
    } finally {
      setActionLoading(null);
    }
  };

  // Helper para preview simulado
  const previewMessage = useMemo(() => {
    let text = formData.messageTemplate || '';
    text = text.replace(/{{\s*nome\s*}}/gi, 'Carlos Silva');
    text = text.replace(/{{\s*telefone\s*}}/gi, '11999998888');
    text = text.replace(/{{\s*data\s*}}/gi, new Date().toLocaleDateString('pt-BR'));
    text = text.replace(/{{\s*hora\s*}}/gi, '14:30');

    // Simula resolução de spintax no preview
    const spintaxRegex = /\{([^{}]+)\}/;
    let match;
    while ((match = spintaxRegex.exec(text)) !== null) {
      const options = match[1].split('|');
      text = text.slice(0, match.index) + options[0].trim() + text.slice(match.index + match[0].length);
    }
    return text;
  }, [formData.messageTemplate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Disparos em Massa (Campanhas)
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Envio automatizado com <strong>horários aleatórios do dia</strong>, pausas humanas e proteção anti-bloqueio.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={loadData} 
            disabled={loading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px var(--primary-glow)' }}
          >
            <Plus size={18} />
            Nova Campanha
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total de Campanhas</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.total}</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Em Execução</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Play size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{stats.running}</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Mensagens Enviadas</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              <Send size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalSent}</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Taxa de Entrega</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#eab308' }}>{stats.successRate}%</div>
        </div>
      </div>

      {/* Tabela de Campanhas */}
      <div 
        className="glass-panel" 
        style={{ 
          borderRadius: '16px', 
          overflow: 'hidden', 
          border: '1px solid var(--border-subtle)', 
          background: 'var(--bg-secondary)' 
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Campanhas Cadastradas
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {campaigns.length} {campaigns.length === 1 ? 'campanha' : 'campanhas'}
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Megaphone size={42} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              Nenhuma campanha criada ainda
            </h4>
            <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0' }}>
              Crie seu primeiro disparo em massa com horários aleatórios do dia para proteger seu chip.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <Plus size={16} /> Criar Primeira Campanha
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Campanha</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Bot WhatsApp</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Público</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Progresso</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Status & Anti-Ban</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(camp => {
                  const percent = camp.totalCount > 0 ? Math.round(((camp.sentCount + camp.failedCount) / camp.totalCount) * 100) : 0;
                  const isRunning = camp.status === 'running';

                  return (
                    <tr key={camp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{camp.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {new Date(camp.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                          {camp.randomTimeEnabled && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              <ShieldCheck size={11} /> {camp.windowStartTime || '08:30'} - {camp.windowEndTime || '18:00'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {camp.botName || `Bot (${camp.botId})`}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {camp.targetType === 'all' && (
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontSize: '0.78rem', fontWeight: 600 }}>
                            Todos os Contatos
                          </span>
                        )}
                        {camp.targetType === 'tag' && (
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', fontSize: '0.78rem', fontWeight: 600 }}>
                            Por Etiquetas
                          </span>
                        )}
                        {camp.targetType === 'manual' && (
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.12)', color: '#eab308', fontSize: '0.78rem', fontWeight: 600 }}>
                            Lista Manual
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', minWidth: '170px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>{camp.sentCount} de {camp.totalCount} ({percent}%)</span>
                          {camp.failedCount > 0 && <span style={{ color: '#ef4444' }}>{camp.failedCount} falhas</span>}
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${Math.min(percent, 100)}%`, 
                              height: '100%', 
                              background: isRunning ? 'linear-gradient(90deg, #10b981, #3b82f6)' : camp.status === 'completed' ? '#10b981' : '#64748b',
                              transition: 'width 0.4s ease'
                            }} 
                          />
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', maxWidth: '280px' }}>
                        {camp.status === 'running' && (
                          <div>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              padding: '3px 10px', 
                              borderRadius: '14px', 
                              background: camp.waitReason ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                              color: camp.waitReason ? '#60a5fa' : '#10b981', 
                              fontSize: '0.78rem', 
                              fontWeight: 700 
                            }}>
                              <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                background: camp.waitReason ? '#3b82f6' : '#10b981', 
                                animation: 'pulse 1.5s infinite' 
                              }} />
                              {camp.waitReason ? 'Pausa Anti-Ban' : 'Disparando...'}
                            </span>
                            {camp.waitReason && (
                              <div style={{ 
                                fontSize: '0.73rem', 
                                color: '#93c5fd', 
                                marginTop: '4px', 
                                lineHeight: 1.3,
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                padding: '4px 8px',
                                borderRadius: '6px'
                              }}>
                                {camp.waitReason}
                              </div>
                            )}
                          </div>
                        )}
                        {camp.status === 'completed' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: '0.78rem', fontWeight: 600 }}>
                            <CheckCircle2 size={13} /> Concluída
                          </span>
                        )}
                        {camp.status === 'paused' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '14px', background: 'rgba(234, 179, 8, 0.12)', color: '#eab308', fontSize: '0.78rem', fontWeight: 600 }}>
                            <Pause size={13} /> Pausada
                          </span>
                        )}
                        {camp.status === 'scheduled' && (
                          <div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', fontSize: '0.78rem', fontWeight: 600 }}>
                              <Clock size={13} /> Agendada
                            </span>
                            {camp.scheduledAt && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {new Date(camp.scheduledAt).toLocaleString('pt-BR')}
                              </div>
                            )}
                          </div>
                        )}
                        {camp.status === 'draft' && (
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Rascunho
                          </span>
                        )}
                        {camp.status === 'canceled' && (
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.78rem' }}>
                            Cancelada
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenLogs(camp)}
                            className="btn-icon"
                            title="Ver Relatório de Disparos"
                            style={{ padding: '6px', borderRadius: '6px' }}
                          >
                            <Eye size={16} />
                          </button>

                          {camp.status === 'running' && (
                            <button
                              onClick={() => handlePause(camp.id)}
                              disabled={actionLoading === camp.id}
                              className="btn-icon"
                              title="Pausar Disparos"
                              style={{ padding: '6px', borderRadius: '6px', color: '#eab308' }}
                            >
                              <Pause size={16} />
                            </button>
                          )}

                          {(camp.status === 'draft' || camp.status === 'paused' || camp.status === 'scheduled') && (
                            <button
                              onClick={() => handleStart(camp.id)}
                              disabled={actionLoading === camp.id}
                              className="btn-icon"
                              title="Iniciar Disparos"
                              style={{ padding: '6px', borderRadius: '6px', color: '#10b981' }}
                            >
                              <Play size={16} />
                            </button>
                          )}

                          {camp.status === 'running' && (
                            <button
                              onClick={() => handleCancel(camp.id)}
                              disabled={actionLoading === camp.id}
                              className="btn-icon"
                              title="Cancelar Campanha"
                              style={{ padding: '6px', borderRadius: '6px', color: '#ef4444' }}
                            >
                              <Square size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(camp.id)}
                            disabled={actionLoading === camp.id}
                            className="btn-icon"
                            title="Excluir Campanha"
                            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar Campanha */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                  <Megaphone size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Nova Campanha de Disparo em Massa
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Configure os parâmetros com proteção anti-ban e horários aleatórios do dia
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateCampaign} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Linha 1: Nome e Robô */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                    Nome da Campanha: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex: Promoção Semanal, Reativação VIP"
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                    Conexão do WhatsApp (Bot): *
                  </label>
                  <select
                    value={formData.botId}
                    onChange={e => setFormData({ ...formData, botId: e.target.value })}
                    required
                    style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer' }}
                  >
                    <option value="" disabled>Selecione um robô...</option>
                    {bots.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.phone || 'Sem número'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 2: Seleção de Público-Alvo */}
              <div>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                  Público-Alvo do Disparo:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, targetType: 'all' })}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: formData.targetType === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: formData.targetType === 'all' ? 'var(--primary-subtle)' : 'var(--bg-main)',
                      color: formData.targetType === 'all' ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={16} /> Todos os Contatos
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Toda a base cadastrada no bot
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, targetType: 'tag' })}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: formData.targetType === 'tag' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: formData.targetType === 'tag' ? 'var(--primary-subtle)' : 'var(--bg-main)',
                      color: formData.targetType === 'tag' ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Tag size={16} /> Por Etiqueta / Tag
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Filtrar contatos por tags CRM
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, targetType: 'manual' })}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: formData.targetType === 'manual' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: formData.targetType === 'manual' ? 'var(--primary-subtle)' : 'var(--bg-main)',
                      color: formData.targetType === 'manual' ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} /> Lista Manual
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Colar telefones ou CSV
                    </div>
                  </button>
                </div>
              </div>

              {/* Subcampo de Tags */}
              {formData.targetType === 'tag' && (
                <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                    Selecione as etiquetas que receberão a mensagem:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {userTags.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Nenhuma etiqueta cadastrada ainda no sistema.
                      </span>
                    ) : (
                      userTags.map(tag => {
                        const isSelected = formData.targetTags.includes(tag.name);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                targetTags: isSelected 
                                  ? prev.targetTags.filter(t => t !== tag.name)
                                  : [...prev.targetTags, tag.name]
                              }));
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '16px',
                              border: isSelected ? `2px solid ${tag.color || '#3b82f6'}` : '1px solid var(--border-subtle)',
                              background: isSelected ? tag.color || '#3b82f6' : 'var(--bg-secondary)',
                              color: isSelected ? '#fff' : 'var(--text-main)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Subcampo Lista Manual */}
              {formData.targetType === 'manual' && (
                <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Cole os números (1 por linha). Ex: 5511999998888 ou "Carlos, 5511999998888":
                  </label>
                  <textarea
                    rows={4}
                    value={formData.manualNumbersText}
                    onChange={e => setFormData({ ...formData, manualNumbersText: e.target.value })}
                    placeholder="5511999998888&#10;Maria, 5511988887777&#10;5519977776666"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.82rem', fontFamily: 'monospace' }}
                  />
                </div>
              )}

              {/* Mensagem e Prévia WhatsApp */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Texto da Mensagem: *
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, messageTemplate: p.messageTemplate + ' {{nome}}' }))}
                        style={{ padding: '2px 6px', fontSize: '0.72rem', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--primary)', cursor: 'pointer' }}
                      >
                        + {`{{nome}}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, messageTemplate: p.messageTemplate + ' {{telefone}}' }))}
                        style={{ padding: '2px 6px', fontSize: '0.72rem', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--primary)', cursor: 'pointer' }}
                      >
                        + {`{{telefone}}`}
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    required
                    value={formData.messageTemplate}
                    onChange={e => setFormData({ ...formData, messageTemplate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />

                  {/* Dica Spintax */}
                  <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', fontSize: '0.76rem', color: '#60a5fa', lineHeight: 1.4 }}>
                    ✨ <strong>Dica Spintax Anti-Ban:</strong> Use variações no texto como <code style={{ color: '#93c5fd' }}>{`{Olá|Oi|Bom dia}`}</code>. Cada contato receberá uma versão diferente!
                  </div>
                </div>

                {/* Prévia Estilo WhatsApp */}
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                    Prévia no WhatsApp:
                  </label>
                  <div style={{
                    background: '#0b141a',
                    backgroundImage: 'radial-gradient(#1f2c34 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                    borderRadius: '12px',
                    padding: '16px',
                    height: '210px',
                    overflowY: 'auto',
                    border: '1px solid #222e35',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end'
                  }}>
                    <div style={{
                      background: '#005c4b',
                      color: '#e9edef',
                      padding: '8px 12px',
                      borderRadius: '8px 0px 8px 8px',
                      maxWidth: '90%',
                      alignSelf: 'flex-end',
                      fontSize: '0.82rem',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      position: 'relative'
                    }}>
                      {previewMessage}
                      <div style={{ textAlign: 'right', fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                        14:30 ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Anexo de Mídia Opcional */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                    Anexar Mídia:
                  </label>
                  <select
                    value={formData.mediaType}
                    onChange={e => setFormData({ ...formData, mediaType: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                  >
                    <option value="none">Nenhuma mídia (Apenas Texto)</option>
                    <option value="audio_ptt">🎤 Áudio Gravado na Hora (PTT)</option>
                    <option value="image">🖼️ Imagem (Foto / Banner)</option>
                    <option value="document">📄 Documento (PDF)</option>
                  </select>
                </div>

                {formData.mediaType !== 'none' && (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                      URL do Arquivo ({formData.mediaType === 'audio_ptt' ? '.mp3/.ogg' : formData.mediaType === 'image' ? '.jpg/.png' : '.pdf'}):
                    </label>
                    <input
                      type="text"
                      value={formData.mediaUrl}
                      onChange={e => setFormData({ ...formData, mediaUrl: e.target.value })}
                      placeholder="https://exemplo.com/arquivo.mp3 ou /uploads/..."
                      style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.82rem' }}
                    />
                  </div>
                )}
              </div>

              {/* ============================================================== */}
              {/* SEÇÃO PRINCIPAL: PROTEÇÃO ANTI-BAN & HORÁRIOS ALEATÓRIOS DO DIA */}
              {/* ============================================================== */}
              <div style={{
                background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 21, 34, 0.6) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                        Proteção Anti-Bloqueio & Horários Aleatórios do Dia
                      </h4>
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0 }}>
                        Evita o bloqueio do chip enviando em momentos aleatórios do dia e aplicando pausas humanas
                      </p>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.randomTimeEnabled}
                      onChange={e => setFormData({ ...formData, randomTimeEnabled: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: formData.randomTimeEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {formData.randomTimeEnabled ? 'Ativado (Protegido)' : 'Desativado'}
                    </span>
                  </label>
                </div>

                {formData.randomTimeEnabled && (
                  <>
                    {/* Presets Rápidos */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
                        Modelos Pré-definidos:
                      </span>
                      <button
                        type="button"
                        onClick={() => applyAntiBanPreset('max_protection')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        🛡️ Proteção Máxima (Recomendado)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyAntiBanPreset('balanced')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-main)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ⚖️ Equilibrado
                      </button>
                      <button
                        type="button"
                        onClick={() => applyAntiBanPreset('fast')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#f87171',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Disparo Direto (Sem Pausa de Lote)
                      </button>
                    </div>

                    {/* Janela de Horários e Dias da Semana */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '14px', background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                          🕒 Janela de Horário Ativo do Dia:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="time"
                            value={formData.windowStartTime}
                            onChange={e => setFormData({ ...formData, windowStartTime: e.target.value })}
                            style={{ width: '90px', height: '34px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>até</span>
                          <input
                            type="time"
                            value={formData.windowEndTime}
                            onChange={e => setFormData({ ...formData, windowEndTime: e.target.value })}
                            style={{ width: '90px', height: '34px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                          />
                        </div>
                        <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                          Fora deste horário o sistema pausa e aguarda o dia seguinte.
                        </span>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                          📅 Dias Permitidos para Envio:
                        </label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {WEEKDAYS.map(day => {
                            const isChecked = formData.dispatchDays.includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    dispatchDays: isChecked
                                      ? prev.dispatchDays.filter(d => d !== day.id)
                                      : [...prev.dispatchDays, day.id]
                                  }));
                                }}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  background: isChecked ? 'var(--primary-subtle)' : 'var(--bg-secondary)',
                                  color: isChecked ? 'var(--primary)' : 'var(--text-muted)',
                                  fontWeight: isChecked ? 700 : 500,
                                  fontSize: '0.78rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Intervalos Aleatórios e Pausas por Lotes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                          ⏳ Intervalo Aleatório entre Cada Envio:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            min={10}
                            max={120}
                            value={formData.delayMin}
                            onChange={e => setFormData({ ...formData, delayMin: e.target.value })}
                            style={{ width: '70px', height: '34px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>a</span>
                          <input
                            type="number"
                            min={15}
                            max={300}
                            value={formData.delayMax}
                            onChange={e => setFormData({ ...formData, delayMax: e.target.value })}
                            style={{ width: '70px', height: '34px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>segundos</span>
                        </div>
                        <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                          Varia a cada mensagem para não gerar padrão repetitivo.
                        </span>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                          <Coffee size={14} color="#f59e0b" /> Pausa Humana por Lotes (Descanso):
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-main)', flexWrap: 'wrap' }}>
                          <span>A cada</span>
                          <input
                            type="number"
                            min={3}
                            max={30}
                            value={formData.batchMin}
                            onChange={e => setFormData({ ...formData, batchMin: e.target.value })}
                            style={{ width: '55px', height: '32px', padding: '0 6px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                          />
                          <span>a</span>
                          <input
                            type="number"
                            min={5}
                            max={50}
                            value={formData.batchMax}
                            onChange={e => setFormData({ ...formData, batchMax: e.target.value })}
                            style={{ width: '55px', height: '32px', padding: '0 6px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                          />
                          <span>envios, pausar por</span>
                          <input
                            type="number"
                            min={2}
                            max={60}
                            value={formData.batchPauseMin}
                            onChange={e => setFormData({ ...formData, batchPauseMin: e.target.value })}
                            style={{ width: '55px', height: '32px', padding: '0 6px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                          />
                          <span>a</span>
                          <input
                            type="number"
                            min={3}
                            max={120}
                            value={formData.batchPauseMax}
                            onChange={e => setFormData({ ...formData, batchPauseMax: e.target.value })}
                            style={{ width: '55px', height: '32px', padding: '0 6px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                          />
                          <span>min.</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.78rem', color: '#6ee7b7', lineHeight: 1.4 }}>
                      💡 <strong>Como funciona o Anti-Ban:</strong> O robô enviará entre {formData.batchMin} e {formData.batchMax} mensagens com intervalos aleatórios de {formData.delayMin}s a {formData.delayMax}s, e fará descansos de {formData.batchPauseMin} a {formData.batchPauseMax} minutos apenas entre {formData.windowStartTime} e {formData.windowEndTime}, simulando 100% o comportamento de uma pessoa real.
                    </div>
                  </>
                )}
              </div>

              {/* Agendamento Opcional de Início */}
              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="#3b82f6" /> Agendar Data de Início (Opcional):
                  </label>
                  <input
                    type="checkbox"
                    checked={formData.scheduleEnabled}
                    onChange={e => setFormData({ ...formData, scheduleEnabled: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                </div>

                {formData.scheduleEnabled && (
                  <input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                  />
                )}
                {!formData.scheduleEnabled && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    A campanha será criada pronta para iniciar imediatamente quando você clicar em Disparar.
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 24px', fontWeight: 600 }}
                >
                  <Send size={15} />
                  {formData.scheduleEnabled ? 'Agendar Campanha' : 'Criar Campanha Protegida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Relatório de Envio (Logs) */}
      {showLogsModal && selectedCampaign && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Relatório de Disparos: {selectedCampaign.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {campaignLogs.length} destinatários processados
                  </p>
                  {selectedCampaign.randomTimeEnabled && (
                    <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      🛡️ Janela: {selectedCampaign.windowStartTime || '08:30'} às {selectedCampaign.windowEndTime || '18:00'} (Pausas: {selectedCampaign.batchPauseMin || 5}-{selectedCampaign.batchPauseMax || 15}min)
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowLogsModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
              {loadingLogs ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                  Carregando relatório detalhado...
                </div>
              ) : campaignLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum log registrado para esta campanha ainda.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Destinatário</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Telefone</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-main)' }}>
                          {log.contactName || 'Cliente'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {log.phoneNumber}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {log.status === 'sent' && (
                            <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <CheckCircle2 size={13} /> Enviado
                            </span>
                          )}
                          {log.status === 'failed' && (
                            <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }} title={log.errorMessage}>
                              <XCircle size={13} /> Falha
                            </span>
                          )}
                          {log.status === 'pending' && (
                            <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={13} /> Aguardando
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {log.sentAt ? new Date(log.sentAt).toLocaleTimeString('pt-BR') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
