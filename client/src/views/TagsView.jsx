import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Search, 
  MessageSquare, 
  RefreshCw, 
  Loader2, 
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PRESET_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', 
  '#eab308', '#14b8a6'
];

export default function TagsView({ onOpenChat }) {
  const { user, selectedBotId } = useAuth();
  const [tags, setTags] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal de Criação / Edição
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6' });
  const [submitting, setSubmitting] = useState(false);

  // Modal de Confirmação de Exclusão
  const [deletingTag, setDeletingTag] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Feedback Toast
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [tagsData, chatsData] = await Promise.all([
        api.getUserTags().catch(() => []),
        api.getChats(selectedBotId !== 'all' ? `botId=${selectedBotId}` : '').catch(() => [])
      ]);
      setTags(Array.isArray(tagsData) ? tagsData : []);
      setChats(Array.isArray(chatsData) ? chatsData : []);
    } catch (err) {
      console.error('Erro ao carregar dados de etiquetas:', err);
      showToast('error', 'Falha ao carregar suas etiquetas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBotId]);

  const handleOpenCreate = () => {
    setEditingTag(null);
    setFormData({ name: '', color: '#3b82f6' });
    setShowModal(true);
  };

  const handleOpenEdit = (tag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color || '#3b82f6' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Informe o nome da nomenclatura / etiqueta.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingTag) {
        await api.updateUserTag(editingTag.id, {
          name: formData.name.trim(),
          color: formData.color
        });
        showToast('success', 'Nomenclatura atualizada com sucesso!');
      } else {
        await api.createUserTag({
          name: formData.name.trim(),
          color: formData.color
        });
        showToast('success', 'Nova nomenclatura criada com sucesso!');
      }
      setShowModal(false);
      setEditingTag(null);
      setFormData({ name: '', color: '#3b82f6' });
      await loadData();
    } catch (err) {
      console.error('Erro ao salvar etiqueta:', err);
      showToast('error', err.message || 'Erro ao salvar nomenclatura.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;
    try {
      setDeleteLoading(true);
      await api.deleteUserTag(deletingTag.id);
      showToast('success', `Nomenclatura "${deletingTag.name}" excluída.`);
      setDeletingTag(null);
      await loadData();
    } catch (err) {
      console.error('Erro ao excluir etiqueta:', err);
      showToast('error', err.message || 'Erro ao excluir etiqueta.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Extrai tags de um chat
  const parseTags = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Contagem de conversas ativas para cada tag
  const getTagUsageCount = (tagName) => {
    return chats.filter(c => {
      const current = parseTags(c.tags);
      return current.some(t => (typeof t === 'string' ? t : (t?.name || t?.label)) === tagName);
    }).length;
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalTaggedChats = chats.filter(c => parseTags(c.tags).length > 0).length;

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div 
          className="animate-slide-down"
          style={{
            position: 'fixed',
            top: '80px',
            right: '28px',
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 600
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Cabeçalho da Página */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Tag size={20} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              Nomenclaturas & Etiquetas de Status
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: '750px', margin: 0, marginTop: '4px' }}>
            Personalize as etiquetas e nomenclaturas de status vinculadas à sua empresa. Todos os operadores e atendentes compartilham essas nomenclaturas para classificar e organizar conversas no Atendimento ao Vivo.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={loadData} 
            className="btn btn-secondary"
            title="Recarregar etiquetas"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>

          {onOpenChat && (
            <button 
              onClick={() => onOpenChat()} 
              className="btn btn-secondary"
              title="Abrir Atendimento ao Vivo"
            >
              <MessageSquare size={15} />
              <span>Ver Atendimento</span>
            </button>
          )}

          <button 
            onClick={handleOpenCreate} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>Nova Nomenclatura</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas / Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div 
          className="glass-panel" 
          style={{ 
            padding: '18px 20px', 
            borderRadius: '14px', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tag size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, display: 'block' }}>
              Nomenclaturas da Empresa
            </span>
            <strong style={{ fontSize: '1.5rem', color: 'var(--text-main)', fontWeight: 800 }}>
              {tags.length}
            </strong>
          </div>
        </div>

        <div 
          className="glass-panel" 
          style={{ 
            padding: '18px 20px', 
            borderRadius: '14px', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, display: 'block' }}>
              Conversas Marcadas
            </span>
            <strong style={{ fontSize: '1.5rem', color: 'var(--text-main)', fontWeight: 800 }}>
              {totalTaggedChats}
            </strong>
          </div>
        </div>

        <div 
          className="glass-panel" 
          style={{ 
            padding: '18px 20px', 
            borderRadius: '14px', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, display: 'block' }}>
              Empresa Vinculada
            </span>
            <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
              {user?.companyName || user?.companyId || 'Sua Empresa'}
            </strong>
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search 
            size={16} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: 'var(--text-muted)' 
            }} 
          />
          <input
            type="text"
            placeholder="Buscar nomenclatura ou status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '38px',
              height: '40px',
              borderRadius: '10px',
              fontSize: '0.86rem'
            }}
          />
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Exibindo <strong>{filteredTags.length}</strong> de <strong>{tags.length}</strong> nomenclaturas
        </div>
      </div>

      {/* Grid de Nomenclaturas */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 size={32} className="animate-spin" color="var(--primary)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Carregando suas nomenclaturas...</span>
        </div>
      ) : filteredTags.length === 0 ? (
        <div 
          className="glass-panel"
          style={{ 
            padding: '50px 20px', 
            textAlign: 'center', 
            borderRadius: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div 
            style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--primary-subtle)', 
              color: 'var(--primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <Tag size={26} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {searchTerm ? 'Nenhuma nomenclatura encontrada' : 'Nenhuma nomenclatura personalizada'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: '440px', margin: '0 auto 20px auto' }}>
            {searchTerm 
              ? `Não foram encontrados resultados para "${searchTerm}". Tente outro termo.` 
              : 'Crie suas próprias etiquetas personalizadas com cores vibrantes para identificar leads, status e pendências no Atendimento ao Vivo.'}
          </p>
          {!searchTerm && (
            <button onClick={handleOpenCreate} className="btn btn-primary">
              <Plus size={16} /> Criar Minha Primeira Nomenclatura
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filteredTags.map(tag => {
            const usageCount = getTagUsageCount(tag.name);
            const color = tag.color || '#3b82f6';
            const bg = color.startsWith('#') && color.length === 7 ? `${color}22` : 'rgba(59, 130, 246, 0.15)';
            const border = color.startsWith('#') && color.length === 7 ? `${color}55` : 'rgba(59, 130, 246, 0.35)';

            return (
              <div
                key={tag.id}
                className="glass-panel animate-fade-in"
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div>
                  {/* Top: Pill e Ações */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        backgroundColor: bg,
                        color: color,
                        border: `1px solid ${border}`,
                        letterSpacing: '-0.01em',
                        boxShadow: `0 2px 8px ${bg}`
                      }}
                    >
                      <span 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}`
                        }} 
                      />
                      {tag.name}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleOpenEdit(tag)}
                        className="btn-icon"
                        style={{ width: '32px', height: '32px' }}
                        title="Editar nomenclatura ou cor"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingTag(tag)}
                        className="btn-icon"
                        style={{ width: '32px', height: '32px', color: '#ef4444' }}
                        title="Excluir nomenclatura"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Informações de Uso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <MessageSquare size={13} />
                    <span>
                      {usageCount === 1 ? '1 conversa ativa com esta etiqueta' : `${usageCount} conversas ativas com esta etiqueta`}
                    </span>
                  </div>
                </div>

                {/* Rodapé do Card com Atalho para o Atendimento */}
                <div 
                  style={{ 
                    paddingTop: '12px', 
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {color.toUpperCase()}
                  </span>

                  {onOpenChat && (
                    <button
                      onClick={() => onOpenChat(tag.name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-subtle)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Ir ao atendimento e filtrar por este status"
                    >
                      <span>Filtrar no Chat</span>
                      <MessageSquare size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-scale-up"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '18px',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            {/* Modal Header */}
            <div 
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {editingTag ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    {editingTag ? 'Editar Nomenclatura' : 'Nova Nomenclatura de Status'}
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Personalize o nome e a cor para identificação no atendimento
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Input de Nome */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                    Nome da Nomenclatura / Status *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 🚀 Lead Quente, 💰 Proposta Enviada, ⏳ Aguardando Contrato..."
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
                    autoFocus
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Você pode usar emojis no início do texto para rápida identificação visual.
                  </span>
                </div>

                {/* Seletor de Cor */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                    Cor do Marcador
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(colorHex => (
                      <button
                        key={colorHex}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color: colorHex }))}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: colorHex,
                          border: formData.color === colorHex ? '3px solid #ffffff' : '2px solid transparent',
                          boxShadow: formData.color === colorHex ? `0 0 0 2px ${colorHex}, 0 2px 8px rgba(0,0,0,0.3)` : 'none',
                          cursor: 'pointer',
                          transition: 'transform 0.12s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    ))}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        style={{
                          width: '36px',
                          height: '36px',
                          padding: 0,
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                        title="Selecione qualquer cor personalizada"
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {formData.color.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prévia em Tempo Real */}
                <div 
                  style={{ 
                    padding: '16px', 
                    borderRadius: '12px', 
                    backgroundColor: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-subtle)' 
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Prévia Visual no Atendimento e Kanban:
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        backgroundColor: `${formData.color}22`,
                        color: formData.color,
                        border: `1px solid ${formData.color}55`,
                        boxShadow: `0 2px 8px ${formData.color}22`
                      }}
                    >
                      <span 
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: formData.color,
                          boxShadow: `0 0 6px ${formData.color}`
                        }} 
                      />
                      {formData.name.trim() || 'Nome da Nomenclatura'}
                    </span>

                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      ← Como o operador verá no chat
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div 
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: 'var(--bg-tertiary)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting || !formData.name.trim()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>{editingTag ? 'Salvar Alterações' : 'Criar Nomenclatura'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingTag && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-scale-up"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <Trash2 size={22} />
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', textAlign: 'center', marginBottom: '8px' }}>
              Excluir Nomenclatura?
            </h3>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '20px' }}>
              Tem certeza que deseja remover a nomenclatura <strong>"{deletingTag.name}"</strong>? Ela deixará de estar disponível para seleção nos seus atendimentos.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                className="btn btn-secondary"
                disabled={deleteLoading}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {deleteLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span>{deleteLoading ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
