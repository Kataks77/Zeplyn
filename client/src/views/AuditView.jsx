import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  RefreshCw, 
  Building2, 
  User, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ShieldCheck, 
  Eye, 
  Mail, 
  Key, 
  Navigation, 
  MessageSquare, 
  Settings, 
  Megaphone, 
  Users, 
  ArrowRight,
  Globe
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';

export default function AuditView() {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);

  // Modal de detalhes
  const [selectedLog, setSelectedLog] = useState(null);

  // Carregar lista de empresas caso seja superadmin
  useEffect(() => {
    if (isSuperAdmin) {
      api.getCompanies?.()
        .then(data => {
          if (Array.isArray(data)) setCompanies(data);
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  const fetchLogs = async (currentPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(limit));
      if (search.trim()) params.append('search', search.trim());
      if (category) params.append('category', category);
      if (isSuperAdmin && selectedCompanyId) params.append('companyId', selectedCompanyId);

      const res = await api.getAuditLogs(params.toString());
      if (res && res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Erro ao buscar logs de auditoria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [category, selectedCompanyId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'SCREEN_NAVIGATION':
      case 'SCREEN_ENTER':
        return { label: 'Navegação de Tela', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' };
      case 'USER_LOGIN':
        return { label: 'Login Efetuado', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'USER_LOGOUT':
        return { label: 'Logout', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
      case 'CHAT_TAKEOVER':
        return { label: 'Atendimento Assumido', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)' };
      case 'CHAT_FINISH':
        return { label: 'Atendimento Finalizado', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'CHAT_TRANSFER':
        return { label: 'Atendimento Transferido', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'CHAT_RELEASE':
        return { label: 'Atendimento Liberado', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' };
      case 'USER_CREATE':
        return { label: 'Novo Operador Criado', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'USER_UPDATE':
        return { label: 'Operador Atualizado', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' };
      case 'USER_DELETE':
        return { label: 'Operador Excluído', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'ACCESS_COMPANY_UPDATE':
        return { label: 'Permissões da Empresa', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' };
      case 'ACCESS_USER_UPDATE':
        return { label: 'Permissões do Operador', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' };
      case 'SETTINGS_UPDATE':
        return { label: 'Configurações Salvas', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' };
      case 'CAMPAIGN_CREATE':
        return { label: 'Campanha Criada', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)' };
      case 'CAMPAIGN_START':
        return { label: 'Campanha Iniciada', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'CAMPAIGN_PAUSE':
        return { label: 'Campanha Pausada', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'CAMPAIGN_CANCEL':
        return { label: 'Campanha Cancelada', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'CAMPAIGN_DELETE':
        return { label: 'Campanha Excluída', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.3)' };
      case 'CONTACTS_IMPORT':
        return { label: 'Contatos Importados', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' };
      case 'CONTACTS_CLEAR':
        return { label: 'Contatos Limpos', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)' };
      default:
        return { label: action || 'Ação Registrada', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const getRoleBadge = (role) => {
    switch (role?.toLowerCase()) {
      case 'superadmin':
        return { label: 'Superadmin', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: 'rgba(192, 132, 252, 0.35)' };
      case 'admin':
        return { label: 'Administrador', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.35)' };
      case 'operator':
      case 'operador':
        return { label: 'Operador', color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.15)', border: 'rgba(45, 212, 191, 0.35)' };
      default:
        return { label: role || 'Atendente', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.35)' };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (_) {
      return dateStr;
    }
  };

  const parseDetails = (details) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    try {
      return JSON.parse(details);
    } catch (_) {
      return details;
    }
  };

  const cleanIp = (ip) => {
    if (!ip) return '—';
    return String(ip).replace('::ffff:', '').replace('::1', '127.0.0.1 (Localhost)');
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', backgroundColor: 'var(--bg-main)' }}>
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.25))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.35)' }}>
              <ClipboardList size={22} style={{ color: '#38bdf8' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                Trilha de Auditoria & Rastreabilidade de Operadores
              </h1>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {isSuperAdmin 
                  ? 'Visão global de todos os acessos, navegações de tela e ações operacionais no ecossistema SaaS.'
                  : 'Rastreabilidade completa de todas as entradas, saídas de telas e operações da sua equipe.'}
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => fetchLogs(page)}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', cursor: 'pointer' }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Atualizar Trilha</span>
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <div 
        style={{ 
          background: 'var(--card-bg, #1e293b)', 
          border: '1px solid var(--border-color, #334155)', 
          borderRadius: '14px', 
          padding: '16px 20px', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap'
        }}
      >
        {/* BUSCA */}
        <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Buscar por operador, e-mail, ação, empresa, IP ou detalhe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--input-bg, #0f172a)',
              color: 'var(--text-main)',
              fontSize: '0.86rem'
            }}
          />
        </form>

        {/* FILTRO DE CATEGORIA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--input-bg, #0f172a)',
              color: 'var(--text-main)',
              fontSize: '0.86rem',
              cursor: 'pointer'
            }}
          >
            <option value="">Todas as Categorias</option>
            <option value="navigation">Navegação / Telas</option>
            <option value="chats">Atendimento / LiveChat</option>
            <option value="users">Usuários & Equipe</option>
            <option value="access">Controle de Acessos</option>
            <option value="campaigns">Disparos em Massa</option>
            <option value="contacts">Contatos & CRM</option>
            <option value="settings">Configurações</option>
            <option value="auth">Autenticação (Login/Logout)</option>
            <option value="general">Geral</option>
          </select>
        </div>

        {/* SE FOR SUPERADMIN: FILTRO DE EMPRESA */}
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={15} style={{ color: '#38bdf8' }} />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'var(--input-bg, #0f172a)',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
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

        <div style={{ marginLeft: 'auto', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          Total registrado: <strong>{total}</strong> evento(s)
        </div>
      </div>

      {/* TABELA DE AUDITORIA */}
      <div 
        style={{ 
          background: 'var(--card-bg, #1e293b)', 
          border: '1px solid var(--border-color, #334155)', 
          borderRadius: '14px', 
          overflow: 'hidden' 
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color, #334155)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px', fontWeight: '600' }}>Data / Hora</th>
                <th style={{ padding: '14px 20px', fontWeight: '600' }}>Empresa</th>
                <th style={{ padding: '14px 20px', fontWeight: '600' }}>Quem Realizou (Operador)</th>
                <th style={{ padding: '14px 20px', fontWeight: '600' }}>Ação Registrada</th>
                <th style={{ padding: '14px 20px', fontWeight: '600' }}>O que aconteceu (Descrição)</th>
                <th style={{ padding: '14px 20px', fontWeight: '600' }}>IP / Origem</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '600' }}>Inspecionar</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#38bdf8' }} />
                    <p>Carregando histórico detalhado de auditoria...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={38} style={{ margin: '0 auto 12px auto', color: '#64748b', opacity: 0.6 }} />
                    <p style={{ fontSize: '0.98rem', fontWeight: '600', color: 'var(--text-main)' }}>Nenhum log encontrado</p>
                    <p style={{ fontSize: '0.84rem' }}>Nenhum evento registrado com os filtros aplicados.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionBadge = getActionBadge(log.action);
                  const roleBadge = getRoleBadge(log.userRole);

                  return (
                    <tr 
                      key={log.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background-color 0.15s'
                      }}
                      className="hover-row"
                    >
                      {/* DATA/HORA */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{formatDate(log.createdAt)}</span>
                        </div>
                      </td>

                      {/* EMPRESA */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontSize: '0.80rem',
                            fontWeight: '600',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.25)'
                          }}
                        >
                          <Building2 size={13} />
                          {log.companyName || 'Empresa Padrão'}
                        </span>
                      </td>

                      {/* QUEM REALIZOU (OPERADOR COMPLETO COM NOME, EMAIL E CARGO) */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div 
                            style={{ 
                              width: '34px', 
                              height: '34px', 
                              borderRadius: '50%', 
                              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))', 
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: '0.82rem',
                              fontWeight: '700',
                              color: '#fff',
                              flexShrink: 0
                            }}
                          >
                            {(log.userName || 'S')[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: '140px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{log.userName || 'Sistema'}</span>
                              {log.userRole && (
                                <span 
                                  style={{
                                    fontSize: '0.70rem',
                                    fontWeight: '700',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: roleBadge.bg,
                                    color: roleBadge.color,
                                    border: `1px solid ${roleBadge.border}`
                                  }}
                                >
                                  {roleBadge.label}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                              <Mail size={11} />
                              <span>{log.userEmail || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* AÇÃO */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            backgroundColor: actionBadge.bg,
                            color: actionBadge.color,
                            border: `1px solid ${actionBadge.border}`
                          }}
                        >
                          {actionBadge.label}
                        </span>
                      </td>

                      {/* O QUE ACONTECEU (DESCRIÇÃO CLARA) */}
                      <td style={{ padding: '14px 20px', maxWidth: '320px', color: 'var(--text-main)' }}>
                        <div style={{ fontWeight: '500', fontSize: '0.84rem', lineHeight: '1.4' }}>
                          {log.description || actionBadge.label}
                        </div>
                      </td>

                      {/* IP / ORIGEM */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.80rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Globe size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{cleanIp(log.ipAddress)}</span>
                        </div>
                      </td>

                      {/* BOTÃO INSPECIONAR */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn-icon"
                          title="Inspecionar todos os detalhes deste evento"
                          style={{
                            padding: '7px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-color, #334155)'
                          }}
                        >
                          <Eye size={16} style={{ color: '#38bdf8' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '14px 20px', 
              borderTop: '1px solid var(--border-color, #334155)',
              background: 'rgba(0, 0, 0, 0.08)'
            }}
          >
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Página <strong>{page}</strong> de <strong>{totalPages}</strong> (Total: {total} eventos)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => fetchLogs(page - 1)}
                disabled={page <= 1 || loading}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={15} />
                Anterior
              </button>
              <button 
                onClick={() => fetchLogs(page + 1)}
                disabled={page >= totalPages || loading}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                Próxima
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE INSPEÇÃO DETALHADA */}
      {selectedLog && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(6px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            style={{ 
              background: 'var(--card-bg, #1e293b)', 
              border: '1px solid var(--border-color, #334155)', 
              borderRadius: '16px', 
              width: '100%', 
              maxWidth: '680px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              overflow: 'hidden'
            }}
          >
            {/* CABEÇALHO DO MODAL */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <ClipboardList size={18} style={{ color: '#38bdf8' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                    Trilha de Auditoria: Detalhes do Registro
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                    ID: {selectedLog.id}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="btn-icon" 
                style={{ padding: '6px', cursor: 'pointer', borderRadius: '8px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* CONTEÚDO DO MODAL */}
            <div style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
              {/* O QUE ACONTECEU (DESTAQUE) */}
              <div 
                style={{ 
                  background: 'rgba(56, 189, 248, 0.08)', 
                  border: '1px solid rgba(56, 189, 248, 0.25)', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  marginBottom: '18px' 
                }}
              >
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.5px' }}>
                  Descrição da Ação Realizada
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: '600', color: '#fff', marginTop: '4px', lineHeight: '1.4' }}>
                  {selectedLog.description || selectedLog.action}
                </div>
              </div>

              {/* CARDS: QUEM FEZ & QUAL EMPRESA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                {/* QUEM FEZ */}
                <div 
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.2)', 
                    border: '1px solid var(--border-color, #334155)', 
                    borderRadius: '12px', 
                    padding: '14px' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                    <User size={13} />
                    <span>Quem Realizou (Operador)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <div 
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3))', 
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: '700',
                        fontSize: '0.92rem',
                        color: '#fff',
                        flexShrink: 0
                      }}
                    >
                      {(selectedLog.userName || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.90rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        {selectedLog.userName || 'Sistema'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {selectedLog.userEmail || 'E-mail não informado'}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <span 
                          style={{
                            fontSize: '0.70rem',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            ...getRoleBadge(selectedLog.userRole)
                          }}
                        >
                          {getRoleBadge(selectedLog.userRole).label}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedLog.userId && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.70rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ID: {selectedLog.userId}
                    </div>
                  )}
                </div>

                {/* QUAL EMPRESA */}
                <div 
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.2)', 
                    border: '1px solid var(--border-color, #334155)', 
                    borderRadius: '12px', 
                    padding: '14px' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                    <Building2 size={13} />
                    <span>Empresa / Organização</span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#38bdf8' }}>
                      {selectedLog.companyName || 'Empresa Padrão'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '3px' }}>
                      Código: {selectedLog.companyId}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <Globe size={12} />
                      <span>IP de Origem:</span>
                      <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{cleanIp(selectedLog.ipAddress)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <Clock size={12} />
                      <span>Data / Hora:</span>
                      <strong style={{ color: 'var(--text-main)' }}>{formatDate(selectedLog.createdAt)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETALHES TÉCNICOS (PAYLOAD) */}
              <div style={{ marginTop: '18px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>
                  Parâmetros da Operação (Payload / Detalhes)
                </div>
                <pre 
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.35)', 
                    padding: '14px 16px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color, #334155)',
                    fontSize: '0.80rem', 
                    fontFamily: 'monospace',
                    color: '#38bdf8', 
                    overflowX: 'auto',
                    margin: 0,
                    lineHeight: '1.5'
                  }}
                >
                  {JSON.stringify(parseDetails(selectedLog.details), null, 2) || 'Nenhum payload gravado para esta ação.'}
                </pre>
              </div>
            </div>

            {/* RODAPÉ DO MODAL */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color, #334155)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.05)' }}>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="btn btn-primary"
                style={{ padding: '8px 22px', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
