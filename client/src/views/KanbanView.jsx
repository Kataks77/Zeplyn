import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  UserCheck, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  Search, 
  Filter, 
  User, 
  Tag, 
  GripVertical,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';

export default function KanbanView({ onOpenChat }) {
  const { selectedBotId } = useAuth();
  const [chats, setChats] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de busca e visualização
  const [search, setSearch] = useState('');
  const [selectedAttendant, setSelectedAttendant] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');

  // Drag and Drop State
  const [draggedChatId, setDraggedChatId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

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

  const loadChats = async () => {
    try {
      setLoading(true);
      const [chatsData, tagsData] = await Promise.all([
        api.getChats(selectedBotId !== 'all' ? `botId=${selectedBotId}` : ''),
        api.getUserTags().catch(() => [])
      ]);
      if (Array.isArray(chatsData)) setChats(chatsData);
      if (Array.isArray(tagsData)) setUserTags(tagsData);
    } catch (err) {
      console.error('Erro ao carregar dados no Kanban:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();

    const refresh = () => loadChats();
    const cleanupUpdate = socketService.on('chat-updated', refresh);
    const cleanupCapture = socketService.on('chat-captured', refresh);
    const cleanupRelease = socketService.on('chat-released', refresh);
    const cleanupTransfer = socketService.on('chat-transferred', refresh);
    const cleanupStatus = socketService.on('chat_status_updated', refresh);
    const cleanupMsg = socketService.on('whatsapp-message-received', refresh);

    return () => {
      cleanupUpdate?.();
      cleanupCapture?.();
      cleanupRelease?.();
      cleanupTransfer?.();
      cleanupStatus?.();
      cleanupMsg?.();
    };
  }, [selectedBotId]);

  // Lista única de atendentes para o filtro
  const availableAttendants = useMemo(() => {
    const set = new Set();
    chats.forEach(c => {
      if (c.attendantName) set.add(c.attendantName);
    });
    return Array.from(set);
  }, [chats]);

  // Ações de Transição de Status
  const handleTakeOver = async (chatId) => {
    try {
      await api.takeOverChat(chatId);
      loadChats();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleFinish = async (chatId) => {
    try {
      await api.finishChat(chatId);
      loadChats();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleReopen = async (chatId) => {
    try {
      await api.reopenChat(chatId);
      loadChats();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  // Processar Drop de um Cartão em uma Coluna
  const handleCardDrop = async (chatId, targetColumnId) => {
    setDragOverColumn(null);
    setDraggedChatId(null);
    if (!chatId || !targetColumnId) return;

    const chat = chats.find(c => c.id === chatId);
    if (!chat || chat.status === targetColumnId) return;

    // Atualização otimista imediata na interface
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, status: targetColumnId } : c));

    try {
      if (targetColumnId === 'waiting') {
        await api.reopenChat(chatId);
      } else if (targetColumnId === 'attending') {
        await api.takeOverChat(chatId);
      } else if (targetColumnId === 'finished') {
        await api.finishChat(chatId);
      }
    } catch (err) {
      console.error('Erro ao mover cartão no Kanban:', err);
      loadChats(); // Reverte em caso de falha de rede
    }
  };

  // Filtragem dos atendimentos
  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const cleanPhone = (chat.contactJid || '').split('@')[0];
      const name = (chat.contactName || '').toLowerCase();
      const phone = cleanPhone.toLowerCase();
      const query = search.toLowerCase();

      const matchesSearch = !search || name.includes(query) || phone.includes(query);

      const matchesAttendant = 
        selectedAttendant === 'all' || 
        chat.attendantName === selectedAttendant;

      const chatTags = parseTags(chat.tags);
      const matchesTag = 
        selectedTag === 'all' || 
        chatTags.some(t => {
          const tName = typeof t === 'string' ? t : (t?.name || t?.label || '');
          return tName.toLowerCase() === selectedTag.toLowerCase();
        });

      return matchesSearch && matchesAttendant && matchesTag;
    });
  }, [chats, search, selectedAttendant, selectedTag]);

  const waitingChats = filteredChats.filter(c => c.status === 'waiting');
  const attendingChats = filteredChats.filter(c => c.status === 'attending');
  const finishedChats = filteredChats.filter(c => c.status === 'finished');

  const columns = [
    {
      id: 'waiting',
      title: 'Aguardando Atendimento',
      icon: Clock,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      chats: waitingChats
    },
    {
      id: 'attending',
      title: 'Em Atendimento Humano',
      icon: UserCheck,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      chats: attendingChats
    },
    {
      id: 'finished',
      title: 'Atendimentos Finalizados',
      icon: CheckCircle2,
      color: '#6b7280',
      bgColor: 'rgba(107, 114, 128, 0.1)',
      chats: finishedChats
    }
  ];

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Header com Ações e Título */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Quadro Kanban de Atendimentos
            </h2>
            <span style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              {filteredChats.length} conversas
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Arraste e solte os cartões entre as colunas para alterar o fluxo de atendimento em tempo real
          </p>
        </div>

        <button 
          onClick={loadChats} 
          className="btn btn-secondary"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar Quadro
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '22px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Campo de Busca */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por contato ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '38px', height: '38px' }}
          />
        </div>

        {/* Filtro por Atendente */}
        {availableAttendants.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Atendente:
            </span>
            <select
              value={selectedAttendant}
              onChange={(e) => setSelectedAttendant(e.target.value)}
              style={{
                height: '38px',
                padding: '0 24px 0 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos os Atendentes</option>
              {availableAttendants.map(att => (
                <option key={att} value={att}>
                  {att}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro por Etiqueta / Tag */}
        {userTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Etiqueta:
            </span>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              style={{
                height: '38px',
                padding: '0 24px 0 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todas as Etiquetas</option>
              {userTags.map(tag => (
                <option key={tag.id || tag.name} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid de 3 Colunas com Suporte a Drag and Drop */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', minHeight: '640px' }}>
        {columns.map(col => {
          const Icon = col.icon;
          const isDragOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              className="glass-panel"
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColumn !== col.id) setDragOverColumn(col.id);
              }}
              onDragLeave={(e) => {
                // Previne flickering ao passar por elementos filhos
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDragOverColumn(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const chatId = e.dataTransfer.getData('text/plain') || draggedChatId;
                handleCardDrop(chatId, col.id);
              }}
              style={{
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: 'var(--bg-secondary)',
                border: isDragOver ? `2px dashed ${col.color}` : '1px solid var(--border-subtle)',
                boxShadow: isDragOver ? `0 0 20px ${col.bgColor}` : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Cabeçalho da Coluna */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: col.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col.color }}>
                    <Icon size={16} />
                  </div>
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {col.title}
                  </h4>
                </div>
                <span 
                  style={{
                    backgroundColor: col.bgColor,
                    color: col.color,
                    padding: '2px 9px',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    fontWeight: 700
                  }}
                >
                  {col.chats.length}
                </span>
              </div>

              {/* Indicador de Drop Zone */}
              {isDragOver && (
                <div style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: col.bgColor,
                  color: col.color,
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: `1px dashed ${col.color}`
                }}>
                  Solte o atendimento aqui para mover para "{col.title}"
                </div>
              )}

              {/* Lista de Cartões Arrastáveis */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
                {col.chats.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    Nenhum atendimento nesta etapa
                  </div>
                ) : (
                  col.chats.map(chat => {
                    const cleanPhone = (chat.contactJid || '').split('@')[0];
                    const isBeingDragged = draggedChatId === chat.id;

                    return (
                      <div
                        key={chat.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', chat.id);
                          setDraggedChatId(chat.id);
                        }}
                        onDragEnd={() => {
                          setDraggedChatId(null);
                          setDragOverColumn(null);
                        }}
                        className="animate-fade-in"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderRadius: '12px',
                          border: '1px solid var(--border-subtle)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          boxShadow: 'var(--shadow-sm)',
                          cursor: 'grab',
                          opacity: isBeingDragged ? 0.45 : 1,
                          transform: isBeingDragged ? 'scale(0.98)' : 'scale(1)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ color: 'var(--text-muted)', paddingTop: '2px', cursor: 'grab' }} title="Arraste para mover">
                              <GripVertical size={14} />
                            </div>
                            <div>
                              <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)', display: 'block' }}>
                                {chat.contactName || cleanPhone}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {cleanPhone}
                              </span>
                            </div>
                          </div>

                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {chat.updatedAt ? new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        {chat.attendantName && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                            <UserCheck size={11} /> {chat.attendantName}
                          </div>
                        )}

                        {/* Etiquetas / Tags Coloridas do Chat */}
                        {(() => {
                          const chatTags = parseTags(chat.tags);
                          if (chatTags.length === 0) return null;
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                              {chatTags.map((tag, tIdx) => {
                                const tagName = typeof tag === 'string' ? tag : (tag?.name || tag?.label || '');
                                const userTag = userTags.find(ut => ut.name?.toLowerCase() === tagName?.toLowerCase());
                                const color = userTag?.color || '#3b82f6';
                                return (
                                  <span
                                    key={tIdx}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      backgroundColor: `${color}22`,
                                      color: color,
                                      border: `1px solid ${color}55`
                                    }}
                                  >
                                    {tagName}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Botões de Ação Direta */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          {col.id === 'waiting' && (
                            <button
                              onClick={() => handleTakeOver(chat.id)}
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem' }}
                            >
                              Assumir
                            </button>
                          )}

                          {col.id === 'attending' && (
                            <button
                              onClick={() => handleFinish(chat.id)}
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem' }}
                            >
                              Finalizar
                            </button>
                          )}

                          {col.id === 'finished' && (
                            <button
                              onClick={() => handleReopen(chat.id)}
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem' }}
                            >
                              Reabrir
                            </button>
                          )}

                          {onOpenChat && (
                            <button
                              onClick={() => onOpenChat(chat)}
                              className="btn-icon"
                              style={{ width: '32px', height: '32px' }}
                              title="Abrir no atendimento ao vivo"
                            >
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
