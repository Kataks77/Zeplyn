import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Search, 
  Copy, 
  Check, 
  Sparkles, 
  Tag, 
  Folder, 
  Eye, 
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';

const AVAILABLE_VARIABLES = [
  { tag: '{primeiro_nome}', label: 'Primeiro Nome', desc: 'Ex: Carlos' },
  { tag: '{nome}', label: 'Nome Completo', desc: 'Ex: Carlos Eduardo' },
  { tag: '{saudacao}', label: 'Saudação (Horário)', desc: 'Bom dia / Boa tarde / Boa noite' },
  { tag: '{atendente}', label: 'Nome do Atendente', desc: 'Ex: Mariana Silva' },
  { tag: '{protocolo}', label: 'Nº Protocolo', desc: 'Ex: PROT-20260930-1234' },
  { tag: '{empresa}', label: 'Nome da Empresa', desc: 'Ex: Zeplyn' },
  { tag: '{telefone}', label: 'WhatsApp do Cliente', desc: 'Ex: 11999999999' },
  { tag: '{data}', label: 'Data Atual', desc: 'Ex: 30/09/2026' },
  { tag: '{hora}', label: 'Hora Atual', desc: 'Ex: 14:30' }
];

const CATEGORIES = ['Todos', 'Geral', 'Atendimento', 'Vendas', 'Suporte', 'Financeiro'];

export default function QuickMessagesView() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [copiedId, setCopiedId] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    shortcut: '',
    title: '',
    category: 'Geral',
    message: ''
  });

  const textareaRef = useRef(null);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await api.getQuickReplies({
        search: search || undefined,
        category: selectedCategory !== 'Todos' ? selectedCategory : undefined
      });
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Erro ao listar respostas rápidas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [search, selectedCategory]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      shortcut: '',
      title: '',
      category: 'Geral',
      message: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData({
      shortcut: item.shortcut.replace(/^\/+/, ''),
      title: item.title || '',
      category: item.category || 'Geral',
      message: item.message || item.content || ''
    });
    setShowModal(true);
  };

  const handleInsertVariable = (variableTag) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = formData.message;
    const newText = currentText.substring(0, start) + variableTag + currentText.substring(end);

    setFormData(prev => ({ ...prev, message: newText }));

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + variableTag.length, start + variableTag.length);
      }
    }, 50);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.shortcut.trim()) {
      alert('Informe o atalho (ex: pix, ola, tabela).');
      return;
    }
    if (!formData.message.trim()) {
      alert('Informe a mensagem.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        shortcut: formData.shortcut.replace(/^\/+/, '').trim().toLowerCase(),
        title: formData.title.trim() || `Atalho /${formData.shortcut.replace(/^\/+/, '').trim()}`,
        category: formData.category || 'Geral',
        message: formData.message.trim()
      };

      if (isEditing) {
        await api.updateQuickReply(editingId, payload);
      } else {
        await api.createQuickReply(payload);
      }

      setShowModal(false);
      loadMessages();
    } catch (err) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, shortcut) => {
    if (!window.confirm(`Deseja realmente excluir o atalho "/${shortcut}"?`)) return;
    try {
      await api.deleteQuickReply(id);
      loadMessages();
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleCopyShortcut = (shortcut, id) => {
    navigator.clipboard.writeText(`/${shortcut.replace(/^\/+/, '')}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Prévia dinâmica com dados de exemplo
  const renderPreview = (text) => {
    if (!text) return 'Sua prévia aparecerá aqui...';
    const now = new Date();
    const hours = now.getHours();
    let saudacao = 'Olá';
    if (hours >= 5 && hours < 12) saudacao = 'Bom dia';
    else if (hours >= 12 && hours < 18) saudacao = 'Boa tarde';
    else saudacao = 'Boa noite';

    return text
      .replace(/{primeiro_nome}/gi, 'Carlos')
      .replace(/{nome}/gi, 'Carlos Silva')
      .replace(/{saudacao}/gi, saudacao)
      .replace(/{atendente}/gi, 'Mariana')
      .replace(/{protocolo}/gi, 'PROT-20260930-4821')
      .replace(/{empresa}/gi, 'Zeplyn')
      .replace(/{telefone}/gi, '(11) 98765-4321')
      .replace(/{data}/gi, now.toLocaleDateString('pt-BR'))
      .replace(/{hora}/gi, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308' }}>
              <Zap size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                Respostas Rápidas & Atalhos com <span style={{ color: 'var(--primary, #3b82f6)' }}>/</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '2px 0 0 0' }}>
                Atalhos inteligentes com autocompletar e variáveis dinâmicas ({'{primeiro_nome}'}, {'{saudacao}'}, {'{protocolo}'})
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleOpenCreate} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600, borderRadius: '10px' }}
        >
          <Plus size={18} /> Novo Atalho
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>
        {/* Categorias Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: selectedCategory === cat ? '1px solid var(--primary, #3b82f6)' : '1px solid var(--border-subtle)',
                backgroundColor: selectedCategory === cat ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                color: selectedCategory === cat ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Input de Pesquisa */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por atalho ou texto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '34px',
              paddingRight: '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              borderRadius: '8px',
              fontSize: '0.84rem'
            }}
          />
        </div>
      </div>

      {/* Grid de Respostas Rápidas */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando respostas rápidas...
        </div>
      ) : messages.length === 0 ? (
        <div 
          className="glass-panel"
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px dashed var(--border-subtle)'
          }}
        >
          <Zap size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-main)' }}>
            Nenhum atalho encontrado
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Crie novos atalhos com '/' para que os atendentes respondam em segundos no chat ao vivo.
          </p>
          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            <Plus size={15} /> Cadastrar Primeiro Atalho
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {messages.map(item => {
            const rawShortcut = (item.shortcut || '').replace(/^\/+/, '');
            const cleanShortcut = `/${rawShortcut}`;
            const messageText = item.message || item.content || '';

            return (
              <div
                key={item.id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div>
                  {/* Topo do Card: Tag do atalho + Categoria + Ações */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span 
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          padding: '3px 10px',
                          borderRadius: '8px',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {cleanShortcut}
                      </span>

                      {item.category && (
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {item.category}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        onClick={() => handleCopyShortcut(cleanShortcut, item.id)}
                        className="btn-icon" 
                        style={{ width: '28px', height: '28px', color: copiedId === item.id ? '#10b981' : 'var(--text-muted)' }}
                        title="Copiar atalho"
                      >
                        {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        className="btn-icon" 
                        style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
                        title="Editar atalho"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id, rawShortcut)}
                        className="btn-icon" 
                        style={{ width: '28px', height: '28px', color: 'var(--status-error, #ef4444)' }}
                        title="Excluir atalho"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Título Amigável */}
                  {item.title && (
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {item.title}
                    </div>
                  )}

                  {/* Conteúdo da Mensagem */}
                  <p 
                    style={{ 
                      fontSize: '0.84rem', 
                      color: 'var(--text-secondary)', 
                      lineHeight: '1.5', 
                      whiteSpace: 'pre-wrap', 
                      margin: 0,
                      wordBreak: 'break-word',
                      maxHeight: '140px',
                      overflowY: 'auto'
                    }}
                  >
                    {messageText}
                  </p>
                </div>

                {/* Rodapé com Dica de Uso */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Digite <strong style={{ color: 'var(--text-main)' }}>{cleanShortcut}</strong> no LiveChat</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Sparkles size={11} color="#eab308" /> Variáveis ativas
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Atalho */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div 
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <Zap size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {isEditing ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Crie modelos ágeis com autocompletar por barra (/) e tags dinâmicas
                  </p>
                </div>
              </div>

              <button onClick={() => setShowModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Linha 1: Atalho + Categoria */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Atalho (sem a barra) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#60a5fa', fontFamily: 'monospace' }}>
                      /
                    </span>
                    <input
                      type="text"
                      placeholder="pix, ola, tabela"
                      value={formData.shortcut}
                      onChange={(e) => setFormData(prev => ({ ...prev, shortcut: e.target.value.replace(/^\/+/, '').replace(/\s+/g, '_') }))}
                      required
                      style={{ width: '100%', paddingLeft: '28px', fontFamily: 'monospace', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                  >
                    <option value="Geral">Geral</option>
                    <option value="Atendimento">Atendimento</option>
                    <option value="Vendas">Vendas</option>
                    <option value="Suporte">Suporte</option>
                    <option value="Financeiro">Financeiro</option>
                  </select>
                </div>
              </div>

              {/* Título Amigável */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Título Descritivo (Identificação no menu de sugestões)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Envio de Chave PIX e Instruções"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Tags / Variáveis Dinâmicas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Mensagem da Resposta Rápida <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Clique nas tags abaixo para inserir no texto:
                  </span>
                </div>

                {/* Chips de Variáveis */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {AVAILABLE_VARIABLES.map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        color: '#93c5fd',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={`${v.label} (${v.desc})`}
                    >
                      <Plus size={10} /> {v.tag}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  rows={5}
                  placeholder="Escreva a mensagem aqui. Ex: Olá {primeiro_nome}, como posso te ajudar hoje?"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  required
                  style={{ width: '100%', lineHeight: '1.5', fontSize: '0.88rem' }}
                />
              </div>

              {/* Caixa de Prévia em Tempo Real */}
              <div 
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  <Eye size={12} /> Prévia simulada com dados reais:
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.45', fontStyle: formData.message ? 'normal' : 'italic' }}>
                  {renderPreview(formData.message)}
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ minWidth: '140px', fontWeight: 700 }}
                >
                  {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Atalho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
