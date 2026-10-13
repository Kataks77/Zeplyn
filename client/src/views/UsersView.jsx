import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  Plus, 
  Trash2, 
  Shield, 
  User, 
  X, 
  Power, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Search, 
  KeyRound, 
  Edit3, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  Phone, 
  ShieldAlert,
  Users as UsersIcon,
  ShieldCheck,
  RefreshCw,
  Filter,
  Briefcase,
  Check,
  Copy,
  Sparkles,
  Send
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';
import RolesView from './RolesView';

// Modelos de Acesso Rápidos Pré-definidos
export const ACCESS_PRESETS = [
  {
    id: 'chat_basic',
    name: 'Atendimento Básico',
    icon: '💬',
    badge: 'Atendimento',
    color: '#10b981',
    description: 'Chat ao vivo, contatos CRM, respostas rápidas e etiquetas de clientes.',
    screens: ['chat', 'contacts', 'quick_messages', 'tags']
  },
  {
    id: 'crm_sales',
    name: 'Comercial & Vendas',
    icon: '📊',
    badge: 'Vendas & CRM',
    color: '#3b82f6',
    description: 'Dashboard geral, Chat ao vivo, Kanban comercial, contatos, respostas rápidas, agendamentos e catálogo de produtos.',
    screens: ['dashboard', 'chat', 'kanban', 'appointments', 'contacts', 'products', 'quick_messages', 'tags']
  },
  {
    id: 'supervisor',
    name: 'Supervisor / Gestor',
    icon: '👁️',
    badge: 'Supervisão',
    color: '#8b5cf6',
    description: 'Dashboard, Relatórios analíticos com notas CSAT, Chat, Kanban, contatos, agendamentos, produtos e respostas rápidas.',
    screens: ['dashboard', 'reports', 'chat', 'kanban', 'appointments', 'contacts', 'products', 'quick_messages', 'tags']
  },
  {
    id: 'full_operational',
    name: 'Acesso Total Operacional',
    icon: '⚡',
    badge: 'Operação Completa',
    color: '#f59e0b',
    description: 'Todos os módulos do sistema (inclusive IA, Bots, Fluxos URA, Campanhas, Catálogo de Produtos e Conexões WhatsApp).',
    screens: ['dashboard', 'reports', 'chat', 'kanban', 'appointments', 'contacts', 'products', 'quick_messages', 'tags', 'connections', 'bots', 'flows', 'campaigns']
  },
  {
    id: 'custom',
    name: 'Personalizado',
    icon: '⚙️',
    badge: 'Manual',
    color: '#64748b',
    description: 'Escolha tela por tela exatamente o que este atendente poderá visualizar.',
    screens: []
  }
];

export const AVAILABLE_SCREEN_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard Geral', icon: '📊' },
  { id: 'reports', label: 'Relatórios & Métricas', icon: '📈' },
  { id: 'chat', label: 'Chat ao Vivo', icon: '💬' },
  { id: 'kanban', label: 'Quadro Kanban', icon: '📋' },
  { id: 'appointments', label: 'Agenda & Lembretes', icon: '📅' },
  { id: 'contacts', label: 'Contatos & CRM', icon: '👥' },
  { id: 'products', label: 'Produtos & Catálogo', icon: '📦' },
  { id: 'quick_messages', label: 'Respostas Rápidas', icon: '⚡' },
  { id: 'tags', label: 'Etiquetas', icon: '🏷️' },
  { id: 'connections', label: 'Conexões WhatsApp', icon: '📱' },
  { id: 'bots', label: 'Bots & IA', icon: '🤖' },
  { id: 'flows', label: 'Fluxos & Menus', icon: '🔀' },
  { id: 'campaigns', label: 'Disparos em Massa', icon: '📢' },
  { id: 'users', label: 'Gestão de Equipe', icon: '👤' }
];

export const detectPreset = (allowedScreens) => {
  if (!allowedScreens || !Array.isArray(allowedScreens) || allowedScreens.length === 0) {
    return 'chat_basic';
  }
  const sorted = [...allowedScreens].sort();
  for (const preset of ACCESS_PRESETS) {
    if (preset.id === 'custom') continue;
    const presetSorted = [...preset.screens].sort();
    if (presetSorted.length === sorted.length && presetSorted.every((v, i) => v === sorted[i])) {
      return preset.id;
    }
  }
  return 'custom';
};

export default function UsersView({ initialTab = 'users' }) {
  const currentUser = getStoredUser();
  const [activeTab, setActiveTab] = useState(initialTab);
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = currentUser?.role === 'admin';
  const canManage = isSuperAdmin || isAdmin;

  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState(() => {
    return window.sessionStorage.getItem('initial_users_company_filter') || 'all';
  });
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedPresetFilter, setSelectedPresetFilter] = useState('all');

  // Modal de sucesso de criação com compartilhamento rápido
  const [createdSuccessInfo, setCreatedSuccessInfo] = useState(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  useEffect(() => {
    window.sessionStorage.removeItem('initial_users_company_filter');
  }, []);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Visibilidade de senhas
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Estados dos formulários
  const [createForm, setCreateForm] = useState({
    companyId: '',
    name: '',
    email: '',
    password: '',
    role: 'operator',
    jobRoleId: '',
    phoneNumber: '',
    accessPreset: 'chat_basic',
    allowedScreens: ['chat', 'contacts', 'quick_messages', 'tags']
  });

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'operator',
    jobRoleId: '',
    phoneNumber: '',
    companyId: '',
    accessPreset: 'chat_basic',
    allowedScreens: ['chat', 'contacts', 'quick_messages', 'tags']
  });

  const handlePresetSelect = (presetId, isEdit = false) => {
    const target = ACCESS_PRESETS.find(p => p.id === presetId);
    if (!target) return;
    if (isEdit) {
      setEditForm(prev => ({
        ...prev,
        accessPreset: presetId,
        allowedScreens: presetId === 'custom' ? (prev.allowedScreens || []) : [...target.screens]
      }));
    } else {
      setCreateForm(prev => ({
        ...prev,
        accessPreset: presetId,
        allowedScreens: presetId === 'custom' ? (prev.allowedScreens || []) : [...target.screens]
      }));
    }
  };

  const handleToggleScreen = (screenId, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => {
        const current = prev.allowedScreens || [];
        const updated = current.includes(screenId)
          ? current.filter(id => id !== screenId)
          : [...current, screenId];
        return {
          ...prev,
          accessPreset: 'custom',
          allowedScreens: updated
        };
      });
    } else {
      setCreateForm(prev => {
        const current = prev.allowedScreens || [];
        const updated = current.includes(screenId)
          ? current.filter(id => id !== screenId)
          : [...current, screenId];
        return {
          ...prev,
          accessPreset: 'custom',
          allowedScreens: updated
        };
      });
    }
  };

  const [targetUserForPassword, setTargetUserForPassword] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const promises = [
        api.getUsers(),
        isSuperAdmin ? api.getCompanies().catch(() => []) : Promise.resolve([]),
        api.getRoles().catch(() => [])
      ];
      const [usersData, companiesData, rolesData] = await Promise.all(promises);

      if (Array.isArray(usersData)) {
        setUsers(usersData);
      }
      if (Array.isArray(companiesData)) {
        setCompanies(companiesData);
        // Preselecionar a primeira empresa se houver e for superadmin
        if (companiesData.length > 0 && !createForm.companyId && isSuperAdmin) {
          setCreateForm(prev => ({ ...prev, companyId: companiesData[0].id }));
        }
      }
      if (Array.isArray(rolesData)) {
        setRoles(rolesData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showToast(err.message || 'Erro ao carregar lista de usuários e equipe', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      loadData();
    }
  }, [canManage]);

  // Se não for superadmin nem admin da empresa, bloquear acesso
  if (!canManage) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: 'calc(100vh - 70px)',
          padding: '24px',
          textAlign: 'center'
        }}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}
        >
          <ShieldAlert size={32} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
          Acesso Restrito
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '440px', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Apenas administradores e gestores possuem permissão para gerenciar os membros da equipe e atendentes.
        </p>
      </div>
    );
  }

  // Filtragem de usuários
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Filtro de texto (nome, email, telefone)
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        (user.name && user.name.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.companyName && user.companyName.toLowerCase().includes(term)) ||
        (user.phoneNumber && user.phoneNumber.includes(term));

      // Filtro de empresa (apenas para superadmin; admin vê apenas sua própria empresa)
      const matchesCompany = !isSuperAdmin || selectedCompanyFilter === 'all' || user.companyId === selectedCompanyFilter;

      // Filtro de cargo
      const matchesRole = selectedRoleFilter === 'all' || user.role === selectedRoleFilter;

      // Filtro de status
      const matchesStatus = selectedStatusFilter === 'all' || 
        (selectedStatusFilter === 'active' && user.isActive !== false) ||
        (selectedStatusFilter === 'suspended' && user.isActive === false);

      // Filtro por Modelo de Acesso (Preset)
      const matchesPreset = selectedPresetFilter === 'all' || (() => {
        if (selectedPresetFilter === 'admin_full') {
          return user.role === 'admin' || user.role === 'superadmin';
        }
        if (user.role === 'admin' || user.role === 'superadmin') {
          return false;
        }
        return detectPreset(user.allowedScreens) === selectedPresetFilter;
      })();

      return matchesSearch && matchesCompany && matchesRole && matchesStatus && matchesPreset;
    });
  }, [users, searchTerm, selectedCompanyFilter, selectedRoleFilter, selectedStatusFilter, selectedPresetFilter, isSuperAdmin]);

  // Estatísticas rápidas
  const totalUsers = users.length;
  const operatorCount = users.filter(u => u.role === 'operator').length;
  const adminCount = users.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
  const distinctCompaniesWithUsers = new Set(users.map(u => u.companyId).filter(Boolean)).size;

  // Criação de usuário com vínculo à empresa
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const targetCompanyId = isSuperAdmin ? createForm.companyId : (currentUser?.companyId || 'company_default');
    if (!targetCompanyId) {
      showToast('Selecione a empresa à qual o usuário será vinculado.', 'error');
      return;
    }
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      showToast('Nome, e-mail e senha são obrigatórios.', 'error');
      return;
    }
    if (createForm.password.length < 8) {
      showToast('A senha deve conter no mínimo 8 caracteres.', 'error');
      return;
    }

    try {
      const finalRole = (!isSuperAdmin && createForm.role === 'superadmin') ? 'admin' : createForm.role;
      const finalScreens = finalRole === 'operator'
        ? (createForm.accessPreset === 'custom'
            ? createForm.allowedScreens
            : (ACCESS_PRESETS.find(p => p.id === createForm.accessPreset)?.screens || ['chat', 'contacts', 'quick_messages', 'tags']))
        : null;

      await api.createUser({
        ...createForm,
        companyId: targetCompanyId,
        role: finalRole,
        allowedScreens: finalScreens
      });

      // Abre o modal de sucesso com compartilhamento rápido de credenciais
      const activePresetObj = ACCESS_PRESETS.find(p => p.id === createForm.accessPreset) || ACCESS_PRESETS[0];
      setCreatedSuccessInfo({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        phoneNumber: createForm.phoneNumber,
        role: finalRole,
        preset: activePresetObj,
        companyName: isSuperAdmin ? (companies.find(c => c.id === targetCompanyId)?.name || 'Empresa') : (currentUser?.companyName || 'Sua Empresa')
      });

      showToast(isSuperAdmin ? `Usuário "${createForm.name}" criado com sucesso!` : `Membro "${createForm.name}" adicionado à equipe com sucesso!`, 'success');
      setShowCreateModal(false);
      setCreateForm({
        companyId: isSuperAdmin ? (companies.length > 0 ? companies[0].id : '') : (currentUser?.companyId || ''),
        name: '',
        email: '',
        password: '',
        role: 'operator',
        jobRoleId: '',
        phoneNumber: '',
        accessPreset: 'chat_basic',
        allowedScreens: ['chat', 'contacts', 'quick_messages', 'tags']
      });
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao criar usuário', 'error');
    }
  };

  // Edição de usuário
  const openEditModal = (user) => {
    const preset = detectPreset(user.allowedScreens);
    const screens = Array.isArray(user.allowedScreens) && user.allowedScreens.length > 0
      ? user.allowedScreens
      : (ACCESS_PRESETS.find(p => p.id === preset)?.screens || ['chat', 'contacts', 'quick_messages', 'tags']);

    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'operator',
      jobRoleId: user.jobRoleId || '',
      phoneNumber: user.phoneNumber || '',
      companyId: user.companyId || (companies[0]?.id || currentUser?.companyId || ''),
      accessPreset: preset,
      allowedScreens: screens
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const finalRole = (!isSuperAdmin && editForm.role === 'superadmin') ? 'admin' : editForm.role;
      const finalScreens = finalRole === 'operator'
        ? (editForm.accessPreset === 'custom'
            ? editForm.allowedScreens
            : (ACCESS_PRESETS.find(p => p.id === editForm.accessPreset)?.screens || ['chat', 'contacts', 'quick_messages', 'tags']))
        : null;

      await api.updateUser(editingUser.id, {
        ...editForm,
        role: finalRole,
        allowedScreens: finalScreens
      });
      showToast(`Usuário "${editForm.name}" atualizado com sucesso!`, 'success');
      setShowEditModal(false);
      setEditingUser(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar usuário', 'error');
    }
  };

  // Redefinição de senha
  const openPasswordModal = (user) => {
    setTargetUserForPassword(user);
    setNewPasswordValue('');
    setShowPasswordModal(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserForPassword || !newPasswordValue || newPasswordValue.length < 8) {
      showToast('A nova senha deve ter no mínimo 8 caracteres.', 'error');
      return;
    }

    try {
      await api.updateUser(targetUserForPassword.id, { password: newPasswordValue });
      showToast(`Senha de "${targetUserForPassword.name}" atualizada com sucesso!`, 'success');
      setShowPasswordModal(false);
      setTargetUserForPassword(null);
      setNewPasswordValue('');
    } catch (err) {
      showToast(err.message || 'Erro ao redefinir senha', 'error');
    }
  };

  // Alteração de status (Ativo / Suspenso)
  const handleToggleActive = async (u) => {
    if (currentUser && currentUser.id === u.id) {
      showToast('Você não pode suspender sua própria conta superadmin conectada.', 'error');
      return;
    }

    const nextIsActive = u.isActive === false;

    // Atualização otimista
    setUsers(prev => prev.map(user => user.id === u.id ? { ...user, isActive: nextIsActive } : user));

    try {
      await api.updateUser(u.id, { isActive: nextIsActive });
      showToast(`Usuário "${u.name}" ${nextIsActive ? 'reativado' : 'suspenso'} com sucesso!`, 'success');
      loadData();
    } catch (err) {
      // Reverter
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, isActive: !nextIsActive } : user));
      showToast(err.message || 'Erro ao alterar status do usuário', 'error');
    }
  };

  // Exclusão de usuário
  const handleDelete = async (u) => {
    if (currentUser && currentUser.id === u.id) {
      showToast('Você não pode excluir sua própria conta conectada.', 'error');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${u.name}" (${u.email})? Esta ação é irreversível.`)) {
      return;
    }

    try {
      await api.deleteUser(u.id);
      showToast(`Usuário "${u.name}" excluído com sucesso.`, 'success');
      loadData();
    } catch (err) {
      showToast(`Erro ao excluir: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      
      {/* BANNER PRINCIPAL COM IDENTIDADE ADAPTATIVA (SUPERADMIN OU ADMIN DA EMPRESA) */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '20px',
          padding: '24px 28px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '4px 10px', 
            borderRadius: '20px', 
            backgroundColor: isSuperAdmin ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.12)', 
            border: `1px solid ${isSuperAdmin ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`, 
            color: isSuperAdmin ? '#818cf8' : '#10b981', 
            fontSize: '0.74rem', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em', 
            marginBottom: '8px' 
          }}>
            {isSuperAdmin ? <ShieldCheck size={13} /> : <UsersIcon size={13} />}
            <span>{isSuperAdmin ? 'Controle Central do Superadmin' : `Gestão de Equipe • ${currentUser?.companyName || 'Sua Empresa'}`}</span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            {isSuperAdmin ? 'Gestão Global de Usuários & Acessos' : 'Minha Equipe & Atendentes'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px', maxWidth: '640px' }}>
            {isSuperAdmin 
              ? 'Crie e gerencie os acessos de usuários vinculados às empresas cadastradas no sistema. Visão administrativa completa de todos os tenants.'
              : 'Cadastre, edite e acompanhe os operadores, atendentes e gestores da sua empresa. Atribua cargos internos e departamentos para o fluxo de atendimento.'
            }
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={loadData}
            className="btn btn-secondary"
            title="Atualizar lista"
            style={{ padding: '10px 14px', borderRadius: '12px' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button 
            onClick={() => {
              if (isSuperAdmin && companies.length === 0) {
                showToast('Cadastre ao menos uma Empresa antes de criar usuários vinculados.', 'error');
                return;
              }
              setCreateForm(prev => ({
                ...prev,
                companyId: isSuperAdmin ? (prev.companyId || companies[0]?.id || '') : (currentUser?.companyId || 'company_default'),
                role: 'operator'
              }));
              setShowCreateModal(true);
            }} 
            className="btn btn-primary"
            style={{ 
              padding: '10px 18px', 
              borderRadius: '12px', 
              boxShadow: '0 4px 14px var(--primary-glow)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700
            }}
          >
            <Plus size={18} /> {isSuperAdmin ? 'Novo Usuário Vinculado' : 'Novo Membro da Equipe'}
          </button>
        </div>
      </div>

      {/* SELETOR DE ABAS UNIFICADO (USUÁRIOS / CARGOS) */}
      <div 
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px'
        }}
      >
        <button
          onClick={() => setActiveTab('users')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            border: activeTab === 'users' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
            backgroundColor: activeTab === 'users' ? 'var(--primary-subtle)' : 'var(--bg-secondary)',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          <UsersIcon size={18} />
          <span>Membros da Equipe ({totalUsers})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            border: activeTab === 'roles' ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
            backgroundColor: activeTab === 'roles' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
            color: activeTab === 'roles' ? '#818cf8' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          <Briefcase size={18} />
          <span>Cargos & Departamentos</span>
        </button>
      </div>

      {activeTab === 'roles' ? (
        <RolesView embedded={true} />
      ) : (
        <>
          {/* CARDS DE RESUMO / MÉTRICAS RÁPIDAS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {isSuperAdmin ? 'Total de Usuários' : 'Total na Equipe'}
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UsersIcon size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalUsers}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {isSuperAdmin ? 'Acessos cadastrados na plataforma' : 'Colaboradores cadastrados na empresa'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Operadores & Atendentes</span>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{operatorCount}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Atendimento direto via WhatsApp</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {isSuperAdmin ? 'Administradores' : 'Gestores da Empresa'}
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#06b6d4' }}>{adminCount}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {isSuperAdmin ? 'Gestores de empresas e superadmins' : 'Administradores com permissão de gestão'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {isSuperAdmin ? 'Empresas Atendidas' : 'Status da Equipe'}
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isSuperAdmin ? <Building2 size={17} /> : <CheckCircle2 size={17} />}
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>
            {isSuperAdmin ? distinctCompaniesWithUsers : users.filter(u => u.isActive !== false).length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {isSuperAdmin ? `De ${companies.length} empresas totais no SaaS` : 'Atendentes ativos para receber chamados'}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS AVANÇADOS */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center'
        }}
      >
        {/* Campo de Busca */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, telefone ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '38px', borderRadius: '10px', height: '42px', fontSize: '0.86rem' }}
          />
        </div>

        {/* Filtro por Empresa (Exclusivo para Superadmin) */}
        {isSuperAdmin ? (
          <div style={{ minWidth: '200px' }}>
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              style={{ width: '100%', borderRadius: '10px', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">🏢 Todas as Empresas ({companies.length})</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.cnpj ? `(${c.cnpj})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '0 16px', 
              height: '42px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(255, 255, 255, 0.03)', 
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.86rem',
              fontWeight: 600
            }}
          >
            <Building2 size={15} color="var(--primary)" />
            <span>{currentUser?.companyName || 'Sua Empresa'}</span>
          </div>
        )}

        {/* Filtro por Cargo */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            style={{ width: '100%', borderRadius: '10px', height: '42px', fontSize: '0.86rem' }}
          >
            <option value="all">🛡️ Todos os Cargos</option>
            <option value="operator">Operador / Atendente</option>
            <option value="admin">Administrador da Empresa</option>
            <option value="superadmin">Super Administrador</option>
          </select>
        </div>

        {/* Filtro por Status */}
        <div style={{ minWidth: '140px' }}>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            style={{ width: '100%', borderRadius: '10px', height: '42px', fontSize: '0.86rem' }}
          >
            <option value="all">● Todos os Status</option>
            <option value="active">● Somente Ativos</option>
            <option value="suspended">● Somente Suspensos</option>
          </select>
        </div>

        {/* Filtro por Modelo de Acesso */}
        <div style={{ minWidth: '175px' }}>
          <select
            value={selectedPresetFilter}
            onChange={(e) => setSelectedPresetFilter(e.target.value)}
            style={{ width: '100%', borderRadius: '10px', height: '42px', fontSize: '0.86rem' }}
          >
            <option value="all">⚡ Todos os Modelos</option>
            <option value="chat_basic">💬 Atendimento Básico</option>
            <option value="crm_sales">📊 Comercial & Vendas</option>
            <option value="supervisor">👁️ Supervisor / Gestor</option>
            <option value="full_operational">⚡ Operação Completa</option>
            <option value="custom">⚙️ Personalizado</option>
            <option value="admin_full">🛡️ Administrador (Total)</option>
          </select>
        </div>

        {(searchTerm || selectedCompanyFilter !== 'all' || selectedRoleFilter !== 'all' || selectedStatusFilter !== 'all' || selectedPresetFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCompanyFilter('all');
              setSelectedRoleFilter('all');
              setSelectedStatusFilter('all');
              setSelectedPresetFilter('all');
            }}
            className="btn btn-secondary"
            style={{ height: '42px', padding: '0 14px', fontSize: '0.82rem', borderRadius: '10px' }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* TABELA DE USUÁRIOS */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-tertiary)' }}>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Usuário</th>
              {isSuperAdmin && <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Empresa Vinculada</th>}
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Cargo / Nível</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Telefone</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={20} className="animate-spin" color="var(--primary)" />
                    <span>Carregando usuários do sistema...</span>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <UsersIcon size={42} style={{ opacity: 0.25, marginBottom: '12px' }} />
                  <div style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Nenhum usuário encontrado com os filtros selecionados
                  </div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                    Tente ajustar sua busca ou adicione um novo usuário à equipe.
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map(u => {
                const isSuper = u.role === 'superadmin';
                const isAdmin = u.role === 'admin';
                const compName = u.companyName || companies.find(c => c.id === u.companyId)?.name || 'Empresa Padrão';

                return (
                  <tr 
                    key={u.id}
                    style={{ 
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease'
                    }}
                    className="table-row-hover"
                  >
                    {/* Usuário (Nome + E-mail + Avatar) */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div 
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: isSuper 
                              ? 'rgba(168, 85, 247, 0.15)' 
                              : isAdmin 
                              ? 'rgba(99, 102, 241, 0.15)' 
                              : 'rgba(16, 185, 129, 0.15)',
                            color: isSuper ? '#a855f7' : isAdmin ? '#818cf8' : '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            flexShrink: 0
                          }}
                        >
                          {(u.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Empresa Vinculada (Exclusivo para Superadmin) */}
                    {isSuperAdmin && (
                      <td style={{ padding: '14px 20px' }}>
                        <div 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <Building2 size={13} color="var(--primary)" />
                          <span>{compName}</span>
                        </div>
                      </td>
                    )}

                    {/* Cargo / Nível de Acesso */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            backgroundColor: isSuper 
                              ? 'rgba(168, 85, 247, 0.15)' 
                              : isAdmin 
                              ? 'rgba(99, 102, 241, 0.15)' 
                              : 'rgba(16, 185, 129, 0.15)',
                            color: isSuper ? '#c084fc' : isAdmin ? '#818cf8' : '#10b981',
                            border: `1px solid ${isSuper ? 'rgba(168, 85, 247, 0.3)' : isAdmin ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                          }}
                        >
                          {isSuper ? <ShieldCheck size={13} /> : isAdmin ? <Shield size={13} /> : <User size={13} />}
                          {isSuper ? 'Super Administrador' : isAdmin ? 'Administrador da Empresa' : 'Operador / Atendente'}
                        </span>

                        {/* Modelo de Telas / Acesso do Usuário */}
                        {(() => {
                          if (isSuper || isAdmin) {
                            return (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span>⚡ Acesso Total</span>
                              </span>
                            );
                          }
                          const presetId = detectPreset(u.allowedScreens);
                          const preset = ACCESS_PRESETS.find(p => p.id === presetId);
                          const count = Array.isArray(u.allowedScreens) && u.allowedScreens.length > 0 
                            ? u.allowedScreens.length 
                            : (preset?.screens?.length || 4);
                          return (
                            <span 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                backgroundColor: `${preset?.color || '#10b981'}15`,
                                color: preset?.color || '#10b981',
                                border: `1px solid ${preset?.color || '#10b981'}30`
                              }}
                              title={`Telas permitidas: ${(u.allowedScreens || preset?.screens || []).join(', ')}`}
                            >
                              <span>{preset?.icon || '💬'}</span>
                              <span>{preset?.badge || 'Atendimento'} ({count} telas)</span>
                            </span>
                          );
                        })()}

                        {u.jobRoleName ? (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              backgroundColor: `${u.jobRoleColor || '#6366f1'}18`,
                              color: u.jobRoleColor || '#6366f1',
                              border: `1px solid ${u.jobRoleColor || '#6366f1'}35`
                            }}
                          >
                            <Briefcase size={11} />
                            {u.jobRoleName} {u.department ? `(${u.department})` : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Sem cargo na empresa
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 20px' }}>
                      <button
                        onClick={() => handleToggleActive(u)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                        title={u.isActive !== false ? 'Clique para suspender este usuário' : 'Clique para reativar este usuário'}
                      >
                        {u.isActive !== false ? (
                          <span className="badge-status online" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            ● Ativo
                          </span>
                        ) : (
                          <span className="badge-status finished" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--status-error)' }}>
                            ● Suspenso
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Telefone */}
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {u.phoneNumber ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Phone size={13} style={{ opacity: 0.6 }} />
                          <span>{u.phoneNumber}</span>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.4 }}>-</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Redefinir Senha */}
                        <button 
                          onClick={() => openPasswordModal(u)}
                          disabled={!isSuperAdmin && u.role === 'superadmin'}
                          className="btn-icon"
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            color: 'var(--text-secondary)',
                            opacity: (!isSuperAdmin && u.role === 'superadmin') ? 0.3 : 1 
                          }}
                          title={(!isSuperAdmin && u.role === 'superadmin') ? 'Sem permissão para alterar Superadmin' : 'Alterar/Redefinir senha de acesso'}
                        >
                          <KeyRound size={15} />
                        </button>

                        {/* Editar */}
                        <button 
                          onClick={() => openEditModal(u)}
                          disabled={!isSuperAdmin && u.role === 'superadmin'}
                          className="btn-icon"
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            color: 'var(--text-secondary)',
                            opacity: (!isSuperAdmin && u.role === 'superadmin') ? 0.3 : 1
                          }}
                          title={(!isSuperAdmin && u.role === 'superadmin') ? 'Sem permissão para editar Superadmin' : 'Editar dados do usuário'}
                        >
                          <Edit3 size={15} />
                        </button>

                        {/* Suspender / Ativar */}
                        <button 
                          onClick={() => handleToggleActive(u)}
                          disabled={(!isSuperAdmin && u.role === 'superadmin') || (currentUser && currentUser.id === u.id)}
                          className="btn-icon"
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            color: u.isActive !== false ? 'var(--status-error)' : '#10b981',
                            opacity: ((!isSuperAdmin && u.role === 'superadmin') || (currentUser && currentUser.id === u.id)) ? 0.3 : 1
                          }}
                          title={u.isActive !== false ? 'Suspender Acesso' : 'Reativar Acesso'}
                        >
                          <Power size={15} />
                        </button>

                        {/* Excluir */}
                        <button 
                          onClick={() => handleDelete(u)}
                          disabled={(!isSuperAdmin && u.role === 'superadmin') || (currentUser && currentUser.id === u.id)}
                          className="btn-icon"
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            color: 'var(--status-error)',
                            opacity: ((!isSuperAdmin && u.role === 'superadmin') || (currentUser && currentUser.id === u.id)) ? 0.3 : 1
                          }}
                          title="Excluir usuário permanentemente"
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
      </div>
    </>
  )}

      {/* ========================================================= */}
      {/* MODAL 1: CRIAR NOVO USUÁRIO VINCULADO À EMPRESA (SUPERADMIN) */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={20} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Criar Acesso de Usuário
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Defina as credenciais, o modelo de acesso e vincule à empresa
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* EMPRESA VINCULADA */}
              {isSuperAdmin ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Empresa Vinculada *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={createForm.companyId}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, companyId: e.target.value }))}
                      required
                      style={{ width: '100%', borderRadius: '10px', height: '42px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      <option value="" disabled>Selecione a empresa...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.cnpj ? `— CNPJ: ${c.cnpj}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    O usuário terá acesso restrito exclusivamente aos dados e robôs desta empresa.
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building2 size={18} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Vínculo de Empresa:</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {currentUser?.companyName || 'Sua Empresa'}
                    </div>
                  </div>
                </div>
              )}

              {/* NOME COMPLETO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                />
              </div>

              {/* E-MAIL DE ACESSO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  E-mail de Acesso (Login) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    placeholder="usuario@empresa.com.br"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                  />
                </div>
              </div>

              {/* SENHA DE ACESSO COM TOGGLE */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Senha de Acesso (Mínimo 8 caracteres) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    placeholder="Digite a senha provisória ou definitiva..."
                    value={createForm.password}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={8}
                    style={{ width: '100%', borderRadius: '10px', height: '42px', paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title={showCreatePassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* NÍVEL DE ACESSO / CARGO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Nível de Acesso (Cargo)
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
                    style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                  >
                    <option value="operator">Operador / Atendente</option>
                    <option value="admin">Administrador da Empresa</option>
                    {isSuperAdmin && <option value="superadmin">Super Administrador (Global)</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    WhatsApp / Telefone (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 5511999998888"
                    value={createForm.phoneNumber}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                  />
                </div>
              </div>

              {/* CARGO DA EMPRESA (FUNÇÃO INTERNA / ROUND-ROBIN) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Cargo na Empresa (Atendimento & Fila Equitativa)
                </label>
                <select
                  value={createForm.jobRoleId || ''}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, jobRoleId: e.target.value }))}
                  style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                >
                  <option value="">Nenhum cargo específico atribuído</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.department || 'Geral'}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Usado pelo sistema de Round-Robin para direcionar leads de acordo com o departamento do atendente.
                </div>
              </div>

              {/* MODELO DE ACESSO PRÉ-DEFINIDO (QUICK PRESETS PARA ATENDENTES) */}
              {createForm.role === 'operator' ? (
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Modelo de Acesso às Telas</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                        Configuração Rápida
                      </span>
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {createForm.accessPreset === 'custom' 
                        ? `${createForm.allowedScreens?.length || 0} telas selecionadas`
                        : `${createForm.allowedScreens?.length || 0} telas liberadas`}
                    </span>
                  </div>

                  {/* CARDS DE PRESETS */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                    {ACCESS_PRESETS.map(preset => {
                      const isSelected = createForm.accessPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePresetSelect(preset.id, false)}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: isSelected ? `2px solid ${preset.color}` : '1px solid var(--border-subtle)',
                            backgroundColor: isSelected ? `${preset.color}15` : 'rgba(255, 255, 255, 0.02)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '1.25rem' }}>{preset.icon}</span>
                            {isSelected && <Check size={14} color={preset.color} strokeWidth={3} />}
                          </div>
                          <div style={{ fontSize: '0.79rem', fontWeight: 700, color: isSelected ? preset.color : 'var(--text-main)', lineHeight: '1.2' }}>
                            {preset.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {preset.id === 'custom' ? 'Manual' : `${preset.screens.length} telas`}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* DESCRIÇÃO DO PRESET ATIVO */}
                  {(() => {
                    const activePreset = ACCESS_PRESETS.find(p => p.id === createForm.accessPreset);
                    return (
                      <div style={{ 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        backgroundColor: 'rgba(255, 255, 255, 0.04)', 
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: createForm.accessPreset === 'custom' ? '10px' : '0'
                      }}>
                        <span style={{ fontSize: '1rem' }}>{activePreset?.icon}</span>
                        <span>{activePreset?.description}</span>
                      </div>
                    );
                  })()}

                  {/* CASO PERSONALIZADO: CHECKBOXES DAS TELAS */}
                  {createForm.accessPreset === 'custom' && (
                    <div style={{
                      padding: '10px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-subtle)',
                      marginTop: '8px'
                    }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Marque as telas que o atendente poderá visualizar no menu lateral:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        {AVAILABLE_SCREEN_OPTIONS.map(screen => {
                          const isChecked = createForm.allowedScreens?.includes(screen.id);
                          return (
                            <label
                              key={screen.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                border: isChecked ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.76rem',
                                fontWeight: isChecked ? 600 : 400,
                                color: isChecked ? 'var(--text-main)' : 'var(--text-muted)'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleScreen(screen.id, false)}
                                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                              />
                              <span>{screen.icon} {screen.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#818cf8" />
                  <span style={{ fontSize: '0.78rem', color: '#c7d2fe' }}>
                    {createForm.role === 'superadmin' 
                      ? 'Super Administradores possuem acesso irrestrito a todos os módulos e empresas do SaaS.'
                      : 'Administradores possuem acesso total a todos os módulos e ferramentas contratados pela empresa.'}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ padding: '10px 18px', borderRadius: '10px' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 22px', borderRadius: '10px', fontWeight: 700 }}>
                  Criar e Vincular Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDITAR USUÁRIO & ALTERAR EMPRESA VINCULADA */}
      {/* ========================================================= */}
      {showEditModal && editingUser && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={20} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Editar Dados do Usuário
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Atualize os dados, modelo de acesso e empresa do usuário
                  </p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* EMPRESA VINCULADA (Apenas Superadmin pode transferir de empresa) */}
              {isSuperAdmin ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Empresa Vinculada
                  </label>
                  <select
                    value={editForm.companyId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, companyId: e.target.value }))}
                    required
                    style={{ width: '100%', borderRadius: '10px', height: '42px', fontSize: '0.88rem' }}
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.cnpj ? `— CNPJ: ${c.cnpj}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Empresa: <strong>{currentUser?.companyName || 'Sua Empresa'}</strong>
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  E-mail de Acesso (Login)
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Cargo / Nível
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                    style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                  >
                    <option value="operator">Operador / Atendente</option>
                    <option value="admin">Administrador da Empresa</option>
                    {isSuperAdmin && <option value="superadmin">Super Administrador (Global)</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                  />
                </div>
              </div>

              {/* CARGO DA EMPRESA (FUNÇÃO INTERNA / ROUND-ROBIN) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Cargo na Empresa (Atendimento & Fila Equitativa)
                </label>
                <select
                  value={editForm.jobRoleId || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, jobRoleId: e.target.value }))}
                  style={{ width: '100%', borderRadius: '10px', height: '42px' }}
                >
                  <option value="">Nenhum cargo específico atribuído</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.department || 'Geral'}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Usado pelo sistema de Round-Robin para direcionar leads de acordo com o departamento do atendente.
                </div>
              </div>

              {/* MODELO DE ACESSO PRÉ-DEFINIDO (QUICK PRESETS PARA ATENDENTES) */}
              {editForm.role === 'operator' ? (
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Modelo de Acesso às Telas</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                        Configuração Rápida
                      </span>
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {editForm.accessPreset === 'custom' 
                        ? `${editForm.allowedScreens?.length || 0} telas selecionadas`
                        : `${editForm.allowedScreens?.length || 0} telas liberadas`}
                    </span>
                  </div>

                  {/* CARDS DE PRESETS */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                    {ACCESS_PRESETS.map(preset => {
                      const isSelected = editForm.accessPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePresetSelect(preset.id, true)}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: isSelected ? `2px solid ${preset.color}` : '1px solid var(--border-subtle)',
                            backgroundColor: isSelected ? `${preset.color}15` : 'rgba(255, 255, 255, 0.02)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '1.25rem' }}>{preset.icon}</span>
                            {isSelected && <Check size={14} color={preset.color} strokeWidth={3} />}
                          </div>
                          <div style={{ fontSize: '0.79rem', fontWeight: 700, color: isSelected ? preset.color : 'var(--text-main)', lineHeight: '1.2' }}>
                            {preset.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {preset.id === 'custom' ? 'Manual' : `${preset.screens.length} telas`}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* DESCRIÇÃO DO PRESET ATIVO */}
                  {(() => {
                    const activePreset = ACCESS_PRESETS.find(p => p.id === editForm.accessPreset);
                    return (
                      <div style={{ 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        backgroundColor: 'rgba(255, 255, 255, 0.04)', 
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: editForm.accessPreset === 'custom' ? '10px' : '0'
                      }}>
                        <span style={{ fontSize: '1rem' }}>{activePreset?.icon}</span>
                        <span>{activePreset?.description}</span>
                      </div>
                    );
                  })()}

                  {/* CASO PERSONALIZADO: CHECKBOXES DAS TELAS */}
                  {editForm.accessPreset === 'custom' && (
                    <div style={{
                      padding: '10px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-subtle)',
                      marginTop: '8px'
                    }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Marque as telas que o atendente poderá visualizar no menu lateral:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        {AVAILABLE_SCREEN_OPTIONS.map(screen => {
                          const isChecked = editForm.allowedScreens?.includes(screen.id);
                          return (
                            <label
                              key={screen.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                backgroundColor: isChecked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                border: isChecked ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.76rem',
                                fontWeight: isChecked ? 600 : 400,
                                color: isChecked ? 'var(--text-main)' : 'var(--text-muted)'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleScreen(screen.id, true)}
                                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                              />
                              <span>{screen.icon} {screen.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#818cf8" />
                  <span style={{ fontSize: '0.78rem', color: '#c7d2fe' }}>
                    {editForm.role === 'superadmin' 
                      ? 'Super Administradores possuem acesso irrestrito a todos os módulos e empresas do SaaS.'
                      : 'Administradores possuem acesso total a todos os módulos e ferramentas contratados pela empresa.'}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary" style={{ padding: '10px 18px', borderRadius: '10px' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 22px', borderRadius: '10px', fontWeight: 700 }}>
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: REDEFINIÇÃO RÁPIDA DE SENHA DE USUÁRIO */}
      {/* ========================================================= */}
      {showPasswordModal && targetUserForPassword && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <KeyRound size={20} color="#f59e0b" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Redefinir Senha
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {targetUserForPassword.name} ({targetUserForPassword.email})
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nova Senha de Acesso (Mínimo 8 caracteres) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="Digite a nova senha..."
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    style={{ width: '100%', borderRadius: '10px', height: '42px', paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title={showResetPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn btn-secondary" style={{ padding: '10px 16px', borderRadius: '10px' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700 }}>
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SUCESSO DE CRIAÇÃO COM COMPARTILHAMENTO RÁPIDO   */}
      {/* ========================================================= */}
      {createdSuccessInfo && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              borderRadius: '24px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'center'
            }}
          >
            {/* Ícone de Sucesso */}
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <Sparkles size={32} />
            </div>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
              Usuário Criado com Sucesso!
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              O acesso de <strong>{createdSuccessInfo.name}</strong> já está ativo no sistema. Envie os dados abaixo para o novo membro:
            </p>

            {/* Cartão com Resumo das Credenciais */}
            <div 
              style={{
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'left',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Login (E-mail):</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>{createdSuccessInfo.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Senha Provisória:</span>
                <code style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  {createdSuccessInfo.password}
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Modelo de Acesso:</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: createdSuccessInfo.preset?.color || 'var(--primary)' }}>
                  {createdSuccessInfo.preset?.icon} {createdSuccessInfo.preset?.name}
                </span>
              </div>
              {createdSuccessInfo.phoneNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>WhatsApp:</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{createdSuccessInfo.phoneNumber}</span>
                </div>
              )}
            </div>

            {/* Ações de Compartilhamento */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const portalUrl = window.location.origin;
                  const text = `🚀 *Acesso Liberado ao Sistema Zeplyn!*\n\nOlá *${createdSuccessInfo.name}*, seu acesso de atendimento foi configurado com sucesso.\n\n🔗 *Link de Acesso:* ${portalUrl}\n👤 *Login (E-mail):* ${createdSuccessInfo.email}\n🔑 *Senha:* ${createdSuccessInfo.password}\n💼 *Perfil:* ${createdSuccessInfo.preset?.name || 'Atendimento'}\n\nRecomendamos alterar sua senha no primeiro login em Configurações.`;
                  navigator.clipboard.writeText(text);
                  setCopiedSuccess(true);
                  showToast('Dados de acesso copiados para a área de transferência!', 'success');
                  setTimeout(() => setCopiedSuccess(false), 3000);
                }}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {copiedSuccess ? <Check size={18} /> : <Copy size={18} />}
                <span>{copiedSuccess ? 'Dados Copiados!' : 'Copiar Dados de Acesso'}</span>
              </button>

              {createdSuccessInfo.phoneNumber && (
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = createdSuccessInfo.phoneNumber.replace(/\D/g, '');
                    const portalUrl = window.location.origin;
                    const text = encodeURIComponent(`🚀 *Acesso Liberado ao Sistema Zeplyn!*\n\nOlá *${createdSuccessInfo.name}*, seu acesso de atendimento foi configurado com sucesso.\n\n🔗 *Link de Acesso:* ${portalUrl}\n👤 *Login (E-mail):* ${createdSuccessInfo.email}\n🔑 *Senha:* ${createdSuccessInfo.password}\n💼 *Perfil:* ${createdSuccessInfo.preset?.name || 'Atendimento'}\n\nRecomendamos alterar sua senha no primeiro login.`);
                    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(37, 211, 102, 0.15)',
                    border: '1px solid rgba(37, 211, 102, 0.35)',
                    color: '#25d366',
                    cursor: 'pointer'
                  }}
                >
                  <Send size={18} />
                  <span>Enviar no WhatsApp do Atendente</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCreatedSuccessInfo(null)}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  fontSize: '0.84rem'
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '14px 22px',
            borderRadius: '14px',
            backgroundColor: notification.type === 'error' ? 'var(--status-error)' : '#10b981',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            zIndex: 99999,
            fontWeight: 600,
            fontSize: '0.88rem'
          }}
          className="animate-fade-in"
        >
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

    </div>
  );
}
