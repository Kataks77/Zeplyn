import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  Users, 
  Search, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Save, 
  Sparkles, 
  Sliders, 
  Lock, 
  Unlock, 
  Info,
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Columns3,
  Tag,
  Bot,
  Zap,
  UserCheck,
  Settings,
  GitBranch,
  Megaphone,
  Briefcase,
  Smartphone,
  ClipboardList,
  Calendar,
  Package,
  Radio
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';

const ICON_MAP = {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Columns3,
  Tag,
  Bot,
  Zap,
  Users,
  UserCheck,
  Settings,
  GitBranch,
  Megaphone,
  Briefcase,
  Smartphone,
  ClipboardList,
  Calendar,
  Package,
  Radio
};

export default function AccessControlView() {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Dados da Matriz
  const [modules, setModules] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);

  // Estados de Navegação / Aba
  const [activeTab, setActiveTab] = useState('users'); // 'users' ou 'companies'
  
  // Seleção de Usuário
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserScreens, setSelectedUserScreens] = useState([]);
  const [hasUserChanges, setHasUserChanges] = useState(false);

  // Seleção de Empresa (Para Superadmin)
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedCompanyScreens, setSelectedCompanyScreens] = useState([]);
  const [hasCompanyChanges, setHasCompanyChanges] = useState(false);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadMatrix = async () => {
    try {
      setLoading(true);
      const data = await api.getAccessMatrix();
      if (data) {
        setModules(data.modules || []);
        setCompanies(data.companies || []);
        setUsers(data.users || []);

        // Selecionar primeiro usuário por padrão se não selecionado
        if (data.users && data.users.length > 0 && !selectedUserId) {
          const firstUser = data.users[0];
          setSelectedUserId(firstUser.id);
          initUserScreens(firstUser, data.modules);
        }

        // Selecionar primeira empresa se Superadmin
        if (data.companies && data.companies.length > 0 && !selectedCompanyId) {
          const firstComp = data.companies[0];
          setSelectedCompanyId(firstComp.id);
          initCompanyScreens(firstComp, data.modules);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar matriz de acessos:', err);
      showToast(err.message || 'Erro ao carregar permissões', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  const initUserScreens = (userObj, allMods = modules) => {
    if (!userObj) return;
    if (Array.isArray(userObj.allowedScreens)) {
      setSelectedUserScreens(userObj.allowedScreens);
    } else {
      // Default: se for admin, todas as telas; se for operador, telas padrão de atendimento
      if (userObj.role === 'admin' || userObj.role === 'superadmin') {
        setSelectedUserScreens(allMods.map(m => m.id));
      } else {
        setSelectedUserScreens(['chat', 'kanban', 'contacts', 'quick_messages', 'tags']);
      }
    }
    setHasUserChanges(false);
  };

  const initCompanyScreens = (compObj, allMods = modules) => {
    if (!compObj) return;
    if (Array.isArray(compObj.allowedScreens)) {
      setSelectedCompanyScreens(compObj.allowedScreens);
    } else {
      setSelectedCompanyScreens(allMods.map(m => m.id));
    }
    setHasCompanyChanges(false);
  };

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Empresa vinculada ao usuário atualmente selecionado
  const selectedUserCompany = useMemo(() => {
    if (!selectedUser) return null;
    return companies.find(c => c.id === selectedUser.companyId) || null;
  }, [companies, selectedUser]);

  // Lista de módulos disponíveis filtrados pela empresa do usuário
  const isModuleAllowedByCompany = (moduleId) => {
    if (isSuperAdmin) return true;
    if (!selectedUserCompany || !Array.isArray(selectedUserCompany.allowedScreens)) return true;
    return selectedUserCompany.allowedScreens.includes(moduleId);
  };

  const handleSelectUser = (userObj) => {
    setSelectedUserId(userObj.id);
    initUserScreens(userObj);
  };

  const handleSelectCompany = (compObj) => {
    setSelectedCompanyId(compObj.id);
    initCompanyScreens(compObj);
  };

  // Toggle de tela individual para o usuário selecionado
  const toggleUserScreen = (moduleId) => {
    if (!isModuleAllowedByCompany(moduleId)) {
      showToast('Este módulo não está habilitado no plano da empresa.', 'error');
      return;
    }
    setSelectedUserScreens(prev => {
      const next = prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId];
      setHasUserChanges(true);
      return next;
    });
  };

  // Toggle de tela para a empresa selecionada (Superadmin)
  const toggleCompanyScreen = (moduleId) => {
    setSelectedCompanyScreens(prev => {
      const next = prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId];
      setHasCompanyChanges(true);
      return next;
    });
  };

  // Presets Rápidos para Usuário
  const applyUserPreset = (presetType) => {
    let newScreens = [];
    const validMods = modules.filter(m => isModuleAllowedByCompany(m.id)).map(m => m.id);

    if (presetType === 'all') {
      newScreens = validMods;
    } else if (presetType === 'chat_basic') {
      newScreens = ['chat', 'contacts', 'quick_messages', 'tags'].filter(s => validMods.includes(s));
    } else if (presetType === 'crm_sales') {
      newScreens = ['dashboard', 'chat', 'kanban', 'contacts', 'quick_messages', 'tags'].filter(s => validMods.includes(s));
    } else if (presetType === 'ai_operator') {
      newScreens = ['chat', 'bots', 'flows', 'campaigns'].filter(s => validMods.includes(s));
    } else if (presetType === 'clear') {
      newScreens = [];
    }

    setSelectedUserScreens(newScreens);
    setHasUserChanges(true);
  };

  // Salvar Permissões do Usuário
  const handleSaveUserPermissions = async () => {
    if (!selectedUserId) return;
    try {
      setSaving(true);
      await api.updateUserAccess(selectedUserId, selectedUserScreens);
      
      // Atualizar estado local
      setUsers(prev => prev.map(u => {
        if (u.id === selectedUserId) {
          return { ...u, allowedScreens: selectedUserScreens };
        }
        return u;
      }));

      setHasUserChanges(false);
      showToast(`Permissões de ${selectedUser?.name || 'usuário'} salvas com sucesso!`);
    } catch (err) {
      console.error('Erro ao salvar permissões do usuário:', err);
      showToast(err.message || 'Erro ao salvar permissões', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Salvar Permissões da Empresa (Superadmin)
  const handleSaveCompanyPermissions = async () => {
    if (!selectedCompanyId) return;
    try {
      setSaving(true);
      await api.updateCompanyAccess(selectedCompanyId, selectedCompanyScreens);

      // Atualizar estado local
      setCompanies(prev => prev.map(c => {
        if (c.id === selectedCompanyId) {
          return { ...c, allowedScreens: selectedCompanyScreens };
        }
        return c;
      }));

      setHasCompanyChanges(false);
      showToast(`Módulos da empresa ${selectedCompany?.name || ''} atualizados!`);
    } catch (err) {
      console.error('Erro ao salvar módulos da empresa:', err);
      showToast(err.message || 'Erro ao salvar módulos da empresa', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filtros
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          (u.department || '').toLowerCase().includes(userSearchTerm.toLowerCase());
      return matchSearch;
    });
  }, [users, userSearchTerm]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      return (c.name || '').toLowerCase().includes(companySearchTerm.toLowerCase()) ||
             (c.cnpj || '').includes(companySearchTerm);
    });
  }, [companies, companySearchTerm]);

  // Agrupamento de módulos por categoria
  const modulesByCategory = useMemo(() => {
    const grouped = {};
    modules.forEach(mod => {
      const cat = mod.category || 'Geral';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(mod);
    });
    return grouped;
  }, [modules]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={36} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 12px auto' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carregando matriz de controle de acessos...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      {/* Toast de Notificação */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '12px',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            fontSize: '0.9rem',
            fontWeight: 500,
            animation: 'fadeInDown 0.25s ease'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner / Contexto */}
      <div 
        style={{
          padding: '18px 28px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-subtle)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Controle de Acessos & Telas
              </h2>
              <span 
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  backgroundColor: isSuperAdmin ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: isSuperAdmin ? 'var(--secondary)' : 'var(--primary)',
                  border: isSuperAdmin ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                {isSuperAdmin ? 'Visão Master Superadmin' : 'Administração da Empresa'}
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {isSuperAdmin 
                ? 'Defina com precisão quais telas cada empresa pode contratar e quais recursos cada usuário pode acessar.'
                : 'Defina quais telas e menus cada cliente, atendente ou operador da sua equipe terá acesso no painel.'}
            </p>
          </div>
        </div>

        {/* Abas Superadmin (Empresas vs Usuários) */}
        {isSuperAdmin && (
          <div 
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <button
              onClick={() => setActiveTab('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'users' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'users' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              <Users size={16} />
              Acessos por Usuário
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'companies' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'companies' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              <Building2 size={16} />
              Módulos por Empresa (Planos)
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo Principal: Layout Master-Detail */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* =========================================================================
            ABA 1: ACESSOS POR USUÁRIO (Para Admin e Superadmin)
           ========================================================================= */}
        {activeTab === 'users' && (
          <>
            {/* Coluna Esquerda: Lista de Usuários */}
            <div 
              style={{
                width: '320px',
                minWidth: '320px',
                borderRight: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}
            >
              {/* Barra de Pesquisa de Usuários */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div 
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text"
                    placeholder="Buscar usuário ou cargo..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  {userSearchTerm && (
                    <button 
                      onClick={() => setUserSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista Scrollável de Usuários */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Nenhum usuário encontrado.
                  </div>
                ) : (
                  filteredUsers.map(userItem => {
                    const isSelected = userItem.id === selectedUserId;
                    const screenCount = Array.isArray(userItem.allowedScreens) 
                      ? userItem.allowedScreens.length 
                      : (userItem.role === 'admin' || userItem.role === 'superadmin' ? modules.length : 5);

                    return (
                      <div
                        key={userItem.id}
                        onClick={() => handleSelectUser(userItem)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          marginBottom: '6px',
                          backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'var(--transition)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        {/* Avatar */}
                        <div 
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: isSelected ? 'var(--primary)' : (userItem.jobRoleColor || 'var(--bg-tertiary)'),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            flexShrink: 0
                          }}
                        >
                          {(userItem.name || 'U').charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span 
                              style={{ 
                                fontWeight: 600, 
                                fontSize: '0.88rem', 
                                color: isSelected ? '#fff' : 'var(--text-main)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {userItem.name}
                            </span>
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                padding: '1px 6px', 
                                borderRadius: '4px',
                                backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-input)',
                                color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 600,
                                flexShrink: 0
                              }}
                            >
                              {screenCount} telas
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span 
                              style={{ 
                                fontSize: '0.74rem', 
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {userItem.jobRoleName || (userItem.role === 'superadmin' ? 'Superadmin' : userItem.role === 'admin' ? 'Administrador' : 'Atendente')}
                            </span>
                            {userItem.companyName && isSuperAdmin && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', opacity: 0.85 }}>
                                • {userItem.companyName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Coluna Direita: Grade de Telas e Permissões do Usuário */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {selectedUser ? (
                <>
                  {/* Cabeçalho do Usuário Selecionado */}
                  <div 
                    style={{
                      padding: '16px 28px',
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                      flexShrink: 0
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                          Permissões de: <span style={{ color: 'var(--primary)' }}>{selectedUser.name}</span>
                        </h3>
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {selectedUser.email}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        Marque as telas que este usuário poderá visualizar e interagir no menu principal.
                      </p>
                    </div>

                    {/* Presets Rápidos */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Modelos Rápidos:
                      </span>
                      <button
                        onClick={() => applyUserPreset('all')}
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Liberar todas as telas permitidas"
                      >
                        <Check size={12} style={{ color: 'var(--primary)' }} />
                        Liberar Todas
                      </button>

                      <button
                        onClick={() => applyUserPreset('chat_basic')}
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                        title="Chat, Contatos, Respostas Rápidas e Etiquetas"
                      >
                        💬 Atendente Básico
                      </button>

                      <button
                        onClick={() => applyUserPreset('crm_sales')}
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                        title="Dashboard, Chat, Kanban, Contatos e Respostas"
                      >
                        📊 Vendedor / CRM
                      </button>

                      <button
                        onClick={() => applyUserPreset('clear')}
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Desmarcar todas"
                      >
                        <X size={12} />
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  {/* Grade de Módulos Scrollável */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    {Object.entries(modulesByCategory).map(([category, catModules]) => (
                      <div key={category} style={{ marginBottom: '28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                            {category}
                          </span>
                          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
                        </div>

                        <div 
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: '14px' 
                          }}
                        >
                          {catModules.map(moduleItem => {
                            const IconComponent = ICON_MAP[moduleItem.icon] || LayoutDashboard;
                            const isChecked = selectedUserScreens.includes(moduleItem.id);
                            const isAllowedByCompany = isModuleAllowedByCompany(moduleItem.id);

                            return (
                              <div
                                key={moduleItem.id}
                                onClick={() => isAllowedByCompany && toggleUserScreen(moduleItem.id)}
                                style={{
                                  padding: '16px',
                                  borderRadius: '12px',
                                  backgroundColor: isChecked ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
                                  border: isChecked 
                                    ? '1px solid rgba(16, 185, 129, 0.5)' 
                                    : '1px solid var(--border-subtle)',
                                  boxShadow: isChecked ? '0 0 20px rgba(16, 185, 129, 0.1)' : 'none',
                                  cursor: isAllowedByCompany ? 'pointer' : 'not-allowed',
                                  opacity: isAllowedByCompany ? 1 : 0.45,
                                  transition: 'var(--transition)',
                                  position: 'relative',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div 
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        backgroundColor: isChecked ? 'var(--primary)' : 'var(--bg-tertiary)',
                                        color: isChecked ? '#fff' : 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'var(--transition)'
                                      }}
                                    >
                                      <IconComponent size={20} />
                                    </div>
                                    <div>
                                      <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {moduleItem.label}
                                      </h4>
                                    </div>
                                  </div>

                                  {/* Switch / Toggle Visual */}
                                  <div 
                                    style={{
                                      width: '42px',
                                      height: '24px',
                                      borderRadius: '12px',
                                      backgroundColor: isChecked ? 'var(--primary)' : 'var(--bg-input)',
                                      border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                      position: 'relative',
                                      transition: 'var(--transition)',
                                      flexShrink: 0
                                    }}
                                  >
                                    <div 
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        position: 'absolute',
                                        top: '2px',
                                        left: isChecked ? '20px' : '2px',
                                        transition: 'var(--transition)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                      }}
                                    />
                                  </div>
                                </div>

                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                  {moduleItem.description}
                                </p>

                                {!isAllowedByCompany && (
                                  <div 
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '0.72rem',
                                      color: '#f59e0b',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                      border: '1px solid rgba(245, 158, 11, 0.2)'
                                    }}
                                  >
                                    <Lock size={12} />
                                    <span>Bloqueado no plano da empresa</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra Flutuante de Salvamento */}
                  <div 
                    style={{
                      padding: '16px 28px',
                      borderTop: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        Total de telas liberadas: <strong style={{ color: 'var(--primary)' }}>{selectedUserScreens.length}</strong> de {modules.length}
                      </span>
                      {hasUserChanges && (
                        <span 
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontWeight: 600
                          }}
                        >
                          Alterações não salvas
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleSaveUserPermissions}
                      disabled={saving || !hasUserChanges}
                      style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: hasUserChanges ? 'var(--primary)' : 'var(--bg-tertiary)',
                        color: hasUserChanges ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: hasUserChanges ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'var(--transition)',
                        boxShadow: hasUserChanges ? '0 4px 14px var(--primary-glow)' : 'none'
                      }}
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Salvar Permissões do Usuário
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Selecione um usuário à esquerda para configurar as permissões.
                </div>
              )}
            </div>
          </>
        )}

        {/* =========================================================================
            ABA 2: MÓDULOS POR EMPRESA (Apenas Superadmin)
           ========================================================================= */}
        {activeTab === 'companies' && isSuperAdmin && (
          <>
            {/* Coluna Esquerda: Lista de Empresas */}
            <div 
              style={{
                width: '320px',
                minWidth: '320px',
                borderRight: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}
            >
              {/* Barra de Pesquisa de Empresas */}
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div 
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text"
                    placeholder="Buscar empresa ou CNPJ..."
                    value={companySearchTerm}
                    onChange={(e) => setCompanySearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  {companySearchTerm && (
                    <button 
                      onClick={() => setCompanySearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista Scrollável de Empresas */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {filteredCompanies.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Nenhuma empresa encontrada.
                  </div>
                ) : (
                  filteredCompanies.map(compItem => {
                    const isSelected = compItem.id === selectedCompanyId;
                    const screenCount = Array.isArray(compItem.allowedScreens) 
                      ? compItem.allowedScreens.length 
                      : modules.length;

                    return (
                      <div
                        key={compItem.id}
                        onClick={() => handleSelectCompany(compItem)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          marginBottom: '6px',
                          backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'var(--transition)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        {/* Ícone */}
                        <div 
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-tertiary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Building2 size={20} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span 
                              style={{ 
                                fontWeight: 600, 
                                fontSize: '0.88rem', 
                                color: isSelected ? '#fff' : 'var(--text-main)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {compItem.name}
                            </span>
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                padding: '1px 6px', 
                                borderRadius: '4px',
                                backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-input)',
                                color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 600,
                                flexShrink: 0
                              }}
                            >
                              {screenCount} módulos
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {compItem.cnpj || 'CNPJ não informado'}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              • {compItem.userCount || 0} usuários
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Coluna Direita: Módulos do Plano da Empresa */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {selectedCompany ? (
                <>
                  <div 
                    style={{
                      padding: '16px 28px',
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                      flexShrink: 0
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                          Módulos Contratados: <span style={{ color: 'var(--primary)' }}>{selectedCompany.name}</span>
                        </h3>
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-muted)'
                          }}
                        >
                          ID: {selectedCompany.id}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        Os módulos desmarcados aqui ficarão bloqueados para todos os administradores e atendentes desta empresa.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setSelectedCompanyScreens(modules.map(m => m.id));
                          setHasCompanyChanges(true);
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                      >
                        Marcar Todos
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCompanyScreens([]);
                          setHasCompanyChanges(true);
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                  </div>

                  {/* Grade de Módulos da Empresa */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    {Object.entries(modulesByCategory).map(([category, catModules]) => (
                      <div key={category} style={{ marginBottom: '28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--secondary)' }}>
                            {category}
                          </span>
                          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
                        </div>

                        <div 
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: '14px' 
                          }}
                        >
                          {catModules.map(moduleItem => {
                            const IconComponent = ICON_MAP[moduleItem.icon] || LayoutDashboard;
                            const isChecked = selectedCompanyScreens.includes(moduleItem.id);

                            return (
                              <div
                                key={moduleItem.id}
                                onClick={() => toggleCompanyScreen(moduleItem.id)}
                                style={{
                                  padding: '16px',
                                  borderRadius: '12px',
                                  backgroundColor: isChecked ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
                                  border: isChecked 
                                    ? '1px solid rgba(99, 102, 241, 0.5)' 
                                    : '1px solid var(--border-subtle)',
                                  boxShadow: isChecked ? '0 0 20px rgba(99, 102, 241, 0.1)' : 'none',
                                  cursor: 'pointer',
                                  transition: 'var(--transition)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div 
                                      style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        backgroundColor: isChecked ? 'var(--secondary)' : 'var(--bg-tertiary)',
                                        color: isChecked ? '#fff' : 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'var(--transition)'
                                      }}
                                    >
                                      <IconComponent size={20} />
                                    </div>
                                    <div>
                                      <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {moduleItem.label}
                                      </h4>
                                    </div>
                                  </div>

                                  {/* Switch / Toggle Visual */}
                                  <div 
                                    style={{
                                      width: '42px',
                                      height: '24px',
                                      borderRadius: '12px',
                                      backgroundColor: isChecked ? 'var(--secondary)' : 'var(--bg-input)',
                                      border: isChecked ? '1px solid var(--secondary)' : '1px solid var(--border-subtle)',
                                      position: 'relative',
                                      transition: 'var(--transition)',
                                      flexShrink: 0
                                    }}
                                  >
                                    <div 
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        position: 'absolute',
                                        top: '2px',
                                        left: isChecked ? '20px' : '2px',
                                        transition: 'var(--transition)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                      }}
                                    />
                                  </div>
                                </div>

                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                  {moduleItem.description}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra Flutuante de Salvamento da Empresa */}
                  <div 
                    style={{
                      padding: '16px 28px',
                      borderTop: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        Módulos liberados no plano: <strong style={{ color: 'var(--secondary)' }}>{selectedCompanyScreens.length}</strong> de {modules.length}
                      </span>
                      {hasCompanyChanges && (
                        <span 
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontWeight: 600
                          }}
                        >
                          Alterações não salvas
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleSaveCompanyPermissions}
                      disabled={saving || !hasCompanyChanges}
                      style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: hasCompanyChanges ? 'var(--secondary)' : 'var(--bg-tertiary)',
                        color: hasCompanyChanges ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: hasCompanyChanges ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'var(--transition)',
                        boxShadow: hasCompanyChanges ? '0 4px 14px var(--secondary-glow)' : 'none'
                      }}
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Salvar Módulos da Empresa
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Selecione uma empresa à esquerda para configurar os módulos do plano.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
