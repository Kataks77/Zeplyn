import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  MessageSquare, 
  RefreshCw, 
  Plus, 
  Upload, 
  Download, 
  Trash2, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Bot, 
  Phone, 
  X,
  Users
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';

export default function ContactsView({ onOpenChat }) {
  const { selectedBotId } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [bots, setBots] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBotFilter, setSelectedBotFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  // Modais & Ações
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Form Novo Contato
  const [createForm, setCreateForm] = useState({
    name: '',
    phoneNumber: '',
    botId: ''
  });
  const [creatingContact, setCreatingContact] = useState(false);

  // Form Importação em Lote
  const [importTargetBotId, setImportTargetBotId] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [contactsData, botsData] = await Promise.all([
        api.getContacts(),
        api.getBots().catch(() => [])
      ]);

      const botList = Array.isArray(botsData) ? botsData : (botsData?.bots || []);
      setBots(botList);

      const contactList = Array.isArray(contactsData) 
        ? contactsData 
        : (contactsData?.contacts || []);
      setContacts(contactList);

      if (botList.length > 0 && !createForm.botId) {
        setCreateForm(prev => ({ ...prev, botId: botList[0].id }));
        setImportTargetBotId(botList[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
      showToast('error', 'Falha ao sincronizar lista de contatos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const cleanupCleared = socketService.on('contacts-cleared', (data) => {
      if (!selectedBotId || selectedBotId === 'all' || selectedBotId === data?.botId) {
        loadData();
      }
    });

    const cleanupUpdated = socketService.on('contacts-updated', (data) => {
      if (!selectedBotId || selectedBotId === 'all' || selectedBotId === data?.botId) {
        loadData();
      }
    });

    return () => {
      cleanupCleared();
      cleanupUpdated();
    };
  }, [selectedBotId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBotFilter]);

  // Filtros combinados
  const filtered = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = 
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phoneNumber || '').includes(search) ||
        (c.jid || '').includes(search);

      const matchesBot = 
        selectedBotFilter === 'all' || 
        c.botId === selectedBotFilter;

      return matchesSearch && matchesBot;
    });
  }, [contacts, search, selectedBotFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleOpenContactChat = (contact) => {
    if (!onOpenChat || !contact) return;
    const cleanNumber = (contact.phoneNumber || contact.jid?.split('@')[0] || '').replace(/\D/g, '');
    const jid = contact.jid || (cleanNumber ? `${cleanNumber}@s.whatsapp.net` : null);

    onOpenChat({
      id: contact.id,
      botId: contact.botId || (selectedBotId !== 'all' ? selectedBotId : null),
      contactJid: jid,
      contactName: contact.name || (cleanNumber ? `Contato ${cleanNumber}` : 'Cliente'),
      phoneNumber: contact.phoneNumber || cleanNumber,
      profilePicUrl: contact.profilePicUrl
    });
  };

  // Salvar Novo Contato
  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.phoneNumber.trim()) {
      showToast('error', 'Informe o nome e o número de WhatsApp.');
      return;
    }

    const targetBot = createForm.botId || (bots[0]?.id);
    if (!targetBot) {
      showToast('error', 'É necessário ter ao menos um robô WhatsApp configurado.');
      return;
    }

    try {
      setCreatingContact(true);
      await api.createContact({
        botId: targetBot,
        name: createForm.name.trim(),
        phoneNumber: createForm.phoneNumber.trim()
      });

      showToast('success', `Contato "${createForm.name}" cadastrado com sucesso!`);
      setShowCreateModal(false);
      setCreateForm(prev => ({ ...prev, name: '', phoneNumber: '' }));
      loadData();
    } catch (err) {
      showToast('error', err.message || 'Erro ao cadastrar contato.');
    } finally {
      setCreatingContact(false);
    }
  };

  // Sincronizar dos Atendimentos Existentes
  const handleSyncFromChats = async () => {
    const targetBot = (selectedBotId !== 'all' && selectedBotId) || (bots[0]?.id);
    if (!targetBot) {
      showToast('error', 'Selecione um robô para sincronizar os contatos.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.syncContactsFromChats(targetBot);
      showToast('success', `Sincronização concluída! ${res?.count || 0} contatos novos importados dos atendimentos.`);
      loadData();
    } catch (err) {
      showToast('error', err.message || 'Erro ao sincronizar contatos dos atendimentos.');
      setLoading(false);
    }
  };

  // Excluir Contato
  const handleDeleteContact = async (contact) => {
    if (!window.confirm(`Deseja realmente excluir o contato "${contact.name || contact.phoneNumber}" da sua agenda?`)) {
      return;
    }

    try {
      await api.deleteContact({
        botId: contact.botId,
        id: contact.id
      });
      showToast('success', 'Contato excluído com sucesso.');
      setContacts(prev => prev.filter(c => c.id !== contact.id));
    } catch (err) {
      showToast('error', err.message || 'Erro ao excluir contato.');
    }
  };

  // Processar Importação em Lote
  const parseImportText = () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];

    for (const line of lines) {
      // Formatos suportados: "Nome, Telefone" ou "Nome; Telefone" ou apenas "Telefone"
      if (line.includes(',') || line.includes(';')) {
        const parts = line.split(/[,;]/);
        const name = parts[0]?.trim();
        const phone = parts.slice(1).join('').replace(/\D/g, '');
        if (phone.length >= 8) {
          parsed.push({ name: name || `Contato ${phone}`, phoneNumber: phone });
        }
      } else {
        const phone = line.replace(/\D/g, '');
        if (phone.length >= 8) {
          parsed.push({ name: `Contato ${phone}`, phoneNumber: phone });
        }
      }
    }
    return parsed;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setImportText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const parsedContacts = parseImportText();
    if (parsedContacts.length === 0) {
      showToast('error', 'Nenhum contato válido encontrado. Insira "Nome, Telefone" em cada linha.');
      return;
    }

    const targetBot = importTargetBotId || (bots[0]?.id);
    if (!targetBot) {
      showToast('error', 'Selecione um robô WhatsApp para vincular os contatos.');
      return;
    }

    try {
      setImporting(true);
      const res = await api.importContactsArray(targetBot, parsedContacts);
      showToast('success', `Importação concluída! ${res?.count || parsedContacts.length} contatos adicionados ao CRM.`);
      setShowImportModal(false);
      setImportText('');
      loadData();
    } catch (err) {
      showToast('error', err.message || 'Erro ao importar contatos.');
    } finally {
      setImporting(false);
    }
  };

  // Exportar Base em CSV
  const handleExportCsv = () => {
    if (filtered.length === 0) {
      showToast('error', 'Nenhum contato na lista para exportar.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,Nome,Telefone,WhatsApp JID,Data de Cadastro\n';
    filtered.forEach(c => {
      const name = (c.name || '').replace(/"/g, '""');
      const phone = c.phoneNumber || '';
      const jid = c.jid || '';
      const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
      csvContent += `"${name}","${phone}","${jid}","${date}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contatos_crm_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Base de contatos exportada em CSV!');
  };

  const parsedPreview = useMemo(() => parseImportText(), [importText]);

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
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
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header com Estatísticas e Ações Principais */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Contatos e Clientes (CRM)
            </h2>
            <span style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              {contacts.length} contatos
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Gestão unificada de contatos, clientes e sincronização automática com o WhatsApp
          </p>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={loadData} 
            className="btn btn-secondary" 
            title="Atualizar lista"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button 
            onClick={handleExportCsv} 
            className="btn btn-secondary"
            title="Exportar base filtrada em planilha CSV"
          >
            <Download size={15} /> Exportar CSV
          </button>

          <button 
            onClick={() => setShowImportModal(true)} 
            className="btn btn-secondary"
            title="Importar lista de contatos em lote via CSV ou Texto"
          >
            <Upload size={15} /> Importar Lista
          </button>

          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn btn-primary"
          >
            <UserPlus size={16} /> Novo Contato
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '420px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '38px', height: '40px' }}
          />
        </div>

        {bots.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Robô:
            </span>
            <select
              value={selectedBotFilter}
              onChange={(e) => setSelectedBotFilter(e.target.value)}
              style={{
                height: '40px',
                padding: '0 28px 0 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos os Robôs ({contacts.length})</option>
              {bots.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabela de Contatos */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-tertiary)' }}>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Contato</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>WhatsApp / Telefone</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Robô Vinculado</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Data Cadastro</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Users size={36} style={{ opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Nenhum contato encontrado.</p>
                    <p style={{ margin: 0, fontSize: '0.8rem' }}>
                      Clique em "Novo Contato", "Importar Lista" ou "Sincronizar Atendimentos" para povoar sua agenda.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(contact => {
                const cleanPhone = (contact.phoneNumber || contact.jid?.split('@')[0] || '').replace(/\D/g, '');
                const botObj = bots.find(b => b.id === contact.botId);

                return (
                  <tr 
                    key={contact.id || contact.jid}
                    style={{ 
                      borderBottom: '1px solid var(--border-subtle)', 
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div 
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary-subtle)',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',
                          position: 'relative',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        {contact.profilePicUrl ? (
                          <img 
                            src={contact.profilePicUrl} 
                            alt={contact.name || cleanPhone}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <span 
                          style={{ 
                            display: contact.profilePicUrl ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%'
                          }}
                        >
                          {(contact.name || cleanPhone || 'C').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.92rem' }}>
                          {contact.name || `Contato ${cleanPhone}`}
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          ID: {contact.id || 'N/A'}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={13} color="var(--primary)" />
                        <span>{contact.phoneNumber || cleanPhone}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '6px' }}>
                        <Bot size={13} />
                        <span>{botObj?.name || 'Robô Padrão'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '—'}
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                        {onOpenChat && (
                          <button
                            onClick={() => handleOpenContactChat(contact)}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            title="Abrir atendimento no chat ao vivo"
                          >
                            <MessageSquare size={13} /> Conversar
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          className="btn-icon"
                          style={{ color: '#ef4444' }}
                          title="Excluir este contato"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* PAGINAÇÃO */}
        {filtered.length > pageSize && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '14px 20px', 
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-tertiary)'
            }}
          >
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Mostrando <strong>{((currentPage - 1) * pageSize) + 1}</strong> a <strong>{Math.min(currentPage * pageSize, filtered.length)}</strong> de <strong>{filtered.length}</strong> contatos
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Novo Contato */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="var(--primary)" /> Cadastrar Novo Contato
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Nome Completo:
                </label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  WhatsApp / Telefone (com DDD):
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5511999998888 ou (11) 99999-8888"
                  value={createForm.phoneNumber}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  required
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              {bots.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Robô WhatsApp Vinculado:
                  </label>
                  <select
                    value={createForm.botId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, botId: e.target.value }))}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {bots.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="btn btn-secondary"
                  disabled={creatingContact}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={creatingContact}
                >
                  {creatingContact ? 'Cadastrando...' : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importação em Lote */}
      {showImportModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="var(--primary)" /> Importar Lista de Contatos
              </h3>
              <button 
                onClick={() => setShowImportModal(false)} 
                className="btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Cole sua lista de contatos abaixo ou carregue um arquivo <strong>.CSV</strong> ou <strong>.TXT</strong>. Formato aceito: <code>Nome, Telefone</code> por linha.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Cole os contatos ou suba arquivo:
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FileText size={13} /> Carregar Arquivo CSV/TXT
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".csv,.txt" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload}
                />
              </div>

              <textarea
                rows={7}
                placeholder="Exemplo:&#10;Maria Souza, 11988887777&#10;Carlos Lima, 21977776666&#10;5531999990000"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.84rem' }}
              />
            </div>

            {bots.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Vincular contatos importados ao Robô:
                </label>
                <select
                  value={importTargetBotId}
                  onChange={(e) => setImportTargetBotId(e.target.value)}
                  style={{ width: '100%', height: '40px' }}
                >
                  {bots.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prévia dos Contatos Reconhecidos */}
            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Contatos identificados para importação:</span>
              <strong style={{ color: parsedPreview.length > 0 ? '#10b981' : 'var(--text-muted)' }}>
                {parsedPreview.length} contato(s)
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowImportModal(false)} 
                className="btn btn-secondary"
                disabled={importing}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmImport} 
                className="btn btn-primary"
                disabled={importing || parsedPreview.length === 0}
              >
                {importing ? 'Importando...' : `Confirmar Importação (${parsedPreview.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
