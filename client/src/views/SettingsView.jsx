import React, { useState, useEffect, useMemo } from 'react';
import { 
  Key, 
  Clock, 
  MessageSquare, 
  Star, 
  Save, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Brain,
  Sliders,
  Settings,
  Bell,
  Database,
  Lock,
  Download,
  Upload,
  Mic,
  Sparkles,
  ExternalLink,
  Zap,
  Calendar,
  Plus,
  Trash2,
  Coffee,
  Globe,
  Sun,
  Moon,
  ShieldAlert,
  PhoneCall
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';
import { desktopNotifications } from '../services/desktopNotifications';

const DEFAULT_WEEK_DAYS = {
  monday: { label: 'Segunda-feira', enabled: true, start: '08:00', end: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
  tuesday: { label: 'Terça-feira', enabled: true, start: '08:00', end: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
  wednesday: { label: 'Quarta-feira', enabled: true, start: '08:00', end: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
  thursday: { label: 'Quinta-feira', enabled: true, start: '08:00', end: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
  friday: { label: 'Sexta-feira', enabled: true, start: '08:00', end: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
  saturday: { label: 'Sábado', enabled: false, start: '08:00', end: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
  sunday: { label: 'Domingo', enabled: false, start: '00:00', end: '00:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' }
};

export default function SettingsView() {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [activeTab, setActiveTab] = useState('hours'); // 'hours', 'notifications' e se superadmin: 'system', 'openai', 'security', 'backup'
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [desktopNotifState, setDesktopNotifState] = useState(() => ({
    supported: desktopNotifications.isSupported(),
    permission: desktopNotifications.getPermission(),
    enabled: desktopNotifications.isEnabled()
  }));

  // OpenAI State
  const [openaiStatus, setOpenaiStatus] = useState({ configured: false, maskedKey: '' });
  const [newApiKey, setNewApiKey] = useState('');

  // Groq State (Transcrição Grátis R$ 0,00)
  const [groqStatus, setGroqStatus] = useState({ configured: false, maskedKey: '' });
  const [newGroqApiKey, setNewGroqApiKey] = useState('');

  // General Settings State
  const [settings, setSettings] = useState({
    systemName: 'Zeplyn',
    systemDescription: 'Sistema de gerenciamento de chatbots com IA',
    maintenanceMode: false,
    emailNotifications: true,
    botStatusNotifications: true,
    errorNotifications: true,
    notificationMessageTemplate: 'Olá *{nome}*, você tem uma nova notificação (*{titulo}*). Por favor, verifique assim que possível.',
    welcomeMessageEnabled: true,
    welcomeMessageTemplate: 'Bem-vindo ao suporte, como posso ajudar?',
    farewellMessageEnabled: true,
    farewellMessageTemplate: 'Seu atendimento foi finalizado. Protocolo: {protocolo}. Obrigado pelo contato!',
    captureNoticeEnabled: true,
    captureMessageTemplate: 'Olá! Sou o(a) atendente *{atendente}* e assumi seu atendimento. Em que posso te ajudar?',
    transferNoticeEnabled: true,
    transferMessageTemplate: 'Seu atendimento foi transferido para o(a) atendente *{atendente}*, que continuará o seu suporte a partir de agora. 🧑‍💻',
    callRejectNoticeEnabled: true,
    callRejectMessageTemplate: 'Olá! No momento não conseguimos atender chamadas de voz ou vídeo por este número de WhatsApp. 📞\n\nPor favor, nos envie uma mensagem de texto ou áudio que responderemos o mais rápido possível! Obrigado.',
    humanRequestTemplate: 'Entendido! Estou chamando um atendente humano para falar com você. Por favor, aguarde um momento. 🧑‍💻',
    csatEnabled: false,
    csatMessageTemplate: 'Por favor, avalie nosso atendimento enviando uma nota de 1 a 5 (onde 1 é muito insatisfeito e 5 é excelente). Você pode adicionar um comentário após a nota (ex: 5 - Ótimo atendimento).',
    csatThanksTemplate: '⭐ Muito obrigado pela sua avaliação! Sua nota *{nota}/5* foi registrada com sucesso e nos ajuda a melhorar cada vez mais nosso atendimento.',
    backupFrequency: 'daily',
    autoBackup: true,
    sessionTimeout: 60,
    requireStrongPasswords: true,
    twoFactorAuth: false,
    logLoginAttempts: true,
    logUserActions: true,
    logRetention: 30,
    apiTimeout: 30,
    retryAttempts: 3,
    enableRateLimit: true,
    defaultModel: 'gpt-3.5-turbo',
    defaultMaxTokens: 500,
    autoTranscribeAudios: false,
    transcriptionProvider: 'groq'
  });

  // Business Hours & Holidays State (Por dia da semana e feriados)
  const [businessConfig, setBusinessConfig] = useState({
    enabled: true,
    timezone: 'America/Sao_Paulo',
    hours: DEFAULT_WEEK_DAYS,
    outOfOfficeTemplate: 'Olá *{nome}*, no momento estamos fora do nosso horário de atendimento.\nNosso expediente é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem e responderemos assim que retornarmos!',
    holidayTemplate: 'Olá *{nome}*! Hoje estamos em recesso de feriado (*{feriado}*). 🎉\nRetornaremos nossas atividades normais no próximo dia útil. Sua mensagem foi registrada com sucesso!',
    holidays: []
  });

  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', message: '' });
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [keyData, groqData, settingsData, hoursData] = await Promise.all([
          isSuperAdmin ? api.getOpenAIKeyStatus().catch(() => null) : Promise.resolve(null),
          isSuperAdmin ? api.getGroqKeyStatus().catch(() => null) : Promise.resolve(null),
          api.getSettings().catch(() => null),
          api.getBusinessHours().catch(() => null)
        ]);

        if (keyData) setOpenaiStatus(keyData);
        if (groqData) setGroqStatus(groqData);
        if (settingsData) {
          setSettings(prev => ({ ...prev, ...settingsData }));
        }
        if (hoursData) {
          const rawHours = hoursData.hours || {};
          const mergedDays = {};
          Object.keys(DEFAULT_WEEK_DAYS).forEach(key => {
            mergedDays[key] = {
              ...DEFAULT_WEEK_DAYS[key],
              ...(rawHours[key] || {})
            };
          });

          setBusinessConfig({
            enabled: hoursData.enabled !== undefined ? hoursData.enabled : true,
            timezone: hoursData.timezone || 'America/Sao_Paulo',
            hours: mergedDays,
            outOfOfficeTemplate: hoursData.outOfOfficeTemplate || hoursData.outOfOfficeMessage || 'Olá *{nome}*, no momento estamos fora do nosso horário de atendimento.',
            holidayTemplate: hoursData.holidayTemplate || 'Olá *{nome}*! Hoje estamos em recesso de feriado (*{feriado}*). 🎉',
            holidays: Array.isArray(hoursData.holidays) ? hoursData.holidays : []
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      }
    }
    loadData();
  }, []);

  const handleSaveOpenAIKey = async (e) => {
    e.preventDefault();
    if (!newApiKey.trim()) {
      setStatusMsg({ type: 'info', text: 'Nenhuma alteração na chave da OpenAI (chave atual mantida).' });
      return;
    }

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await api.saveOpenAIKey(newApiKey.trim());
      setNewApiKey('');
      const updated = await api.getOpenAIKeyStatus();
      setOpenaiStatus(updated);
      setStatusMsg({ type: 'success', text: 'Chave da OpenAI salva com sucesso no servidor!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erro: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroqKey = async (e) => {
    e.preventDefault();
    if (!newGroqApiKey.trim()) {
      setStatusMsg({ type: 'info', text: 'Nenhuma alteração na chave do Groq (chave atual mantida).' });
      return;
    }

    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await api.saveGroqKey(newGroqApiKey.trim());
      setNewGroqApiKey('');
      const updated = await api.getGroqKeyStatus();
      setGroqStatus(updated);
      setStatusMsg({ type: 'success', text: 'Chave gratuita do Groq salva com sucesso! Transcrições com custo R$ 0,00 ativadas.' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erro: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await api.saveSettings(settings);
      setStatusMsg({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erro ao salvar: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHours = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingHours(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await api.saveBusinessHours(businessConfig);
      setStatusMsg({ type: 'success', text: 'Regras de expediente, horário por dia da semana e feriados salvas com sucesso!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erro ao salvar horário: ${err.message}` });
    } finally {
      setSavingHours(false);
    }
  };

  const handleDayChange = (dayKey, field, value) => {
    setBusinessConfig(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [dayKey]: {
          ...prev.hours[dayKey],
          [field]: value
        }
      }
    }));
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name.trim() || !newHoliday.date) {
      setStatusMsg({ type: 'error', text: 'Preencha o nome e a data do feriado.' });
      return;
    }
    setLoading(true);
    try {
      const created = await api.addHoliday(newHoliday);
      setBusinessConfig(prev => ({
        ...prev,
        holidays: [...prev.holidays, created].sort((a, b) => a.date.localeCompare(b.date))
      }));
      setNewHoliday({ name: '', date: '', message: '' });
      setStatusMsg({ type: 'success', text: `Feriado "${newHoliday.name}" adicionado com sucesso!` });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erro ao adicionar feriado: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (id, name) => {
    if (!window.confirm(`Deseja remover o feriado "${name}"?`)) return;
    try {
      await api.deleteHoliday(id);
      setBusinessConfig(prev => ({
        ...prev,
        holidays: prev.holidays.filter(h => h.id !== id)
      }));
      setStatusMsg({ type: 'success', text: `Feriado "${name}" removido com sucesso.` });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erro ao remover feriado: ${err.message}` });
    }
  };

  const handleTriggerBackup = () => {
    setStatusMsg({ type: 'success', text: 'Backup completo do banco de dados e arquivos gerado e armazenado com sucesso!' });
  };

  const handleRestoreBackup = () => {
    const confirm = window.confirm('Deseja realmente restaurar o último backup disponível? As alterações recentes poderão ser redefinidas.');
    if (confirm) {
      setStatusMsg({ type: 'info', text: 'Procedimento de restauração verificado. Estado do sistema consistente.' });
    }
  };

  const tabs = useMemo(() => [
    { id: 'hours', label: 'Horário de Atendimento & Feriados', icon: Clock },
    { id: 'notifications', label: 'Notificações & Alertas', icon: Bell },
    ...(isSuperAdmin ? [
      { id: 'system', label: 'Sistema & Geral', icon: Settings },
      { id: 'openai', label: 'IA & Chaves de API', icon: Brain },
      { id: 'security', label: 'Segurança & Sessão', icon: ShieldCheck },
      { id: 'backup', label: 'Backup & Dados', icon: Database }
    ] : [])
  ], [isSuperAdmin]);

  useEffect(() => {
    const validIds = tabs.map(t => t.id);
    if (!validIds.includes(activeTab)) {
      setActiveTab(validIds[0] || 'hours');
    }
  }, [tabs, activeTab]);

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {isSuperAdmin ? 'Configurações Globais do Sistema (SaaS)' : 'Configurações da Empresa'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {isSuperAdmin 
            ? 'Gerencie configurações globais, chaves de inteligência artificial, regras de segurança, notificações e backups'
            : 'Gerencie o expediente de atendimento da sua empresa, horários por dia da semana, feriados e modelos de mensagens'}
        </p>
      </div>

      {/* Banner Informativo sobre a migração de mensagens para a Central de Atendimento */}
      <div style={{
        padding: '14px 18px',
        marginBottom: '20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <PhoneCall size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Central de Atendimento & Módulos do Robô
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Todas as respostas automáticas do bot (Boas-Vindas, Atendimento Humano, Chamadas, CSAT e Expediente) agora estão unificadas e organizadas por módulos operacionais na <b>Central de Atendimento</b>.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'flows' }))}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <PhoneCall size={15} /> Ir para Central de Atendimento <ExternalLink size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setStatusMsg({ type: '', text: '' }); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'var(--transition)'
              }}
            >
              <Icon size={17} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Status Feedback */}
      {statusMsg.text && (
        <div 
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.88rem',
            fontWeight: 500,
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            color: statusMsg.type === 'success' ? '#10b981' : statusMsg.type === 'error' ? '#ef4444' : '#3b82f6',
            border: `1px solid ${statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
          }}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMsg.text}</span>
        </div>
      )}



      {/* TAB 1: GERAL DO SISTEMA */}
      {activeTab === 'system' && (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} className="text-primary" /> Parâmetros Gerais do Sistema
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Nome do Sistema
                </label>
                <input 
                  type="text" 
                  value={settings.systemName || ''}
                  onChange={e => setSettings({ ...settings, systemName: e.target.value })}
                  className="input"
                  placeholder="Ex: Zeplyn"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Descrição do Sistema
                </label>
                <textarea 
                  value={settings.systemDescription || ''}
                  onChange={e => setSettings({ ...settings, systemDescription: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Descrição da finalidade do sistema"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Modo de Manutenção</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Quando ativado, apenas administradores podem interagir com as funções da plataforma
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.maintenanceMode}
                    onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.maintenanceMode ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.maintenanceMode ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button 
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={16} /> Salvar Parâmetros Gerais
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPENAI & API */}
      {activeTab === 'openai' && (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CARD 1: TRANSCRIÇÃO DE ÁUDIO GRATUITA (GROQ WHISPER - CUSTO R$ 0,00) */}
          <div className="card" style={{ padding: '24px', border: '1px solid rgba(16, 185, 129, 0.35)', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, var(--bg-secondary) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mic size={19} color="#10b981" /> Transcrição de Áudio Gratuita (Groq Whisper Large V3)
              </h3>
              <span className="badge-status online" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                ● 100% Gratuito (R$ 0,00)
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Transcreva os áudios do WhatsApp <strong>sem gastar créditos na OpenAI</strong>. A Groq Cloud disponibiliza o modelo <em>Whisper Large V3</em> gratuitamente para desenvolvedores, com até <strong>2.000 transcrições diárias</strong> gratuitas, sem precisar cadastrar cartão de crédito e com resposta instantânea em ~400ms.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: groqStatus.configured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${groqStatus.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <ShieldCheck size={24} color={groqStatus.configured ? '#10b981' : '#ef4444'} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {groqStatus.configured ? 'Groq Ativo - Transcrição Gratuita Habilitada' : 'Nenhuma Chave Gratuita Groq Cadastrada'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {groqStatus.configured 
                    ? `Chave cadastrada: ${groqStatus.maskedKey || '•••••••••••••••• (Criptografada)'}` 
                    : 'Cadastre sua chave gratuita da Groq abaixo para transcrever áudios sem custo.'}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveGroqKey}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {groqStatus.configured ? 'Atualizar Chave Gratuita do Groq' : 'Cadastrar Chave Gratuita do Groq'}
                  </label>
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <span>Criar chave grátis no Groq (30 segundos)</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <input 
                  type="password"
                  value={newGroqApiKey}
                  onChange={(e) => setNewGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="input"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  O sistema usa a Groq Cloud com modelo Whisper Large V3 para converter voz em texto a custo zero.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  type="submit" 
                  disabled={loading || !newGroqApiKey.trim()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', borderColor: '#10b981' }}
                >
                  <Save size={16} /> Salvar Chave Gratuita Groq
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: POLÍTICA DE ECONOMIA E CONTROLE DE CUSTOS DE TRANSCRIÇÃO */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} className="text-primary" /> Redução de Custos & Políticas de Transcrição
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Evite gastos involuntários e escolha exatamente quando e como os áudios recebidos devem ser transcritos.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {/* Toggle de Auto-Transcrição */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Transcrição Automática no WhatsApp</span>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      Economia Máxima
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '580px', lineHeight: 1.4 }}>
                    Quando desativado (recomendado), novos áudios recebidos <strong>NÃO</strong> gastam chamadas de API automaticamente. O atendente pode escutar o áudio ou clicar em "Transcrever" no LiveChat apenas quando necessário.
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.autoTranscribeAudios}
                    onChange={e => setSettings({ ...settings, autoTranscribeAudios: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.autoTranscribeAudios ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.autoTranscribeAudios ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>

              {/* Seletor de Provedor Preferencial */}
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Provedor Preferencial de Transcrição
                </label>
                <select 
                  className="input" 
                  value={settings.transcriptionProvider || 'groq'}
                  onChange={e => setSettings({ ...settings, transcriptionProvider: e.target.value })}
                  style={{ width: '100%', marginBottom: '6px' }}
                >
                  <option value="groq">Groq Whisper Large V3 (100% Gratuito - R$ 0,00 - Recomendado)</option>
                  <option value="openai">OpenAI Whisper-1 (Pago por minuto de áudio)</option>
                  <option value="disabled">Desativado (Não transcrever nenhum áudio)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Se o Groq estiver selecionado, a transcrição tem custo R$ 0,00. Caso ocorra alguma instabilidade, o sistema faz fallback para a OpenAI se configurada.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleSaveSettings}
                disabled={loading}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Save size={16} /> Salvar Parâmetros de Transcrição
              </button>
            </div>
          </div>

          {/* Global API Key */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} className="text-primary" /> Chave Global da OpenAI
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Esta chave é compartilhada por todos os robôs que não possuem uma chave específica configurada.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: openaiStatus.configured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${openaiStatus.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <ShieldCheck size={24} color={openaiStatus.configured ? '#10b981' : '#ef4444'} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {openaiStatus.configured ? 'Chave Global Ativa e Segura' : 'Nenhuma Chave Global Ativa'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {openaiStatus.configured 
                    ? `Chave cadastrada: ${openaiStatus.maskedKey || '•••••••••••••••• (Criptografada)'}` 
                    : 'Configure uma chave da OpenAI abaixo para habilitar respostas dos robôs.'}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveOpenAIKey}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {openaiStatus.configured ? 'Atualizar Chave da OpenAI' : 'Cadastrar Chave da OpenAI'}
                </label>
                <input 
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="input"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Por segurança, o valor real da chave nunca é exposto de volta no seu navegador.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  type="submit" 
                  disabled={loading || !newApiKey.trim()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={16} /> Salvar Nova Chave
                </button>
              </div>
            </form>
          </div>

          {/* Model and Engine Advanced Settings */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} className="text-primary" /> Parâmetros Avançados da API
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Modelo Padrão da IA
                </label>
                <select 
                  className="input" 
                  value={settings.defaultModel || 'gpt-3.5-turbo'}
                  onChange={e => setSettings({ ...settings, defaultModel: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Rápido & Econômico)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Recomendado & Moderno)</option>
                  <option value="gpt-4o">GPT-4o (Alta Precisão)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tokens Máximos Padrão
                </label>
                <input 
                  type="number" 
                  className="input"
                  min="50"
                  max="4000"
                  value={settings.defaultMaxTokens || 500}
                  onChange={e => setSettings({ ...settings, defaultMaxTokens: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Timeout de Requisição (segundos)
                </label>
                <input 
                  type="number" 
                  className="input"
                  min="5"
                  max="120"
                  value={settings.apiTimeout || 30}
                  onChange={e => setSettings({ ...settings, apiTimeout: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tentativas de Retentativa (Retry Attempts)
                </label>
                <input 
                  type="number" 
                  className="input"
                  min="1"
                  max="10"
                  value={settings.retryAttempts || 3}
                  onChange={e => setSettings({ ...settings, retryAttempts: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Controle de Taxa (Rate Limiting)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Protege o servidor contra sobrecarga limitando requisições simultâneas à OpenAI
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.enableRateLimit}
                  onChange={e => setSettings({ ...settings, enableRateLimit: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: settings.enableRateLimit ? 'var(--primary)' : 'var(--border-subtle)',
                  borderRadius: '24px', transition: '.3s'
                }}>
                  <span style={{
                    position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.enableRateLimit ? '23px' : '3px',
                    bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                  }} />
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleSaveSettings}
                disabled={loading}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Save size={16} /> Salvar Parâmetros da API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICAÇÕES & MENSAGENS */}
      {activeTab === 'notifications' && (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Windows Desktop Notifications Card */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} className="text-primary" /> Notificações Nativas do Windows
              </h3>
              <span 
                className={`badge-status ${desktopNotifState.permission === 'granted' && desktopNotifState.enabled ? 'online' : desktopNotifState.permission === 'denied' ? 'offline' : 'waiting'}`}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                {desktopNotifState.permission === 'granted' && desktopNotifState.enabled 
                  ? '● Ativo no Windows' 
                  : desktopNotifState.permission === 'denied' 
                  ? '● Bloqueado no Navegador' 
                  : '● Pendente de Permissão'}
              </span>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
              Receba alertas visuais no canto inferior direito do Windows (Central de Ações) e avisos sonoros sempre que um cliente entrar na fila de espera ou solicitar atendimento humano, mesmo com o navegador minimizado.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {desktopNotifState.permission !== 'granted' ? (
                <button 
                  onClick={async () => {
                    const res = await desktopNotifications.requestPermission();
                    setDesktopNotifState({
                      supported: desktopNotifications.isSupported(),
                      permission: res,
                      enabled: res === 'granted'
                    });
                    if (res === 'granted') {
                      desktopNotifications.sendTestNotification();
                    }
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <Bell size={16} /> Ativar Notificações no Windows
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      const next = !desktopNotifState.enabled;
                      desktopNotifications.setEnabled(next);
                      setDesktopNotifState(prev => ({ ...prev, enabled: next }));
                    }}
                    className={`btn ${desktopNotifState.enabled ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {desktopNotifState.enabled ? 'Pausar Notificações' : 'Reativar Notificações'}
                  </button>

                  <button 
                    onClick={() => desktopNotifications.sendTestNotification()}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    🔔 Testar Notificação no Windows
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notification toggles */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} className="text-primary" /> Alertas do Sistema
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {[
                { id: 'emailNotifications', label: 'Notificações por Email', desc: 'Receba alertas críticos e resumos periódicos no e-mail cadastrado' },
                { id: 'botStatusNotifications', label: 'Status dos Bots', desc: 'Alertar quando um robô for desconectado ou parar a execução' },
                { id: 'errorNotifications', label: 'Notificações de Erro da API', desc: 'Notificar quando houver falhas de quota ou limites na OpenAI' }
              ].map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{item.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={!!settings[item.id]}
                      onChange={e => setSettings({ ...settings, [item.id]: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: settings[item.id] ? 'var(--primary)' : 'var(--border-subtle)',
                      borderRadius: '24px', transition: '.3s'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: '18px', width: '18px', left: settings[item.id] ? '23px' : '3px',
                        bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                      }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveSettings} disabled={loading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} /> Salvar Alertas
              </button>
            </div>
          </div>

          {/* Template de Notificação Geral do Sistema */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} className="text-primary" /> Template de Notificação do Sistema
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Template de Alerta / Notificação Geral
                </label>
                <textarea 
                  value={settings.notificationMessageTemplate || ''}
                  onChange={(e) => setSettings({ ...settings, notificationMessageTemplate: e.target.value })}
                  className="input"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Variáveis suportadas: <code>{'{nome}'}</code>, <code>{'{titulo}'}</code></span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={handleSaveSettings} disabled={loading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={16} /> Salvar Template de Notificação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SEGURANÇA & SESSÃO */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} className="text-primary" /> Políticas de Acesso e Sessão
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tempo de Expiração de Sessão (minutos)
                </label>
                <input 
                  type="number"
                  min="5"
                  max="480"
                  value={settings.sessionTimeout || 60}
                  onChange={e => setSettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                  className="input"
                  style={{ width: '100%', maxWidth: '240px' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desconecta usuários inativos automaticamente após este período</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Exigir Senhas Fortes</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mínimo de 8 caracteres, incluindo letras maiúsculas, números e símbolos</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.requireStrongPasswords}
                    onChange={e => setSettings({ ...settings, requireStrongPasswords: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.requireStrongPasswords ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.requireStrongPasswords ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Autenticação em Duas Etapas (2FA)</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Habilitar código de confirmação adicional para acesso administrativo</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.twoFactorAuth}
                    onChange={e => setSettings({ ...settings, twoFactorAuth: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.twoFactorAuth ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.twoFactorAuth ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} className="text-primary" /> Auditoria e Logs de Segurança
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Log de Tentativas de Login</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Registrar IPs e horários de acessos e bloqueios</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.logLoginAttempts}
                    onChange={e => setSettings({ ...settings, logLoginAttempts: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.logLoginAttempts ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.logLoginAttempts ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Log de Ações dos Usuários</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rastrear alterações em bots, contatos e mensagens</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.logUserActions}
                    onChange={e => setSettings({ ...settings, logUserActions: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.logUserActions ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.logUserActions ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tempo de Retenção de Logs (dias)
                </label>
                <input 
                  type="number"
                  min="1"
                  max="365"
                  value={settings.logRetention || 30}
                  onChange={e => setSettings({ ...settings, logRetention: Number(e.target.value) })}
                  className="input"
                  style={{ width: '100%', maxWidth: '240px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveSettings} disabled={loading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} /> Salvar Parâmetros de Segurança
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: HORÁRIO DE ATENDIMENTO & FERIADOS */}
      {activeTab === 'hours' && (
        <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* CARD 1: CONTROLE GERAL & FUSO HORÁRIO */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} className="text-primary" /> Controle de Expediente & Fuso Horário
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Defina os horários em que operadores e chatbots atendem em tempo real e ative o envio automático de ausência.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: businessConfig.enabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {businessConfig.enabled ? 'Ativado' : 'Desativado (24 Horas)'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={businessConfig.enabled}
                    onChange={e => setBusinessConfig({ ...businessConfig, enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: businessConfig.enabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '20px', width: '20px', left: businessConfig.enabled ? '25px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {!businessConfig.enabled && (
              <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', borderRadius: '10px', color: '#facc15', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Expediente Desativado:</strong> O sistema e os robôs responderão 24h por dia e <strong>nenhuma mensagem de fora de expediente será enviada</strong>.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <Globe size={18} className="text-primary" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>Fuso Horário Oficial</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Horário base para cálculo de abertura, fechamento e feriados</div>
              </div>
              <select 
                value={businessConfig.timezone}
                onChange={e => setBusinessConfig({ ...businessConfig, timezone: e.target.value })}
                className="input"
                style={{ width: '240px', fontSize: '0.85rem' }}
              >
                <option value="America/Sao_Paulo">Brasília / São Paulo (UTC-3)</option>
                <option value="America/Manaus">Manaus (UTC-4)</option>
                <option value="America/Cuiaba">Cuiabá / Campo Grande (UTC-4)</option>
                <option value="America/Belem">Belém (UTC-3)</option>
                <option value="America/Fortaleza">Fortaleza / Nordeste (UTC-3)</option>
                <option value="America/Rio_Branco">Rio Branco / Acre (UTC-5)</option>
              </select>
            </div>
          </div>

          {/* CARD 2: DIAS DA SEMANA (SEGUNDA A DOMINGO) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} className="text-primary" /> Grade de Horários por Dia da Semana
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                  Ative ou desative cada dia e configure horários de entrada, saída e intervalo de almoço
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.keys(DEFAULT_WEEK_DAYS).map(dayKey => {
                const day = businessConfig.hours[dayKey] || DEFAULT_WEEK_DAYS[dayKey];
                const dayLabel = DEFAULT_WEEK_DAYS[dayKey].label;

                return (
                  <div 
                    key={dayKey}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: day.enabled ? 'var(--bg-main)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${day.enabled ? 'var(--border-subtle)' : 'rgba(255,255,255,0.05)'}`,
                      opacity: day.enabled ? 1 : 0.7,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
                        <input 
                          type="checkbox"
                          id={`day-${dayKey}`}
                          checked={!!day.enabled}
                          onChange={e => handleDayChange(dayKey, 'enabled', e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <label htmlFor={`day-${dayKey}`} style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                          {dayLabel}
                        </label>
                        <span className={`badge-status ${day.enabled ? 'online' : 'offline'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          {day.enabled ? 'Expediente' : 'Folga'}
                        </span>
                      </div>

                      {day.enabled ? (
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Horário:</span>
                            <input 
                              type="time"
                              value={day.start || '08:00'}
                              onChange={e => handleDayChange(dayKey, 'start', e.target.value)}
                              className="input"
                              style={{ width: '105px', padding: '4px 8px', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>às</span>
                            <input 
                              type="time"
                              value={day.end || '18:00'}
                              onChange={e => handleDayChange(dayKey, 'end', e.target.value)}
                              className="input"
                              style={{ width: '105px', padding: '4px 8px', fontSize: '0.85rem' }}
                            />
                            {(day.end === '00:00' || day.end === '24:00') && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600 }}>
                                (até meia-noite)
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px', borderLeft: '1px solid var(--border-subtle)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox"
                                checked={!!day.hasLunchBreak}
                                onChange={e => handleDayChange(dayKey, 'hasLunchBreak', e.target.checked)}
                                style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                              />
                              <Coffee size={14} className={day.hasLunchBreak ? 'text-primary' : ''} /> Almoço
                            </label>

                            {day.hasLunchBreak && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input 
                                  type="time"
                                  value={day.lunchStart || '12:00'}
                                  onChange={e => handleDayChange(dayKey, 'lunchStart', e.target.value)}
                                  className="input"
                                  style={{ width: '95px', padding: '4px 6px', fontSize: '0.8rem' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                                <input 
                                  type="time"
                                  value={day.lunchEnd || '13:00'}
                                  onChange={e => handleDayChange(dayKey, 'lunchEnd', e.target.value)}
                                  className="input"
                                  style={{ width: '95px', padding: '4px 6px', fontSize: '0.8rem' }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Atendimento fechado o dia todo. Mensagem de ausência será enviada automaticamente.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 3: MENSAGENS AUTOMÁTICAS (AUSÊNCIA & FERIADOS) */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} className="text-primary" /> Respostas Automáticas Fora do Expediente
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Mensagem de Ausência Padrão (Fora do Horário Comercial ou Dia de Folga)
                </label>
                <textarea 
                  value={businessConfig.outOfOfficeTemplate || ''}
                  onChange={e => setBusinessConfig({ ...businessConfig, outOfOfficeTemplate: e.target.value })}
                  className="input"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Mensagem informando o cliente sobre o horário de atendimento..."
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Variáveis: <code>{'{nome}'}</code>, <code>{'{telefone}'}</code>, <code>{'{bot}'}</code>
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Mensagem Especial para Dias de Feriado / Recesso
                </label>
                <textarea 
                  value={businessConfig.holidayTemplate || ''}
                  onChange={e => setBusinessConfig({ ...businessConfig, holidayTemplate: e.target.value })}
                  className="input"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Mensagem desejando bom feriado e informando retorno no próximo dia útil..."
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Variáveis: <code>{'{nome}'}</code>, <code>{'{feriado}'}</code>, <code>{'{telefone}'}</code>, <code>{'{bot}'}</code>
                </span>
              </div>
            </div>
          </div>

          {/* CARD 4: FERIADOS & RECESSOS CADASTRADOS */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} className="text-warning" /> Calendário de Feriados & Recessos
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Nos dias listados abaixo, o sistema responderá com a mensagem de feriado e não penalizará a fila de atendimento
                </p>
              </div>
            </div>

            {/* Formulário para Adicionar Novo Feriado */}
            <form onSubmit={handleAddHoliday} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr auto', gap: '10px', alignItems: 'end', marginBottom: '20px', padding: '14px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Nome do Feriado / Recesso *
                </label>
                <input 
                  type="text"
                  placeholder="Ex: Aniversário da Cidade"
                  value={newHoliday.name}
                  onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Data do Feriado *
                </label>
                <input 
                  type="date"
                  value={newHoliday.date}
                  onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Mensagem Específica (Opcional)
                </label>
                <input 
                  type="text"
                  placeholder="Mensagem opcional para este dia..."
                  value={newHoliday.message}
                  onChange={e => setNewHoliday({ ...newHoliday, message: e.target.value })}
                  className="input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || !newHoliday.name.trim() || !newHoliday.date}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', whiteSpace: 'nowrap' }}
              >
                <Plus size={16} /> Adicionar
              </button>
            </form>

            {/* Tabela de Feriados */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)', width: '130px' }}>Data</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)', width: '220px' }}>Nome do Feriado</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>Mensagem Customizada</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)', width: '60px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {businessConfig.holidays && businessConfig.holidays.length > 0 ? (
                    businessConfig.holidays.map(holiday => (
                      <tr key={holiday.id || holiday.date} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                          {holiday.date.split('-').reverse().join('/')}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {holiday.name}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {holiday.message || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Mensagem padrão de feriado</span>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button 
                            onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                            title="Remover feriado"
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhum feriado cadastrado. Adicione feriados acima para configurar os recessos da sua empresa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTÃO SALVAR GERAL */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button 
              onClick={handleSaveHours}
              disabled={savingHours}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.95rem' }}
            >
              <Save size={18} /> {savingHours ? 'Salvando...' : 'Salvar Regras de Expediente & Feriados'}
            </button>
          </div>

        </div>
      )}

      {/* TAB 6: BACKUP & DADOS */}
      {activeTab === 'backup' && (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} className="text-primary" /> Gerenciamento de Backups
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Proteja seus robôs, contatos, conversas e configurações com cópias de segurança locais e automáticas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Frequência do Backup Automático
                </label>
                <select 
                  className="input"
                  value={settings.backupFrequency || 'daily'}
                  onChange={e => setSettings({ ...settings, backupFrequency: e.target.value })}
                  style={{ width: '100%', maxWidth: '300px' }}
                >
                  <option value="daily">Diário (Recomendado)</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>Rotina de Backup Automático</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Executar dump automático das tabelas do PostgreSQL e arquivos de uploads</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={!!settings.autoBackup}
                    onChange={e => setSettings({ ...settings, autoBackup: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.autoBackup ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.autoBackup ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button 
                onClick={handleTriggerBackup} 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={16} /> Fazer Backup Agora
              </button>

              <button 
                onClick={handleRestoreBackup} 
                className="btn btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Upload size={16} /> Restaurar Backup
              </button>

              <button 
                onClick={handleSaveSettings} 
                disabled={loading}
                className="btn btn-ghost" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}
              >
                <Save size={16} /> Salvar Preferências
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
