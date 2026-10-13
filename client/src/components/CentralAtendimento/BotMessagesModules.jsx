import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Star,
  ShieldAlert,
  Clock,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  RotateCcw,
  Check,
  UserCheck,
  ArrowRight,
  PhoneCall,
  Info,
  HelpCircle,
  PhoneOff,
  Headphones
} from 'lucide-react';
import { api } from '../../services/api';

// Modelos padrão recomendados
const DEFAULT_TEMPLATES = {
  welcomeMessageTemplate: 'Olá *{nome}*, seja muito bem-vindo(a) ao nosso atendimento! Como posso te ajudar hoje?',
  captureMessageTemplate: 'Olá! Sou o(a) atendente *{atendente}* e assumi seu atendimento. Em que posso te ajudar?',
  transferMessageTemplate: 'Seu atendimento foi transferido para o(a) atendente *{atendente}*, que continuará o seu suporte a partir de agora. 🧑‍💻',
  humanRequestTemplate: 'Entendido! Estou chamando um atendente humano para falar com você. Por favor, aguarde um momento. 🧑‍💻',
  farewellMessageTemplate: 'Seu atendimento foi finalizado. Protocolo: {protocolo}. Obrigado pelo contato!',
  callRejectMessageTemplate: 'Olá! No momento não conseguimos atender chamadas de voz ou vídeo por este número de WhatsApp. 📞\n\nPor favor, nos envie uma mensagem de texto ou áudio que responderemos o mais rápido possível! Obrigado.',
  csatMessageTemplate: 'Por favor, avalie nosso atendimento enviando uma nota de 1 a 5 (onde 1 é muito insatisfeito e 5 é excelente). Você pode adicionar um comentário após a nota (ex: 5 - Ótimo atendimento).',
  csatThanksTemplate: '⭐ Muito obrigado pela sua avaliação! Sua nota *{nota}/5* foi registrada com sucesso e nos ajuda a melhorar cada vez mais nosso atendimento.',
  outOfOfficeTemplate: 'Olá *{nome}*, no momento estamos fora do nosso horário de atendimento.\nNosso expediente é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem e retornaremos assim que iniciarmos o expediente!',
  holidayTemplate: 'Olá *{nome}*! Hoje estamos em recesso de feriado (*{feriado}*). 🎉\nRetornaremos nossas atividades no próximo dia útil. Sua mensagem foi registrada com sucesso!'
};

/**
 * Componente de Pré-visualização de Balão do WhatsApp
 */
function WhatsAppPreview({ text, variables = {}, title = 'Pré-visualização no WhatsApp' }) {
  // Substitui variáveis simuladas para o preview
  let simulatedText = text || '';
  const defaultSimValues = {
    nome: 'João Silva',
    atendente: 'Carlos Atendente',
    protocolo: 'AT-2026-8941',
    nota: '5 ⭐',
    feriado: 'Feriado de Tiradentes',
    telefone: '+55 (11) 98765-4321',
    titulo: 'Novo Chamado'
  };

  const finalVars = { ...defaultSimValues, ...variables };

  Object.entries(finalVars).forEach(([key, val]) => {
    simulatedText = simulatedText.replace(new RegExp(`{${key}}`, 'gi'), val);
  });

  // Formatação básica de WhatsApp (*bold*, _italic_, ~strike~)
  const formattedHtml = simulatedText
    .split('\n')
    .map(line => {
      let l = line
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~(.*?)~/g, '<del>$1</del>');
      return l;
    })
    .join('<br />');

  return (
    <div style={{
      background: 'var(--bg-main)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          Simulação Cliente
        </span>
      </div>

      {/* Balão WhatsApp */}
      <div style={{
        maxWidth: '100%',
        alignSelf: 'flex-start',
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: '0px 14px 14px 14px',
        padding: '10px 14px',
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div 
          dangerouslySetHtml={{ __html: formattedHtml || '<span style="opacity: 0.5; font-style: italic;">Digite uma mensagem para pré-visualizar...</span>' }}
          style={{
            fontSize: '0.86rem',
            lineHeight: '1.45',
            color: 'var(--text-main)',
            wordBreak: 'break-word',
            whiteSpace: 'normal'
          }}
        />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          marginTop: '6px',
          fontSize: '0.68rem',
          color: 'var(--text-muted)'
        }}>
          <span>10:42</span>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>✓✓</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Pílula clicável para inserir variáveis no textarea
 */
function VariableBadge({ varName, description, onInsert }) {
  return (
    <button
      type="button"
      onClick={() => onInsert(`{${varName}}`)}
      title={`Clique para inserir {${varName}} (${description})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        color: 'var(--primary)',
        fontSize: '0.74rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'}
    >
      <code>{`{${varName}}`}</code>
      <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>({description})</span>
    </button>
  );
}

export default function BotMessagesModules({ selectedModule = 'welcome', onSelectModule }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Configurações do Bot (Tabelas de Configurações do Dashboard/Company)
  const [settings, setSettings] = useState({
    welcomeMessageEnabled: true,
    welcomeMessageTemplate: DEFAULT_TEMPLATES.welcomeMessageTemplate,
    farewellMessageEnabled: true,
    farewellMessageTemplate: DEFAULT_TEMPLATES.farewellMessageTemplate,
    captureNoticeEnabled: true,
    captureMessageTemplate: DEFAULT_TEMPLATES.captureMessageTemplate,
    transferNoticeEnabled: true,
    transferMessageTemplate: DEFAULT_TEMPLATES.transferMessageTemplate,
    callRejectNoticeEnabled: true,
    callRejectMessageTemplate: DEFAULT_TEMPLATES.callRejectMessageTemplate,
    humanRequestTemplate: DEFAULT_TEMPLATES.humanRequestTemplate,
    csatEnabled: false,
    csatMessageTemplate: DEFAULT_TEMPLATES.csatMessageTemplate,
    csatThanksTemplate: DEFAULT_TEMPLATES.csatThanksTemplate
  });

  // Configurações de Expediente / Ausência
  const [businessConfig, setBusinessConfig] = useState({
    enabled: true,
    outOfOfficeTemplate: DEFAULT_TEMPLATES.outOfOfficeTemplate,
    holidayTemplate: DEFAULT_TEMPLATES.holidayTemplate
  });

  // Carregar dados da API
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [settingsData, hoursData] = await Promise.allSettled([
          api.getSettings(),
          api.getBusinessHours()
        ]);

        if (settingsData.status === 'fulfilled' && settingsData.value) {
          setSettings(prev => ({
            ...prev,
            ...settingsData.value,
            welcomeMessageTemplate: settingsData.value.welcomeMessageTemplate || DEFAULT_TEMPLATES.welcomeMessageTemplate,
            farewellMessageTemplate: settingsData.value.farewellMessageTemplate || DEFAULT_TEMPLATES.farewellMessageTemplate,
            captureMessageTemplate: settingsData.value.captureMessageTemplate || DEFAULT_TEMPLATES.captureMessageTemplate,
            transferMessageTemplate: settingsData.value.transferMessageTemplate || DEFAULT_TEMPLATES.transferMessageTemplate,
            callRejectMessageTemplate: settingsData.value.callRejectMessageTemplate || DEFAULT_TEMPLATES.callRejectMessageTemplate,
            humanRequestTemplate: settingsData.value.humanRequestTemplate || DEFAULT_TEMPLATES.humanRequestTemplate,
            csatMessageTemplate: settingsData.value.csatMessageTemplate || DEFAULT_TEMPLATES.csatMessageTemplate,
            csatThanksTemplate: settingsData.value.csatThanksTemplate || DEFAULT_TEMPLATES.csatThanksTemplate
          }));
        }

        if (hoursData.status === 'fulfilled' && hoursData.value) {
          setBusinessConfig(prev => ({
            ...prev,
            ...hoursData.value,
            outOfOfficeTemplate: hoursData.value.outOfOfficeTemplate || hoursData.value.outOfOfficeMessage || DEFAULT_TEMPLATES.outOfOfficeTemplate,
            holidayTemplate: hoursData.value.holidayTemplate || DEFAULT_TEMPLATES.holidayTemplate
          }));
        }
      } catch (err) {
        console.error('Erro ao carregar mensagens do bot:', err);
        showNotification('error', 'Falha ao carregar configurações de mensagens do bot.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Salvar configurações gerais de mensagens
  const handleSaveSettings = async (moduleName) => {
    try {
      setSaving(true);
      await api.saveSettings(settings);
      showNotification('success', `Módulo "${moduleName}" salvo com sucesso!`);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showNotification('error', `Falha ao salvar: ${err.message || 'Erro de rede'}`);
    } finally {
      setSaving(false);
    }
  };

  // Salvar mensagens de expediente
  const handleSaveHours = async () => {
    try {
      setSaving(true);
      await api.saveBusinessHours(businessConfig);
      showNotification('success', 'Mensagens de expediente e feriados salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar horários:', err);
      showNotification('error', `Falha ao salvar: ${err.message || 'Erro de rede'}`);
    } finally {
      setSaving(false);
    }
  };

  // Inserir variável no campo especificado
  const handleInsertVariable = (field, tag, isBusiness = false) => {
    if (isBusiness) {
      setBusinessConfig(prev => ({
        ...prev,
        [field]: (prev[field] || '') + ' ' + tag
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [field]: (prev[field] || '') + ' ' + tag
      }));
    }
  };

  // Restaurar padrão
  const handleRestoreDefault = (field, isBusiness = false) => {
    if (DEFAULT_TEMPLATES[field]) {
      if (isBusiness) {
        setBusinessConfig(prev => ({ ...prev, [field]: DEFAULT_TEMPLATES[field] }));
      } else {
        setSettings(prev => ({ ...prev, [field]: DEFAULT_TEMPLATES[field] }));
      }
      showNotification('info', 'Modelo restaurado para o padrão recomendado.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '14px' }} />
        <p style={{ margin: 0, fontSize: '0.92rem' }}>Carregando módulos de mensagens do robô...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#3b82f6' : '#10b981',
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

      {/* ========================================================================= */}
      {/* MÓDULO 2: BOAS-VINDAS & TRIAGEM INICIAL                                   */}
      {/* ========================================================================= */}
      {selectedModule === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card explicativo */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <Sparkles size={24} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                Módulo 2: Boas-Vindas & Triagem de Primeiro Contato
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Disparada automaticamente no primeiro contato do cliente (saudações como <i>"Oi"</i>, <i>"Olá"</i>, <i>"Boa tarde"</i>).
                <br />
                💡 <b>Regra de Precedência Inteligente:</b> Se o <b>Menu URA (Módulo 1)</b> estiver ativado, a URA assume com o menu numérico de departamentos (1, 2, 3...) de forma limpa, evitando saudações repetidas ao cliente.
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} className="text-primary" /> Saudação Automática de Boas-Vindas
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Acolhe novos contatos e apresenta sua empresa
                </p>
              </div>

              {/* Toggle Boas-Vindas */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: settings.welcomeMessageEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {settings.welcomeMessageEnabled ? 'Ativada' : 'Desativada'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!settings.welcomeMessageEnabled}
                    onChange={e => setSettings({ ...settings, welcomeMessageEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.welcomeMessageEnabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.welcomeMessageEnabled ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {settings.welcomeMessageEnabled ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                {/* Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Texto da Mensagem
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRestoreDefault('welcomeMessageTemplate')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RotateCcw size={12} /> Restaurar Padrão
                    </button>
                  </div>

                  <textarea
                    value={settings.welcomeMessageTemplate || ''}
                    onChange={e => setSettings({ ...settings, welcomeMessageTemplate: e.target.value })}
                    className="input"
                    rows={4}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                    placeholder="Ex: Olá *{nome}*, seja muito bem-vindo(a) ao nosso atendimento! Como posso te ajudar?"
                  />

                  {/* Variáveis */}
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      Variáveis Dinâmicas (Clique para inserir):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('welcomeMessageTemplate', tag)} />
                      <VariableBadge varName="telefone" description="Telefone do cliente" onInsert={tag => handleInsertVariable('welcomeMessageTemplate', tag)} />
                    </div>
                  </div>
                </div>

                {/* WhatsApp Preview */}
                <WhatsAppPreview 
                  text={settings.welcomeMessageTemplate}
                  title="Pré-visualização do Cliente"
                />
              </div>
            ) : (
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ⚠️ Mensagem de boas-vindas desativada. As mensagens serão atendidas diretamente pelo Menu URA ou pelo operador humano.
              </div>
            )}

            {/* Ações */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleSaveSettings('Boas-Vindas & Triagem')}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.88rem' }}
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Módulo de Boas-Vindas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 3: ATENDIMENTO HUMANO & LIVECHAT                                  */}
      {/* ========================================================================= */}
      {selectedModule === 'human' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <Headphones size={24} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                Módulo 3: Atendimento Humano & LiveChat
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Mensagens enviadas durante o ciclo de atendimento com operadores humanos: quando o atendente captura o chamado, quando transfere para outro setor, quando o cliente solicita humano ou quando o atendimento é encerrado com protocolo.
              </div>
            </div>
          </div>

          {/* Submódulo 3.1: Captura de Atendimento */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={18} className="text-primary" /> 3.1 Aviso ao Capturar Atendimento
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Disparada no WhatsApp quando o operador clica no botão <b>"Capturar Atendimento"</b> no LiveChat
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: settings.captureNoticeEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {settings.captureNoticeEnabled ? 'Ativo' : 'Desativado'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!settings.captureNoticeEnabled}
                    onChange={e => setSettings({ ...settings, captureNoticeEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.captureNoticeEnabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: settings.captureNoticeEnabled ? '21px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {settings.captureNoticeEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Mensagem de Captura</label>
                    <button type="button" onClick={() => handleRestoreDefault('captureMessageTemplate')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCcw size={12} /> Padrão
                    </button>
                  </div>
                  <textarea
                    value={settings.captureMessageTemplate || ''}
                    onChange={e => setSettings({ ...settings, captureMessageTemplate: e.target.value })}
                    className="input"
                    rows={2}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <VariableBadge varName="atendente" description="Nome do operador" onInsert={tag => handleInsertVariable('captureMessageTemplate', tag)} />
                    <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('captureMessageTemplate', tag)} />
                  </div>
                </div>
                <WhatsAppPreview text={settings.captureMessageTemplate} title="Aviso de Captura" />
              </div>
            )}
          </div>

          {/* Submódulo 3.2: Transferência de Atendimento */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowRight size={18} className="text-warning" /> 3.2 Aviso ao Transferir Atendimento
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Enviada no WhatsApp quando a conversa é transferida para outro operador ou setor
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: settings.transferNoticeEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {settings.transferNoticeEnabled ? 'Ativo' : 'Desativado'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!settings.transferNoticeEnabled}
                    onChange={e => setSettings({ ...settings, transferNoticeEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.transferNoticeEnabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: settings.transferNoticeEnabled ? '21px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {settings.transferNoticeEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Mensagem de Transferência</label>
                    <button type="button" onClick={() => handleRestoreDefault('transferMessageTemplate')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCcw size={12} /> Padrão
                    </button>
                  </div>
                  <textarea
                    value={settings.transferMessageTemplate || ''}
                    onChange={e => setSettings({ ...settings, transferMessageTemplate: e.target.value })}
                    className="input"
                    rows={2}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <VariableBadge varName="atendente" description="Novo atendente" onInsert={tag => handleInsertVariable('transferMessageTemplate', tag)} />
                    <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('transferMessageTemplate', tag)} />
                  </div>
                </div>
                <WhatsAppPreview text={settings.transferMessageTemplate} title="Aviso de Transferência" />
              </div>
            )}
          </div>

          {/* Submódulo 3.3: Solicitação de Humano pela IA */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} className="text-primary" /> 3.3 Confirmação ao Chamar Atendente Humano (Transbordo)
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Enviada automaticamente quando o cliente solicita atendimento humano (ex: <i>"quero falar com uma pessoa"</i>) e é colocado na fila de espera
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Mensagem de Encaminhamento para Fila</label>
                  <button type="button" onClick={() => handleRestoreDefault('humanRequestTemplate')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RotateCcw size={12} /> Padrão
                  </button>
                </div>
                <textarea
                  value={settings.humanRequestTemplate || ''}
                  onChange={e => setSettings({ ...settings, humanRequestTemplate: e.target.value })}
                  className="input"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('humanRequestTemplate', tag)} />
                </div>
              </div>
              <WhatsAppPreview text={settings.humanRequestTemplate} title="Confirmação de Fila" />
            </div>
          </div>

          {/* Submódulo 3.4: Encerramento de Atendimento */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} className="text-success" /> 3.4 Mensagem de Encerramento (Finalização de Chat)
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Enviada ao cliente quando o operador clica no botão <b>"Encerrar Atendimento"</b> no LiveChat
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: settings.farewellMessageEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {settings.farewellMessageEnabled ? 'Ativo' : 'Desativado'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!settings.farewellMessageEnabled}
                    onChange={e => setSettings({ ...settings, farewellMessageEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.farewellMessageEnabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: settings.farewellMessageEnabled ? '21px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {settings.farewellMessageEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Mensagem com Protocolo</label>
                    <button type="button" onClick={() => handleRestoreDefault('farewellMessageTemplate')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCcw size={12} /> Padrão
                    </button>
                  </div>
                  <textarea
                    value={settings.farewellMessageTemplate || ''}
                    onChange={e => setSettings({ ...settings, farewellMessageTemplate: e.target.value })}
                    className="input"
                    rows={2}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem' }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <VariableBadge varName="protocolo" description="Código do protocolo" onInsert={tag => handleInsertVariable('farewellMessageTemplate', tag)} />
                    <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('farewellMessageTemplate', tag)} />
                    <VariableBadge varName="atendente" description="Nome do atendente" onInsert={tag => handleInsertVariable('farewellMessageTemplate', tag)} />
                  </div>
                </div>
                <WhatsAppPreview text={settings.farewellMessageTemplate} title="Encerramento de Chat" />
              </div>
            )}
          </div>

          {/* Botão Salvar Módulo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
            <button
              type="button"
              onClick={() => handleSaveSettings('Atendimento Humano & LiveChat')}
              disabled={saving}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '0.88rem' }}
            >
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Módulo de Atendimento Humano'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 4: CHAMADAS DE VOZ & VÍDEO (WHATSAPP)                             */}
      {/* ========================================================================= */}
      {selectedModule === 'calls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.08) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <PhoneOff size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                Módulo 4: Chamadas de Voz & Vídeo no WhatsApp
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                A API oficial e conexões WhatsApp Web de atendimento não suportam chamadas de voz e vídeo pelo computador.
                Este módulo recusa chamadas automaticamente e envia imediatamente uma mensagem cordial instruindo o cliente a enviar texto ou áudio.
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} className="text-danger" /> Recusa Automática com Aviso Cordial
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Evita que clientes fiquem chamando sem resposta na linha
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: settings.callRejectNoticeEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {settings.callRejectNoticeEnabled ? 'Ativada' : 'Desativada'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!settings.callRejectNoticeEnabled}
                    onChange={e => setSettings({ ...settings, callRejectNoticeEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.callRejectNoticeEnabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.callRejectNoticeEnabled ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {settings.callRejectNoticeEnabled ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Mensagem de Aviso ao Recusar Chamada
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRestoreDefault('callRejectMessageTemplate')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RotateCcw size={12} /> Restaurar Padrão
                    </button>
                  </div>

                  <textarea
                    value={settings.callRejectMessageTemplate || ''}
                    onChange={e => setSettings({ ...settings, callRejectMessageTemplate: e.target.value })}
                    className="input"
                    rows={4}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                  />

                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      Variáveis Dinâmicas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <VariableBadge varName="nome" description="Nome do contato" onInsert={tag => handleInsertVariable('callRejectMessageTemplate', tag)} />
                    </div>
                  </div>
                </div>

                <WhatsAppPreview 
                  text={settings.callRejectMessageTemplate}
                  title="Aviso de Chamada Recusada"
                />
              </div>
            ) : (
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ⚠️ Recusa automática desativada. As chamadas não receberão resposta automática explicativa.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleSaveSettings('Chamadas WhatsApp')}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.88rem' }}
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Módulo de Chamadas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 5: AVALIAÇÃO DE ATENDIMENTO (CSAT)                                */}
      {/* ========================================================================= */}
      {selectedModule === 'csat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <Star size={24} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                Módulo 5: Avaliação de Atendimento (Pesquisa CSAT)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Mede a satisfação dos seus clientes após o encerramento da conversa. As notas de 1 a 5 alimentam diretamente os relatórios de satisfação, métricas e o indicador de CSAT na Dashboard em tempo real.
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={18} className="text-warning" /> Pesquisa de Satisfação Pós-Atendimento
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Envia a pergunta de nota de 1 a 5 após o encerramento do chamado
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: settings.csatEnabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {settings.csatEnabled ? 'Ativada' : 'Desativada'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!settings.csatEnabled}
                    onChange={e => setSettings({ ...settings, csatEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: settings.csatEnabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: settings.csatEnabled ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {settings.csatEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                
                {/* 1. Pergunta da Avaliação */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        1. Pergunta da Avaliação (Enviada junto ao encerramento)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRestoreDefault('csatMessageTemplate')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RotateCcw size={12} /> Padrão
                      </button>
                    </div>

                    <textarea
                      value={settings.csatMessageTemplate || ''}
                      onChange={e => setSettings({ ...settings, csatMessageTemplate: e.target.value })}
                      className="input"
                      rows={3}
                      style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                    />

                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                        Variáveis Dinâmicas:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('csatMessageTemplate', tag)} />
                        <VariableBadge varName="protocolo" description="Protocolo" onInsert={tag => handleInsertVariable('csatMessageTemplate', tag)} />
                      </div>
                    </div>
                  </div>

                  <WhatsAppPreview 
                    text={settings.csatMessageTemplate}
                    title="Pergunta de Satisfação"
                  />
                </div>

                {/* 2. Mensagem de Agradecimento */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        2. Mensagem de Agradecimento (Enviada quando o cliente responde de 1 a 5)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRestoreDefault('csatThanksTemplate')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RotateCcw size={12} /> Padrão
                      </button>
                    </div>

                    <textarea
                      value={settings.csatThanksTemplate || ''}
                      onChange={e => setSettings({ ...settings, csatThanksTemplate: e.target.value })}
                      className="input"
                      rows={3}
                      style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                    />

                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                        Variáveis Dinâmicas:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <VariableBadge varName="nota" description="Nota atribuída (1 a 5)" onInsert={tag => handleInsertVariable('csatThanksTemplate', tag)} />
                        <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('csatThanksTemplate', tag)} />
                      </div>
                    </div>
                  </div>

                  <WhatsAppPreview 
                    text={settings.csatThanksTemplate}
                    title="Agradecimento da Avaliação"
                    variables={{ nota: '5' }}
                  />
                </div>

              </div>
            ) : (
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ⚠️ Pesquisa CSAT desativada. Nenhuma pergunta de avaliação será enviada ao cliente após o encerramento.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleSaveSettings('Avaliação CSAT')}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.88rem' }}
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Módulo CSAT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 6: FORA DE HORÁRIO & FERIADOS (EXPEDIENTE)                        */}
      {/* ========================================================================= */}
      {selectedModule === 'hours' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <Clock size={24} style={{ color: '#a855f7', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                Módulo 6: Mensagens de Expediente & Recesso (Fora de Horário)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Configuração das respostas automáticas disparadas quando o cliente envia mensagem fora do horário comercial da sua empresa ou em dias de feriados cadastrados.
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} className="text-primary" /> Respostas Fora do Expediente Comercial
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Mensagem padrão de ausência e mensagem personalizada para dias de feriado
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: businessConfig.enabled ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {businessConfig.enabled ? 'Expediente Ativo' : 'Expediente 24h'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!businessConfig.enabled}
                    onChange={e => setBusinessConfig({ ...businessConfig, enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: businessConfig.enabled ? 'var(--primary)' : 'var(--border-subtle)',
                    borderRadius: '24px', transition: '.3s'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: businessConfig.enabled ? '23px' : '3px',
                      bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              {/* 1. Ausência Fora de Horário */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      1. Mensagem de Ausência Padrão (Fora do Horário Comercial)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRestoreDefault('outOfOfficeTemplate', true)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RotateCcw size={12} /> Padrão
                    </button>
                  </div>

                  <textarea
                    value={businessConfig.outOfOfficeTemplate || ''}
                    onChange={e => setBusinessConfig({ ...businessConfig, outOfOfficeTemplate: e.target.value })}
                    className="input"
                    rows={4}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                  />

                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      Variáveis Dinâmicas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('outOfOfficeTemplate', tag, true)} />
                      <VariableBadge varName="telefone" description="Telefone" onInsert={tag => handleInsertVariable('outOfOfficeTemplate', tag, true)} />
                    </div>
                  </div>
                </div>

                <WhatsAppPreview 
                  text={businessConfig.outOfOfficeTemplate}
                  title="Ausência Fora de Horário"
                />
              </div>

              {/* 2. Feriado e Recesso */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      2. Mensagem Especial para Dias de Feriado / Recesso
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRestoreDefault('holidayTemplate', true)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RotateCcw size={12} /> Padrão
                    </button>
                  </div>

                  <textarea
                    value={businessConfig.holidayTemplate || ''}
                    onChange={e => setBusinessConfig({ ...businessConfig, holidayTemplate: e.target.value })}
                    className="input"
                    rows={4}
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem' }}
                  />

                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                      Variáveis Dinâmicas:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <VariableBadge varName="nome" description="Nome do cliente" onInsert={tag => handleInsertVariable('holidayTemplate', tag, true)} />
                      <VariableBadge varName="feriado" description="Nome do Feriado" onInsert={tag => handleInsertVariable('holidayTemplate', tag, true)} />
                      <VariableBadge varName="telefone" description="Telefone" onInsert={tag => handleInsertVariable('holidayTemplate', tag, true)} />
                    </div>
                  </div>
                </div>

                <WhatsAppPreview 
                  text={businessConfig.holidayTemplate}
                  title="Aviso Especial de Feriado"
                  variables={{ feriado: 'Feriado Nacional' }}
                />
              </div>

            </div>

            {/* Link para Configurações de Grade Horária */}
            <div style={{ marginTop: '20px', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} className="text-primary" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Para configurar a <b>grade de horários por dia da semana</b> e a lista de <b>datas de feriados</b> da empresa:
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'settings' }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Abrir Grade de Horários em Configurações <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={handleSaveHours}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.88rem' }}
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Mensagens de Expediente'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
