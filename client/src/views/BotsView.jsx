import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Play, 
  Square, 
  QrCode, 
  Plus, 
  Settings, 
  Trash2, 
  X,
  RefreshCw,
  Brain,
  FileText,
  Upload,
  MessageSquare,
  Terminal,
  Send,
  LogOut,
  Info,
  AlertCircle,
  Copy,
  Eye,
  ExternalLink,
  Loader2,
  Check,
  GitBranch,
  PhoneCall
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import CentralMenuBuilder from '../components/CentralAtendimento/CentralMenuBuilder';

export default function BotsView() {
  const [bots, setBots] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState(null);
  
  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [fileLoadError, setFileLoadError] = useState(null);
  const [copiedFileContent, setCopiedFileContent] = useState(false);

  // Estados de Edição / Gerenciamento do Bot (7 abas)
  const [editingBot, setEditingBot] = useState(null);
  const [editTab, setEditTab] = useState('general'); // 'general', 'ai', 'files', 'qrcode', 'qa', 'testchat', 'logs'
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    userId: '',
    model: 'gpt-3.5-turbo',
    maxTokens: 500,
    temperature: 0.7,
    systemPrompt: '',
    openaiApiKey: '',
    adminPhoneNumber: '',
    ignoreGroups: true,
    operationMode: 'standard',
    uploadedFiles: []
  });

  // Base de Conhecimento Q&A
  const [qaList, setQaList] = useState([]);
  const [newQA, setNewQA] = useState({ question: '', answer: '' });

  // Upload de Arquivos
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // Chat de Teste
  const [testChatMessages, setTestChatMessages] = useState([
    { sender: 'bot', text: 'Olá! Sou o simulador de IA deste robô. Digite qualquer pergunta para testar minhas respostas e regras de prompt.', time: new Date().toLocaleTimeString('pt-BR') }
  ]);
  const [testChatInput, setTestChatInput] = useState('');
  const [testChatLoading, setTestChatLoading] = useState(false);
  const testChatEndRef = useRef(null);

  // Logs em tempo real
  const [botLogs, setBotLogs] = useState([]);

  // Estados de QR Code
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrStatus, setQrStatus] = useState('Gerando QR Code...');

  // Formulário de Criação Rápida
  const [formData, setFormData] = useState({
    name: '',
    model: 'gpt-3.5-turbo',
    maxTokens: 500,
    temperature: 0.7,
    systemPrompt: 'Você é um assistente virtual inteligente e prestativo para atendimento ao cliente.'
  });

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await api.getBots();
      if (Array.isArray(data)) {
        setBots(data);
      }
    } catch (err) {
      console.error('Erro ao carregar bots:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  useEffect(() => {
    loadBots();
    loadUsers();

    // Ouvir atualizações de status de bots em tempo real via Socket
    const updateBotStatus = (data) => {
      if (!data?.botId) return;
      setBots(prev => prev.map(b => b.id === data.botId ? { ...b, status: data.status } : b));
      if (editingBot && editingBot.id === data.botId) {
        setEditingBot(prev => ({ ...prev, status: data.status }));
      }
    };

    // Ouvir logs em tempo real
    const handleBotLog = (data) => {
      if (!data) return;
      setBotLogs(prev => [
        ...prev.slice(-80),
        {
          botId: data.botId,
          text: data.message || JSON.stringify(data),
          type: data.type || 'info',
          time: data.time || new Date().toLocaleTimeString('pt-BR')
        }
      ]);
    };

    const cleanupStatus1 = socketService.on('bot_status_changed', updateBotStatus);
    const cleanupStatus2 = socketService.on('bot-status', updateBotStatus);
    const cleanupLog = socketService.on('botLog', handleBotLog);

    return () => {
      cleanupStatus1();
      cleanupStatus2();
      cleanupLog();
    };
  }, [editingBot]);

  useEffect(() => {
    if (testChatEndRef.current) {
      testChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [testChatMessages, testChatLoading]);

  // Carregar conteúdo de arquivo de texto quando visualizado
  useEffect(() => {
    if (!viewingFile) {
      setFileContent('');
      setLoadingFileContent(false);
      setFileLoadError(null);
      setCopiedFileContent(false);
      return;
    }

    const targetUrl = viewingFile.fileUrl || `/uploads/${viewingFile.fileName || viewingFile.name}`;
    const name = (viewingFile.name || viewingFile.fileName || '').toLowerCase();
    const isPdf = targetUrl.toLowerCase().endsWith('.pdf') || name.endsWith('.pdf');
    const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(targetUrl) || /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
    const isAudio = /\.(ogg|mp3|wav|m4a)$/i.test(targetUrl) || /\.(ogg|mp3|wav|m4a)$/i.test(name);
    const isVideo = /\.(mp4|webm|mov)$/i.test(targetUrl) || /\.(mp4|webm|mov)$/i.test(name);

    if (isPdf || isImage || isAudio || isVideo) {
      setLoadingFileContent(false);
      return;
    }

    // Se já tiver texto pré-extraído, usa diretamente
    if (viewingFile.extractedText && typeof viewingFile.extractedText === 'string') {
      setFileContent(viewingFile.extractedText);
      setLoadingFileContent(false);
      return;
    }

    // Buscar conteúdo de texto via fetch
    let isMounted = true;
    setLoadingFileContent(true);
    setFileLoadError(null);

    fetch(targetUrl)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Falha ao acessar o arquivo (${res.status} ${res.statusText})`);
        }
        return res.text();
      })
      .then((text) => {
        if (isMounted) {
          setFileContent(text);
          setLoadingFileContent(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Erro ao ler conteúdo do arquivo:', err);
          setFileLoadError(err.message || 'Erro ao carregar o conteúdo do arquivo.');
          setLoadingFileContent(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [viewingFile]);

  const handleCopyContent = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent).then(() => {
      setCopiedFileContent(true);
      setTimeout(() => setCopiedFileContent(false), 2000);
    }).catch(err => console.error('Erro ao copiar:', err));
  };

  const handleStartBot = async (botId) => {
    try {
      await api.startBot(botId);
      loadBots();
      if (editingBot && editingBot.id === botId) {
        setEditingBot(prev => ({ ...prev, status: 'connecting' }));
      }
    } catch (err) {
      alert(`Erro ao iniciar bot: ${err.message}`);
    }
  };

  const handleStopBot = async (botId) => {
    try {
      await api.stopBot(botId);
      setQrCodeData(null);
      setQrStatus('Conexão encerrada.');
      loadBots();
      if (editingBot && editingBot.id === botId) {
        setEditingBot(prev => ({ ...prev, status: 'stopped' }));
      }
    } catch (err) {
      alert(`Erro ao parar bot: ${err.message}`);
    }
  };

  const handleDisconnectBot = async (botId) => {
    const confirm = window.confirm('Deseja realmente desconectar a sessão do WhatsApp deste bot? Os dados de pareamento e os contatos do CRM vinculados a este bot serão desvinculados, sendo necessário escanear novo QR Code.');
    if (!confirm) return;
    try {
      await api.disconnectBot(botId);
      setQrCodeData(null);
      setQrStatus('Sessão desconectada.');
      loadBots();
      if (editingBot && editingBot.id === botId) {
        setEditingBot(prev => ({ ...prev, status: 'stopped' }));
      }
      alert('Bot desconectado, sessão limpa e contatos CRM desvinculados com sucesso.');
    } catch (err) {
      alert(`Erro ao desconectar: ${err.message}`);
    }
  };

  const handleOpenQR = async (bot) => {
    setSelectedBot(bot);
    setQrCodeData(null);
    setQrStatus('Iniciando conexão e aguardando QR Code...');
    setShowQRModal(true);

    try {
      await api.startBot(bot.id);

      const onQrReceived = (data) => {
        if (data.botId && data.botId !== bot.id) return;
        const code = data.qrCode || data.qr;
        if (code) {
          setQrCodeData(code);
          setQrStatus('Escaneie o QR Code abaixo com o seu WhatsApp');
        } else if (data.status === 'connected' || data.status === 'running') {
          setQrStatus('WhatsApp conectado com sucesso!');
          setTimeout(() => {
            setShowQRModal(false);
            loadBots();
          }, 1500);
        }
      };

      const unsubscribe1 = socketService.on(`qr_${bot.id}`, onQrReceived);
      const unsubscribe2 = socketService.on('qr-code', onQrReceived);

      const checkQR = async () => {
        try {
          const res = await api.getBotQR(bot.id);
          if (res?.qr) {
            setQrCodeData(res.qr);
            setQrStatus('Escaneie o QR Code com o seu WhatsApp');
          }
        } catch { }
      };
      checkQR();
      const interval = setInterval(checkQR, 2500);

      return () => {
        unsubscribe1();
        unsubscribe2();
        clearInterval(interval);
      };
    } catch (err) {
      setQrStatus(`Erro ao gerar QR Code: ${err.message}`);
    }
  };

  const handleResetBotQR = async (bot) => {
    setSelectedBot(bot);
    setQrCodeData(null);
    setQrStatus('Parando sessão antiga e gerando novo QR Code limpo...');
    setShowQRModal(true);

    try {
      await api.stopBot(bot.id).catch(() => {});
      await api.startBot(bot.id, true); // forceNewAuth = true!
      loadBots();

      const onQrReceived = (data) => {
        if (data.botId && data.botId !== bot.id) return;
        const code = data.qrCode || data.qr;
        if (code) {
          setQrCodeData(code);
          setQrStatus('Escaneie o QR Code abaixo com o seu WhatsApp');
        } else if (data.status === 'connected' || data.status === 'running') {
          setQrStatus('WhatsApp conectado com sucesso!');
          setTimeout(() => {
            setShowQRModal(false);
            loadBots();
          }, 1500);
        }
      };

      const unsubscribe1 = socketService.on(`qr_${bot.id}`, onQrReceived);
      const unsubscribe2 = socketService.on('qr-code', onQrReceived);

      const checkQR = async () => {
        try {
          const res = await api.getBotQR(bot.id);
          if (res?.qr) {
            setQrCodeData(res.qr);
            setQrStatus('Escaneie o QR Code com o seu WhatsApp');
          }
        } catch { }
      };
      setTimeout(checkQR, 800);
      const interval = setInterval(checkQR, 2500);

      return () => {
        unsubscribe1();
        unsubscribe2();
        clearInterval(interval);
      };
    } catch (err) {
      setQrStatus(`Erro ao gerar novo QR Code: ${err.message}`);
    }
  };

  const handleCreateBot = async (e) => {
    e.preventDefault();
    try {
      await api.createBot(formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        model: 'gpt-3.5-turbo',
        maxTokens: 500,
        temperature: 0.7,
        systemPrompt: 'Você é um assistente virtual inteligente e prestativo para atendimento ao cliente.'
      });
      loadBots();
      window.dispatchEvent(new Event('bots:updated'));
    } catch (err) {
      alert(`Erro ao criar bot: ${err.message}`);
    }
  };

  const handleOpenEdit = async (bot, initialTab = 'general') => {
    setSelectedBot(bot);
    setEditingBot(bot);
    setEditTab(initialTab);
    setLoadingEdit(true);
    setShowEditModal(true);

    try {
      const [fullBot, qas] = await Promise.all([
        api.getBot(bot.id),
        api.getBotQA(bot.id).catch(() => [])
      ]);

      if (fullBot) {
        setEditForm({
          name: fullBot.name || '',
          userId: fullBot.userId || '',
          model: fullBot.model || 'gpt-3.5-turbo',
          maxTokens: fullBot.maxTokens || 500,
          temperature: fullBot.temperature !== undefined ? fullBot.temperature : 0.7,
          systemPrompt: fullBot.systemPrompt || '',
          openaiApiKey: '',
          adminPhoneNumber: fullBot.adminPhoneNumber || '',
          ignoreGroups: fullBot.ignoreGroups !== undefined ? fullBot.ignoreGroups : true,
          operationMode: fullBot.operationMode || 'standard',
          uploadedFiles: Array.isArray(fullBot.uploadedFiles) ? fullBot.uploadedFiles : []
        });
      }
      setQaList(Array.isArray(qas) ? qas : []);
      
      // Checar QR code se estiver na aba de QR
      if (initialTab === 'qrcode') {
        const qrRes = await api.getBotQR(bot.id).catch(() => null);
        if (qrRes?.qr) setQrCodeData(qrRes.qr);
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes do bot:', err);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaveBotSettings = async (e) => {
    if (e) e.preventDefault();
    if (!editingBot) return;
    setSavingBot(true);
    try {
      await api.updateBot(editingBot.id, editForm);
      loadBots();
      alert('Configurações do bot salvas com sucesso!');
    } catch (err) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingBot(false);
    }
  };

  // Upload de Documentos para o Bot
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingBot) return;

    setUploadingFile(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('botId', editingBot.id);

    try {
      const res = await api.uploadFile(fd);
      const newDoc = {
        id: String(Date.now()),
        name: res.originalName || file.name,
        size: res.contentLength || file.size,
        fileUrl: res.fileUrl,
        extractedText: res.extractedText || '',
        uploadedAt: new Date().toISOString()
      };
      const updatedFiles = [...(editForm.uploadedFiles || []), newDoc];
      await api.updateBot(editingBot.id, { uploadedFiles: updatedFiles });
      setEditForm(prev => ({ ...prev, uploadedFiles: updatedFiles }));
      alert(`Arquivo "${file.name}" carregado e associado ao robô com sucesso!`);
    } catch (err) {
      alert(`Erro ao enviar arquivo: ${err.message}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!editingBot || !window.confirm('Excluir este documento da base de conhecimento do bot?')) return;
    try {
      const updatedFiles = (editForm.uploadedFiles || []).filter(f => f.id !== fileId);
      await api.updateBot(editingBot.id, { uploadedFiles: updatedFiles });
      setEditForm(prev => ({ ...prev, uploadedFiles: updatedFiles }));
    } catch (err) {
      alert(`Erro ao excluir arquivo: ${err.message}`);
    }
  };

  // Q&A
  const handleAddQA = async (e) => {
    if (e) e.preventDefault();
    if (!newQA.question.trim() || !newQA.answer.trim() || !editingBot) return;
    try {
      const added = await api.addBotQA(editingBot.id, newQA);
      setQaList(prev => [...prev, added]);
      setNewQA({ question: '', answer: '' });
    } catch (err) {
      alert(`Erro ao cadastrar Q&A: ${err.message}`);
    }
  };

  const handleDeleteQA = async (qaId) => {
    if (!editingBot || !window.confirm('Excluir esta pergunta e resposta?')) return;
    try {
      await api.deleteBotQA(editingBot.id, qaId);
      setQaList(prev => prev.filter(q => q.id !== qaId));
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Chat de Teste
  const handleSendTestMessage = async (e) => {
    if (e) e.preventDefault();
    if (!testChatInput.trim() || testChatLoading || !editingBot) return;

    const userMessage = testChatInput.trim();
    setTestChatInput('');
    setTestChatMessages(prev => [
      ...prev,
      { sender: 'user', text: userMessage, time: new Date().toLocaleTimeString('pt-BR') }
    ]);
    setTestChatLoading(true);

    try {
      const res = await api.testBot(editingBot.id, userMessage);
      const botResponse = res?.response || res?.message || 'Sem resposta gerada pelo modelo.';
      setTestChatMessages(prev => [
        ...prev,
        { sender: 'bot', text: botResponse, time: new Date().toLocaleTimeString('pt-BR') }
      ]);
    } catch (err) {
      setTestChatMessages(prev => [
        ...prev,
        { sender: 'bot', text: `❌ Falha ao processar teste: ${err.message}`, time: new Date().toLocaleTimeString('pt-BR') }
      ]);
    } finally {
      setTestChatLoading(false);
    }
  };

  const handleDeleteBot = async (botId) => {
    if (!window.confirm('Tem certeza que deseja remover este bot? Esta ação não pode ser desfeita.')) return;
    try {
      await api.deleteBot(botId);
      setShowEditModal(false);
      loadBots();
      window.dispatchEvent(new Event('bots:updated'));
    } catch (err) {
      alert(`Erro ao deletar bot: ${err.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredLogs = botLogs.filter(log => !editingBot || log.botId === editingBot.id);

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Gerenciamento de Bots WhatsApp
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Conecte números de WhatsApp, configure instâncias, documentos de treino (RAG), Q&A e simulador
          </p>
        </div>

        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Novo Bot
        </button>
      </div>

      {/* Grid de Bots */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: '12px' }}>
          <Loader2 className="animate-spin" size={24} color="var(--primary)" />
          <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Carregando seus chatbots...</span>
        </div>
      ) : bots.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-subtle)' }}>
          <Bot size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Nenhum robô cadastrado ainda</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Crie o seu primeiro bot do WhatsApp para começar a atender clientes automaticamente com IA.</p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Criar Meu Primeiro Bot
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {bots.map(bot => {
            const isRunning = bot.status === 'running' || bot.status === 'ativo';
            const isConnecting = bot.status === 'connecting' || bot.status === 'starting';

            return (
            <div
              key={bot.id}
              className="glass-panel animate-fade-in"
              style={{
                borderRadius: '16px',
                padding: '24px',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {/* Header do Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div 
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: isRunning ? 'var(--primary-subtle)' : isConnecting ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                      color: isRunning ? 'var(--primary)' : isConnecting ? '#f59e0b' : '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isRunning ? '0 0 12px var(--primary-glow)' : 'none'
                    }}
                  >
                    <Bot size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {bot.name}
                      {bot.companyName && (
                        <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 600 }}>
                          {bot.companyName}
                        </span>
                      )}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ID: {bot.id}
                    </span>
                  </div>
                </div>

                {isRunning ? (
                  <span className="badge-status online">● Ativo</span>
                ) : isConnecting ? (
                  <span className="badge-status waiting" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <RefreshCw size={11} className="animate-spin" /> Conectando
                  </span>
                ) : (
                  <span className="badge-status finished">● Parado</span>
                )}
              </div>

              {/* Informações */}
              <div 
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.82rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Modelo IA:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{bot.model || 'gpt-3.5-turbo'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Modo de Operação:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{bot.operationMode === 'assistant' ? 'Assistants API' : 'Padrão (Prompt)'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Atendente / Transbordo:</span>
                  <strong style={{ color: bot.adminPhoneNumber ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {bot.adminPhoneNumber || 'Não configurado'}
                  </strong>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                {/* 1. Botão Principal de Conexão */}
                <button
                  onClick={() => handleOpenQR(bot)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
                >
                  <QrCode size={16} /> {isConnecting ? 'Ver QR Code' : 'Conectar WhatsApp'}
                </button>

                {/* 2. Ações Secundárias em 2 colunas equilibradas (50% / 50%) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => handleOpenEdit(bot, 'flow')}
                    className="btn btn-secondary"
                    style={{ padding: '8px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                    title="Central de Atendimento & Menus (URA)"
                  >
                    <PhoneCall size={15} /> Central / URA
                  </button>

                  <button
                    onClick={() => handleOpenEdit(bot, 'general')}
                    className="btn btn-secondary"
                    style={{ padding: '8px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    title="Configurações completas do Bot"
                  >
                    <Settings size={15} /> Configurações
                  </button>
                </div>

                {/* 3. Controles Rápidos em 3 colunas (33% cada) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {isRunning || isConnecting ? (
                    <button
                      onClick={() => handleStopBot(bot.id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 2px', fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      title="Parar e liberar conexão do robô"
                    >
                      <Square size={13} /> Parar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartBot(bot.id)}
                      className="btn btn-ghost"
                      style={{ padding: '6px 2px', fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                    >
                      <Play size={13} /> Iniciar
                    </button>
                  )}

                  <button
                    onClick={() => handleResetBotQR(bot)}
                    className="btn btn-ghost"
                    style={{ padding: '6px 2px', fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                    title="Reiniciar sessão e gerar novo QR Code limpo"
                  >
                    <RefreshCw size={13} /> Novo QR
                  </button>

                  <button
                    onClick={() => handleOpenEdit(bot, 'testchat')}
                    className="btn btn-ghost"
                    style={{ padding: '6px 2px', fontSize: '0.75rem', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                    title="Testar respostas da IA"
                  >
                    <MessageSquare size={13} /> Testar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* MODAL 1: CRIAR NOVO BOT */}
      {showCreateModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div className="modal-content animate-scale-up" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Criar Novo Bot
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nome do Bot
                </label>
                <input
                  type="text"
                  placeholder="Ex: Atendente Comercial"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Modelo de Inteligência Artificial
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Instruções Iniciais (Prompt)
                </label>
                <textarea
                  rows={4}
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QR CODE RÁPIDO */}
      {showQRModal && selectedBot && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowQRModal(false); }}>
          <div className="modal-content animate-scale-up" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Conectar: {selectedBot.name}
              </h3>
              <button onClick={() => setShowQRModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {qrStatus}
            </p>

            <div 
              style={{
                width: '260px',
                height: '260px',
                margin: '0 auto 20px auto',
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              {qrCodeData ? (
                <img 
                  src={qrCodeData} 
                  alt="QR Code" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={32} className="animate-spin" color="var(--primary)" />
                  <span style={{ fontSize: '0.82rem' }}>Aguardando instância...</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleResetBotQR(selectedBot)} 
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}
                title="Para conexão e gera QR novo"
              >
                <RefreshCw size={14} /> Gerar Novo QR
              </button>

              <button 
                onClick={async () => {
                  await handleStopBot(selectedBot.id);
                  setShowQRModal(false);
                }} 
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
                title="Parar e cancelar tentativa de conexão"
              >
                <Square size={14} /> Parar Conexão
              </button>

              <button 
                onClick={() => setShowQRModal(false)} 
                className="btn btn-primary"
                style={{ fontSize: '0.82rem' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: GERENCIAMENTO COMPLETO DO BOT (7 ABAS LEGADAS RESTAURADAS) */}
      {showEditModal && editingBot && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div 
            className="modal-content animate-scale-up" 
            style={{ 
              maxWidth: editTab === 'flow' ? '1360px' : '920px', 
              width: '96vw', 
              height: editTab === 'flow' ? '92vh' : '88vh', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: 0, 
              overflow: 'hidden',
              borderRadius: '20px',
              transition: 'max-width 0.25s ease, height 0.25s ease'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {editingBot.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>ID: {editingBot.id}</span>
                    <span>•</span>
                    <span style={{ color: editingBot.status === 'running' || editingBot.status === 'ativo' ? '#10b981' : '#9ca3af', fontWeight: 600 }}>
                      ● {editingBot.status === 'running' || editingBot.status === 'ativo' ? 'Ativo / Em execução' : 'Parado'}
                    </span>
                  </div>
                </div>
              </div>

              <button onClick={() => setShowEditModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs (8 Abas) */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-tertiary)', overflowX: 'auto', padding: '0 8px', scrollbarWidth: 'none' }}>
              {[
                { id: 'general', label: 'Geral', icon: Info },
                { id: 'flow', label: 'Central de Atendimento (URA)', icon: PhoneCall },
                { id: 'ai', label: 'Configurações & IA', icon: Brain },
                { id: 'files', label: `Arquivos RAG (${editForm.uploadedFiles?.length || 0})`, icon: FileText },
                { id: 'qrcode', label: 'QR Code', icon: QrCode },
                { id: 'qa', label: `Perg & Resp (${qaList.length})`, icon: MessageSquare },
                { id: 'testchat', label: 'Chat de Teste', icon: Send },
                { id: 'logs', label: 'Logs', icon: Terminal }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = editTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '12px 10px',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 700 : 500,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={15} /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Body / Tab Content */}
            <div style={{ padding: editTab === 'flow' ? 0 : '24px 28px', overflowY: editTab === 'flow' ? 'hidden' : 'auto', flex: 1, backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
              {loadingEdit ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={28} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
                  <div>Carregando parâmetros do bot...</div>
                </div>
              ) : (
                <>
                  {/* TAB: CENTRAL DE ATENDIMENTO & MENUS (URA) */}
                  {editTab === 'flow' && (
                    <div style={{ flex: 1, height: '100%', width: '100%', minHeight: 0 }}>
                      <CentralMenuBuilder
                        bot={editingBot}
                        onUpdateBot={(updated) => {
                          setEditingBot(updated);
                          setBots(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
                        }}
                      />
                    </div>
                  )}

                  {/* TAB 1: GERAL (VISÃO GERAL & AÇÕES DIRETAS) */}
                  {editTab === 'general' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="card" style={{ padding: '22px' }}>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Info size={18} className="text-primary" /> Informações do Bot
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nome do Robô:</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>{editForm.name || editingBot.name}</div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status de Execução:</div>
                            {editingBot.status === 'running' || editingBot.status === 'ativo' ? (
                              <span className="badge-status online">● Ativo / Em execução</span>
                            ) : editingBot.status === 'connecting' || editingBot.status === 'starting' ? (
                              <span className="badge-status waiting" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <RefreshCw size={12} className="animate-spin" /> Conectando / Aguardando QR
                              </span>
                            ) : (
                              <span className="badge-status finished">● Inativo / Parado</span>
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Modelo de Linguagem:</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>{editForm.model}</div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Modo de Operação:</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {editForm.operationMode === 'assistant' ? 'OpenAI Assistants API' : 'Padrão (Prompt + RAG)'}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Número para Transbordo:</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: editForm.adminPhoneNumber ? 'var(--primary)' : 'var(--text-muted)' }}>
                              {editForm.adminPhoneNumber || 'Não configurado'}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Operador Vinculado:</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {users.find(u => u.id === editForm.userId)?.name || users.find(u => u.id === editForm.userId)?.email || 'Operador Padrão'}
                            </div>
                          </div>
                        </div>

                        {/* Alerta Informativo */}
                        <div style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <Info size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong>Importante:</strong> Se um número de transbordo estiver configurado, as solicitações de atendimento humano poderão ser direcionadas para ele.
                          </div>
                        </div>
                      </div>

                      {/* Controles de Execução */}
                      <div className="card" style={{ padding: '22px' }}>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
                          Ações de Controle da Instância
                        </h4>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {editingBot.status === 'running' || editingBot.status === 'ativo' || editingBot.status === 'connecting' || editingBot.status === 'starting' ? (
                            <button
                              onClick={() => handleStopBot(editingBot.id)}
                              className="btn btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}
                              title="Parar instância e liberar conexão"
                            >
                              <Square size={16} /> Parar Conexão
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartBot(editingBot.id)}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <Play size={16} /> Iniciar Bot
                            </button>
                          )}

                          <button
                            onClick={() => handleResetBotQR(editingBot)}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}
                            title="Reiniciar sessão e gerar um QR Code novo"
                          >
                            <RefreshCw size={16} /> Forçar Novo QR Code
                          </button>

                          <button
                            onClick={() => handleDisconnectBot(editingBot.id)}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            title="Apagar sessão salva e desconectar aparelho"
                          >
                            <LogOut size={16} /> Desconectar Sessão
                          </button>

                          <button
                            onClick={() => handleDeleteBot(editingBot.id)}
                            className="btn btn-ghost"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginLeft: 'auto' }}
                          >
                            <Trash2 size={16} /> Excluir Bot
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CONFIGURAÇÕES & IA */}
                  {editTab === 'ai' && (
                    <form id="bot-edit-form" onSubmit={handleSaveBotSettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {/* Básicos */}
                      <div className="card" style={{ padding: '20px' }}>
                        <h5 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-main)' }}>
                          Informações Básicas
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Nome do Bot *
                            </label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              required
                              style={{ width: '100%' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Usuário Responsável
                            </label>
                            <select
                              value={editForm.userId || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, userId: e.target.value }))}
                              style={{ width: '100%' }}
                            >
                              <option value="">Nenhum (Visível a todos)</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name || u.email} ({u.role || 'operador'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Parâmetros IA */}
                      <div className="card" style={{ padding: '20px' }}>
                        <h5 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-main)' }}>
                          Parâmetros de Inteligência Artificial
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Modelo OpenAI
                            </label>
                            <select
                              value={editForm.model}
                              onChange={(e) => setEditForm(prev => ({ ...prev, model: e.target.value }))}
                              style={{ width: '100%' }}
                            >
                              <option value="gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
                              <option value="gpt-4o">GPT-4o (Mais Completo & Potente)</option>
                              <option value="gpt-4-turbo">GPT-4 Turbo</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Econômico)</option>
                              <option value="gpt-4">GPT-4 Clássico</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Max Tokens por Resposta ({editForm.maxTokens})
                            </label>
                            <input
                              type="number"
                              min="50"
                              max="4000"
                              value={editForm.maxTokens}
                              onChange={(e) => setEditForm(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 500 }))}
                              style={{ width: '100%' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Temperatura / Criatividade ({editForm.temperature})
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={editForm.temperature}
                              onChange={(e) => setEditForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                              style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              <span>0.0 (Mais exato)</span>
                              <span>1.0 (Mais criativo)</span>
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Modo de Operação
                            </label>
                            <select
                              value={editForm.operationMode}
                              onChange={(e) => setEditForm(prev => ({ ...prev, operationMode: e.target.value }))}
                              style={{ width: '100%' }}
                            >
                              <option value="standard">Padrão (Prompt + Base Q&A + RAG)</option>
                              <option value="assistant">Assistants API (OpenAI Threads)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Chave OpenAI Customizada (Opcional)
                          </label>
                          <input
                            type="password"
                            placeholder="Deixe em branco para usar a Chave Global das Configurações"
                            value={editForm.openaiApiKey}
                            onChange={(e) => setEditForm(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                            style={{ width: '100%', fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>

                      {/* Segurança & WhatsApp */}
                      <div className="card" style={{ padding: '20px' }}>
                        <h5 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-main)' }}>
                          Segurança e WhatsApp
                        </h5>

                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            Número do Atendente (Transbordo Humano)
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="Ex: 5527999999999 (com DDI e DDD)"
                              value={editForm.adminPhoneNumber || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, adminPhoneNumber: e.target.value }))}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (editingBot.adminPhoneNumber) {
                                  setEditForm(prev => ({ ...prev, adminPhoneNumber: editingBot.adminPhoneNumber }));
                                }
                              }}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            >
                              <Copy size={14} /> Usar número do bot
                            </button>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Este número receberá as solicitações de transbordo humano de conversas.
                          </span>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-main)', padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
                          <div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              Ignorar Mensagens de Grupos
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Impede que o robô responda mensagens recebidas em grupos do WhatsApp
                            </div>
                          </div>
                          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={!!editForm.ignoreGroups}
                              onChange={e => setEditForm(prev => ({ ...prev, ignoreGroups: e.target.checked }))}
                              style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                              backgroundColor: editForm.ignoreGroups ? 'var(--primary)' : 'var(--border-subtle)',
                              borderRadius: '24px', transition: '.3s'
                            }}>
                              <span style={{
                                position: 'absolute', content: '""', height: '18px', width: '18px', left: editForm.ignoreGroups ? '23px' : '3px',
                                bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                              }} />
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Prompt do Sistema */}
                      <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                            Prompt do Sistema (Instruções da IA)
                          </h5>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {editForm.systemPrompt?.length || 0} caracteres
                          </span>
                        </div>
                        <textarea
                          rows={7}
                          value={editForm.systemPrompt}
                          onChange={(e) => setEditForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                          placeholder="Você é o assistente virtual da Zeplyn. Responda de forma cordial e prestativa..."
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      </div>
                    </form>
                  )}

                  {/* TAB 3: ARQUIVOS RAG / TREINAMENTO */}
                  {editTab === 'files' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="card" style={{ padding: '22px' }}>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                          Base de Treinamento RAG (Documentos)
                        </h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '18px' }}>
                          Envie arquivos em formato PDF, TXT ou DOCX para o robô aprender regras de negócio, tabelas de preços e manuais específicos.
                        </p>

                        {/* Upload Drop Area */}
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            border: '2px dashed var(--border-subtle)',
                            borderRadius: '14px',
                            padding: '30px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: 'var(--bg-main)',
                            transition: 'border-color 0.2s',
                            marginBottom: '20px'
                          }}
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            accept=".pdf,.txt,.docx,.doc" 
                            style={{ display: 'none' }} 
                          />
                          <Upload size={32} className="text-primary" style={{ margin: '0 auto 10px auto' }} />
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {uploadingFile ? 'Enviando e processando documento...' : 'Clique ou arraste arquivos PDF ou TXT aqui'}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Suporta documentos com até 20MB
                          </span>
                        </div>

                        {/* Lista de Documentos */}
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
                          Documentos Ativos na IA ({editForm.uploadedFiles?.length || 0})
                        </div>

                        {!editForm.uploadedFiles || editForm.uploadedFiles.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            Nenhum arquivo anexado a este robô ainda. Faça o upload acima para enriquecer as respostas.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {editForm.uploadedFiles.map(file => (
                              <div 
                                key={file.id} 
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  borderRadius: '10px',
                                  backgroundColor: 'var(--bg-main)',
                                  border: '1px solid var(--border-subtle)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <FileText size={20} className="text-primary" />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                                      {file.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      {formatFileSize(file.size)} • Enviado em {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('pt-BR') : 'Hoje'}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600 }}>
                                    ✓ Treinado
                                  </span>
                                  <button
                                    onClick={() => setViewingFile(file)}
                                    className="btn btn-secondary"
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '0.75rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      borderRadius: '6px'
                                    }}
                                    title="Visualizar documento / PDF"
                                  >
                                    <Eye size={13} /> Visualizar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="btn-icon"
                                    style={{ color: '#ef4444' }}
                                    title="Remover documento"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: QR CODE */}
                  {editTab === 'qrcode' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' }}>
                      <div className="card" style={{ padding: '30px', maxWidth: '500px', width: '100%' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                          Conectar WhatsApp do Bot
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                          Abra o WhatsApp no celular, vá em <strong>Aparelhos conectados &gt; Conectar um aparelho</strong> e aponte para a tela.
                        </p>

                        <div 
                          style={{
                            width: '260px',
                            height: '260px',
                            margin: '0 auto 20px auto',
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          {qrCodeData ? (
                            <img src={qrCodeData} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              {editingBot.status === 'running' || editingBot.status === 'ativo' ? 'Aguardando QR Code...' : 'Inicie o bot para gerar o QR Code'}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <button
                            onClick={() => handleOpenQR(editingBot)}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                          >
                            <RefreshCw size={14} /> Atualizar QR Code
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: PERGUNTAS E RESPOSTAS (Q&A) */}
                  {editTab === 'qa' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Form Nova Pergunta */}
                      <div className="card" style={{ padding: '20px' }}>
                        <h5 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
                          ➕ Adicionar Pergunta & Resposta Frequente
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <input
                            type="text"
                            placeholder="Pergunta do cliente (ex: Qual o horário de atendimento?)"
                            value={newQA.question}
                            onChange={(e) => setNewQA(prev => ({ ...prev, question: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                          <textarea
                            rows={3}
                            placeholder="Resposta precisa que o bot deve fornecer de imediato..."
                            value={newQA.answer}
                            onChange={(e) => setNewQA(prev => ({ ...prev, answer: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                          <button
                            type="button"
                            onClick={handleAddQA}
                            className="btn btn-primary"
                            style={{ alignSelf: 'flex-end', padding: '7px 18px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            disabled={!newQA.question.trim() || !newQA.answer.trim()}
                          >
                            <Plus size={14} /> Salvar Q&A
                          </button>
                        </div>
                      </div>

                      {/* Lista de Q&A */}
                      <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
                          Perguntas Cadastradas ({qaList.length})
                        </div>

                        {qaList.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            Nenhuma pergunta cadastrada. Cadastre respostas padrão acima para o bot responder sem consumir tokens da OpenAI.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {qaList.map(qa => (
                              <div
                                key={qa.id}
                                style={{
                                  padding: '14px',
                                  borderRadius: '10px',
                                  backgroundColor: 'var(--bg-main)',
                                  border: '1px solid var(--border-subtle)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem', marginBottom: '4px' }}>
                                    P: {qa.question}
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                                    R: {qa.answer}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQA(qa.id)}
                                  className="btn-icon"
                                  style={{ color: '#ef4444' }}
                                  title="Excluir pergunta"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: CHAT DE TESTE (SIMULADOR DE IA) */}
                  {editTab === 'testchat' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '440px' }}>
                      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                            Simulador Interativo de IA
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Teste as regras do prompt, base Q&A e arquivos RAG em tempo real sem precisar de celular
                          </span>
                        </div>
                        <button
                          onClick={() => setTestChatMessages([
                            { sender: 'bot', text: 'Chat reiniciado. Digite uma mensagem para testar a IA.', time: new Date().toLocaleTimeString('pt-BR') }
                          ])}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem' }}
                        >
                          Limpar Histórico
                        </button>
                      </div>

                      {/* Mensagens do Simulador */}
                      <div 
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '16px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          marginBottom: '14px'
                        }}
                      >
                        {testChatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                              alignItems: 'flex-end',
                              gap: '8px'
                            }}
                          >
                            {msg.sender === 'bot' && (
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Bot size={16} />
                              </div>
                            )}

                            <div
                              style={{
                                maxWidth: '75%',
                                padding: '10px 14px',
                                borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                backgroundColor: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: msg.sender === 'user' ? '#ffffff' : 'var(--text-main)',
                                fontSize: '0.86rem',
                                boxShadow: 'var(--shadow-sm)',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              <div>{msg.text}</div>
                              <span style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '4px', display: 'block', textAlign: 'right' }}>
                                {msg.time}
                              </span>
                            </div>
                          </div>
                        ))}

                        {testChatLoading && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            <RefreshCw size={14} className="animate-spin" color="var(--primary)" />
                            <span>O robô está digitando a resposta...</span>
                          </div>
                        )}
                        <div ref={testChatEndRef} />
                      </div>

                      {/* Input do Simulador */}
                      <form onSubmit={handleSendTestMessage} style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          placeholder="Digite uma mensagem para testar o robô..."
                          value={testChatInput}
                          onChange={(e) => setTestChatInput(e.target.value)}
                          disabled={testChatLoading}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="submit"
                          disabled={testChatLoading || !testChatInput.trim()}
                          className="btn btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Send size={16} /> Enviar
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 7: LOGS DO BOT */}
                  {editTab === 'logs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '440px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                            Console de Logs em Tempo Real
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Monitoramento de eventos, chamadas de IA e mensagens recebidas
                          </span>
                        </div>
                        <button onClick={() => setBotLogs([])} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>
                          Limpar Logs
                        </button>
                      </div>

                      <div
                        style={{
                          flex: 1,
                          backgroundColor: '#0f172a',
                          color: '#38bdf8',
                          fontFamily: 'Consolas, Monaco, monospace',
                          fontSize: '0.8rem',
                          borderRadius: '12px',
                          padding: '16px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ color: '#94a3b8' }}>
                          [Sistema] Conectado ao console de monitoramento do bot {editingBot.id}.
                        </div>
                        {filteredLogs.length === 0 ? (
                          <div style={{ color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                            Nenhum log registrado para este bot ainda. Envie uma mensagem no WhatsApp ou no Chat de Teste.
                          </div>
                        ) : (
                          filteredLogs.map((log, idx) => (
                            <div key={idx} style={{ color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#4ade80' : log.type === 'warning' ? '#fbbf24' : '#38bdf8' }}>
                              <span style={{ color: '#64748b' }}>[{log.time}]</span> {log.text}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            {editTab !== 'flow' && (
              <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Fechar
                </button>

                {editTab === 'ai' && (
                  <button
                    type="submit"
                    form="bot-edit-form"
                    className="btn btn-primary"
                    disabled={savingBot}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {savingBot ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Salvando...
                      </>
                    ) : (
                      'Salvar Configurações'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE PDF / DOCUMENTO */}
      {viewingFile && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10050,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '960px',
              height: '88vh',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header da Modal de PDF */}
            <div 
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                {(() => {
                  const targetUrl = viewingFile.fileUrl || `/uploads/${viewingFile.fileName || viewingFile.name}`;
                  const name = (viewingFile.name || viewingFile.fileName || '').toLowerCase();
                  const isPdf = targetUrl.toLowerCase().endsWith('.pdf') || name.endsWith('.pdf');
                  return (
                    <div 
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: isPdf ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: isPdf ? '#ef4444' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <FileText size={20} />
                    </div>
                  );
                })()}
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {viewingFile.name || 'Visualizador de Documento'}
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Base de conhecimento IA • {viewingFile.size ? formatFileSize(viewingFile.size) : 'Documento anexado'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={viewingFile.fileUrl || `/uploads/${viewingFile.fileName || viewingFile.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                  title="Abrir em nova aba do navegador"
                >
                  <ExternalLink size={14} /> Nova Aba
                </a>
                <button 
                  onClick={() => setViewingFile(null)} 
                  className="btn-icon" 
                  style={{ width: '32px', height: '32px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sub-barra de ferramentas se for texto */}
            {(() => {
              const targetUrl = viewingFile.fileUrl || `/uploads/${viewingFile.fileName || viewingFile.name}`;
              const name = (viewingFile.name || viewingFile.fileName || '').toLowerCase();
              const isPdf = targetUrl.toLowerCase().endsWith('.pdf') || name.endsWith('.pdf');
              const isMedia = /\.(png|jpe?g|gif|webp|svg|ogg|mp3|wav|m4a|mp4|webm|mov)$/i.test(targetUrl) || /\.(png|jpe?g|gif|webp|svg|ogg|mp3|wav|m4a|mp4|webm|mov)$/i.test(name);

              if (isPdf || isMedia || loadingFileContent || fileLoadError) return null;

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 20px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.75rem',
                    color: '#94a3b8'
                  }}
                >
                  <span>
                    {fileContent ? `${fileContent.split('\n').length} linhas • ${fileContent.length} caracteres` : 'Arquivo de texto'}
                  </span>
                  <button
                    onClick={handleCopyContent}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: '6px'
                    }}
                    title="Copiar texto para área de transferência"
                  >
                    {copiedFileContent ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    {copiedFileContent ? 'Copiado!' : 'Copiar Conteúdo'}
                  </button>
                </div>
              );
            })()}

            {/* Conteúdo do Visualizador */}
            <div style={{ flex: 1, backgroundColor: '#090d16', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {(() => {
                const targetUrl = viewingFile.fileUrl || `/uploads/${viewingFile.fileName || viewingFile.name}`;
                const name = (viewingFile.name || viewingFile.fileName || '').toLowerCase();
                const isPdf = targetUrl.toLowerCase().endsWith('.pdf') || name.endsWith('.pdf');
                const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(targetUrl) || /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
                const isAudio = /\.(ogg|mp3|wav|m4a)$/i.test(targetUrl) || /\.(ogg|mp3|wav|m4a)$/i.test(name);
                const isVideo = /\.(mp4|webm|mov)$/i.test(targetUrl) || /\.(mp4|webm|mov)$/i.test(name);

                if (isPdf) {
                  return (
                    <iframe
                      src={targetUrl}
                      title={viewingFile.name}
                      style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
                    />
                  );
                }

                if (isImage) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px' }}>
                      <img
                        src={targetUrl}
                        alt={viewingFile.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                      />
                    </div>
                  );
                }

                if (isAudio) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '24px' }}>
                      <audio controls src={targetUrl} style={{ width: '100%', maxWidth: '450px' }} />
                    </div>
                  );
                }

                if (isVideo) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px' }}>
                      <video controls src={targetUrl} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }} />
                    </div>
                  );
                }

                if (loadingFileContent) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', color: '#94a3b8' }}>
                      <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Carregando conteúdo do arquivo...
                      </span>
                    </div>
                  );
                }

                if (fileLoadError) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '30px', textAlign: 'center' }}>
                      <AlertCircle size={40} style={{ color: '#ef4444' }} />
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f87171', marginBottom: '4px' }}>
                          {fileLoadError}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          O arquivo pode ter sido removido ou está inacessível.
                        </div>
                      </div>
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                      >
                        <ExternalLink size={13} /> Abrir diretamente no navegador
                      </a>
                    </div>
                  );
                }

                return (
                  <pre 
                    style={{ 
                      margin: 0, 
                      padding: '24px', 
                      overflowY: 'auto', 
                      height: '100%', 
                      color: '#e2e8f0', 
                      fontSize: '0.86rem', 
                      lineHeight: '1.6', 
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      userSelect: 'text'
                    }}
                  >
                    {fileContent || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Arquivo vazio (0 bytes).</span>}
                  </pre>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
