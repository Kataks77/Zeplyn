import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Bot, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  X, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  Eye,
  UserCheck,
  RefreshCw,
  Sliders,
  Power,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';

export default function CompaniesView() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'suspended'
  
  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  // Estados selecionados
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyDetails, setCompanyDetails] = useState({ company: null, bots: [], users: [] });
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsTab, setDetailsTab] = useState('overview'); // 'overview', 'bots', 'users'
  const [targetUserForPassword, setTargetUserForPassword] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  // Notificações / Feedback
  const [notification, setNotification] = useState(null);

  // Form de criação de empresa
  const [createForm, setCreateForm] = useState({
    name: '',
    cnpj: '',
    maxBots: 3,
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  });

  // Form de edição de empresa
  const [editForm, setEditForm] = useState({
    name: '',
    cnpj: '',
    maxBots: 3,
    isActive: true
  });

  // Form de adicionar usuário na empresa
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator',
    phoneNumber: ''
  });

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await api.getCompanies();
      if (Array.isArray(data)) {
        setCompanies(data);
      }
    } catch (err) {
      console.error('Erro ao listar empresas:', err);
      showToast(err.message || 'Erro ao carregar empresas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanyDetails = async (companyId) => {
    try {
      setLoadingDetails(true);
      const data = await api.getCompanyDetails(companyId);
      if (data) {
        setCompanyDetails(data);
        if (data.company) {
          setSelectedCompany(prev => ({ ...(prev || {}), ...data.company }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes da empresa:', err);
      showToast(err.message || 'Erro ao carregar detalhes', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const openDetailsModal = (comp) => {
    setSelectedCompany(comp);
    setDetailsTab('overview');
    setShowDetailsModal(true);
    loadCompanyDetails(comp.id);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast('O nome da empresa é obrigatório.', 'error');
      return;
    }
    if (!createForm.adminName.trim() || !createForm.adminEmail.trim() || !createForm.adminPassword) {
      showToast('Dados do administrador da empresa são obrigatórios.', 'error');
      return;
    }
    if (createForm.adminPassword.length < 8) {
      showToast('A senha do administrador deve ter no mínimo 8 caracteres.', 'error');
      return;
    }

    try {
      await api.createCompany(createForm);
      showToast(`Empresa "${createForm.name}" cadastrada com sucesso!`, 'success');
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        cnpj: '',
        maxBots: 3,
        adminName: '',
        adminEmail: '',
        adminPassword: ''
      });
      loadCompanies();
    } catch (err) {
      showToast(err.message || 'Falha ao cadastrar empresa', 'error');
    }
  };

  const openEditModal = (comp) => {
    setSelectedCompany(comp);
    setEditForm({
      name: comp.name || '',
      cnpj: comp.cnpj || '',
      maxBots: comp.maxBots || 3,
      isActive: comp.isActive !== undefined ? comp.isActive : true
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const res = await api.updateCompany(selectedCompany.id, editForm);
      showToast('Empresa atualizada com sucesso!', 'success');
      setShowEditModal(false);

      const updatedComp = res?.company || { ...selectedCompany, ...editForm };
      setSelectedCompany(updatedComp);
      setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? { ...c, ...updatedComp } : c));
      setCompanyDetails(prev => prev && prev.company && prev.company.id === selectedCompany.id
        ? { ...prev, company: { ...prev.company, ...updatedComp } }
        : prev
      );

      loadCompanies();
      if (showDetailsModal) {
        loadCompanyDetails(selectedCompany.id);
      }
    } catch (err) {
      showToast(err.message || 'Falha ao atualizar empresa', 'error');
    }
  };

  const handleToggleActive = async (comp) => {
    if (!comp) return;

    if (comp.id === 'company_default' && comp.isActive) {
      if (!window.confirm('ATENÇÃO: Você está prestes a suspender a Empresa Principal do sistema. Deseja realmente suspender?')) {
        return;
      }
    }

    const nextIsActive = !comp.isActive;

    // Atualização otimista imediata para feedback visual instantâneo
    setCompanies(prev => prev.map(c => c.id === comp.id ? { ...c, isActive: nextIsActive } : c));
    setSelectedCompany(prev => prev && prev.id === comp.id ? { ...prev, isActive: nextIsActive } : prev);
    setCompanyDetails(prev => prev && prev.company && prev.company.id === comp.id 
      ? { ...prev, company: { ...prev.company, isActive: nextIsActive } } 
      : prev
    );

    try {
      const res = await api.updateCompany(comp.id, { isActive: nextIsActive });
      const updatedComp = res?.company || { ...comp, isActive: nextIsActive };

      setCompanies(prev => prev.map(c => c.id === comp.id ? { ...c, ...updatedComp } : c));
      setSelectedCompany(prev => prev && prev.id === comp.id ? { ...prev, ...updatedComp } : prev);
      setCompanyDetails(prev => prev && prev.company && prev.company.id === comp.id 
        ? { ...prev, company: { ...prev.company, ...updatedComp } } 
        : prev
      );

      showToast(`Empresa "${comp.name}" ${nextIsActive ? 'ativada' : 'suspensa'} com sucesso!`, 'success');
      loadCompanies();
      if (showDetailsModal) {
        loadCompanyDetails(comp.id);
      }
    } catch (err) {
      // Reverter estado otimista caso falhe
      setCompanies(prev => prev.map(c => c.id === comp.id ? { ...c, isActive: comp.isActive } : c));
      setSelectedCompany(prev => prev && prev.id === comp.id ? { ...prev, isActive: comp.isActive } : prev);
      setCompanyDetails(prev => prev && prev.company && prev.company.id === comp.id 
        ? { ...prev, company: { ...prev.company, isActive: comp.isActive } } 
        : prev
      );
      showToast(err.message || 'Erro ao alterar status da empresa', 'error');
    }
  };

  const handleDelete = async (comp) => {
    if (comp.id === 'company_default') {
      showToast('A empresa padrão do sistema não pode ser removida.', 'error');
      return;
    }

    if (!window.confirm(`ATENÇÃO: Deseja realmente excluir a empresa "${comp.name}"?\nTodos os bots, usuários e históricos vinculados a ela serão excluídos permanentemente!`)) {
      return;
    }

    try {
      await api.deleteCompany(comp.id);
      showToast(`Empresa "${comp.name}" excluída com sucesso.`, 'success');
      if (showDetailsModal && selectedCompany?.id === comp.id) {
        setShowDetailsModal(false);
      }
      loadCompanies();
    } catch (err) {
      showToast(err.message || 'Falha ao excluir empresa', 'error');
    }
  };

  const handleToggleUserActive = async (targetUser) => {
    try {
      const nextActive = targetUser.isActive === false ? true : false;
      await api.updateUser(targetUser.id, { isActive: nextActive });
      showToast(`Usuário "${targetUser.name}" ${nextActive ? 'ativado' : 'suspenso'} com sucesso!`, 'success');
      if (selectedCompany) {
        loadCompanyDetails(selectedCompany.id);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao alterar status do usuário', 'error');
    }
  };

  // Criação de usuário para uma empresa específica
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      await api.createUser({
        ...newUserForm,
        companyId: selectedCompany.id
      });
      showToast(`Usuário "${newUserForm.name}" adicionado à empresa com sucesso!`, 'success');
      setShowAddUserModal(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'operator', phoneNumber: '' });
      loadCompanyDetails(selectedCompany.id);
      loadCompanies();
    } catch (err) {
      showToast(err.message || 'Erro ao adicionar usuário', 'error');
    }
  };

  // Redefinição de senha de usuário da empresa
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserForPassword || !newPasswordValue || newPasswordValue.length < 8) {
      showToast('A nova senha deve ter no mínimo 8 caracteres.', 'error');
      return;
    }

    try {
      await api.updateUser(targetUserForPassword.id, { password: newPasswordValue });
      showToast(`Senha de "${targetUserForPassword.name}" atualizada com sucesso!`, 'success');
      setShowResetPasswordModal(false);
      setTargetUserForPassword(null);
      setNewPasswordValue('');
    } catch (err) {
      showToast(err.message || 'Erro ao redefinir senha', 'error');
    }
  };

  // Filtragem
  const filteredCompanies = companies.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      c.name?.toLowerCase().includes(q) ||
      c.cnpj?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    );

    if (statusFilter === 'active') return matchesSearch && c.isActive;
    if (statusFilter === 'suspended') return matchesSearch && !c.isActive;
    return matchesSearch;
  });

  // Métricas agregadas
  const totalBotsAllocated = companies.reduce((acc, c) => acc + (parseInt(c.maxBots, 10) || 0), 0);
  const totalBotsUsed = companies.reduce((acc, c) => acc + (parseInt(c.botCount, 10) || 0), 0);
  const totalUsersCount = companies.reduce((acc, c) => acc + (parseInt(c.userCount, 10) || 0), 0);
  const activeCompaniesCount = companies.filter(c => c.isActive).length;

  return (
    <div style={{ padding: '28px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
      {/* Toast Feedback */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: notification.type === 'error' ? 'var(--status-error)' : 'var(--primary)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 1000,
            fontSize: '0.88rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                Gestão de Empresas (SaaS Multi-Empresa)
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Painel exclusivo de Superadministrador para controle de empresas clientes, limites de bots e atendentes.
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn btn-primary"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 20px',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
          }}
        >
          <Plus size={18} /> Nova Empresa Cliente
        </button>
      </div>

      {/* Stats Cards */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Empresas Cadastradas</span>
            <Building2 size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {companies.length} <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>({activeCompaniesCount} ativas)</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tenants isolados na plataforma</span>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Slots de Bots Contratados</span>
            <Bot size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {totalBotsUsed} <span style={{ fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalBotsAllocated} bots</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Instâncias WhatsApp criadas</span>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Equipe Total</span>
            <Users size={18} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {totalUsersCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Administradores e atendentes</span>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Isolamento Multi-Tenant</span>
            <ShieldCheck size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            100% Blindado
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bancos, sessões e IA segregados</span>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '600px' }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'var(--bg-secondary)',
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              flex: 1
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Buscar empresa por nome, CNPJ ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                width: '100%',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: statusFilter === 'all' ? 'var(--primary)' : 'transparent',
                color: statusFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Todas ({companies.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: statusFilter === 'active' ? 'var(--primary)' : 'transparent',
                color: statusFilter === 'active' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Ativas ({activeCompaniesCount})
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: statusFilter === 'suspended' ? 'var(--primary)' : 'transparent',
                color: statusFilter === 'suspended' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Suspensas ({companies.length - activeCompaniesCount})
            </button>
          </div>
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Exibindo <strong>{filteredCompanies.length}</strong> de {companies.length} empresas
        </span>
      </div>

      {/* Companies Table Panel */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--primary)',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px auto'
              }} 
            />
            <span style={{ fontSize: '0.85rem' }}>Carregando empresas cadastradas...</span>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building2 size={42} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>
              Nenhuma empresa encontrada
            </p>
            <p style={{ fontSize: '0.82rem' }}>
              {searchTerm ? 'Tente outros termos de busca.' : 'Clique em "Nova Empresa Cliente" para cadastrar sua primeira empresa.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Empresa / Tenant</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>CNPJ</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Limite de Bots WhatsApp</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Equipe</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Ações de Gestão</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map(c => {
                  const botUsagePercent = c.maxBots > 0 ? Math.min(100, Math.round((c.botCount / c.maxBots) * 100)) : 0;
                  const isDefaultCompany = c.id === 'company_default';

                  return (
                    <tr 
                      key={c.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Nome da Empresa */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div 
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366f1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1rem',
                              flexShrink: 0
                            }}
                          >
                            {c.name ? c.name.charAt(0).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                                {c.name}
                              </span>
                              {isDefaultCompany && (
                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                                  Matriz / Master
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              ID: {c.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CNPJ */}
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                        {c.cnpj || '—'}
                      </td>

                      {/* Limite de Bots */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {c.botCount} de {c.maxBots} bots
                            </span>
                            <span style={{ color: botUsagePercent >= 100 ? '#ef4444' : 'var(--text-muted)' }}>
                              {botUsagePercent}% {botUsagePercent >= 100 && '(Cheio)'}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div 
                              style={{
                                width: `${botUsagePercent}%`,
                                height: '100%',
                                backgroundColor: botUsagePercent >= 100 ? '#ef4444' : '#10b981',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Equipe / Usuários */}
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            window.sessionStorage.setItem('initial_users_company_filter', c.id);
                            window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'users' }));
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer'
                          }}
                          title={`Clique para gerenciar a equipe de ${c.name}`}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', transition: 'all 0.15s ease' }}>
                            <Users size={14} color="var(--primary)" />
                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.userCount}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>membros</span>
                          </div>
                        </button>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          onClick={() => handleToggleActive(c)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title={c.isActive ? 'Clique para suspender' : 'Clique para ativar'}
                        >
                          {c.isActive ? (
                            <span className="badge-status online" style={{ fontSize: '0.74rem' }}>
                              ● Ativa
                            </span>
                          ) : (
                            <span className="badge-status finished" style={{ fontSize: '0.74rem' }}>
                              ● Suspensa
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => openDetailsModal(c)}
                            className="btn btn-secondary"
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="Ver Bots e Equipe da Empresa"
                          >
                            <Eye size={14} /> Detalhes & Bots
                          </button>

                          <button
                            onClick={() => openEditModal(c)}
                            className="btn-icon"
                            title="Editar Dados e Limite de Bots"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit3 size={15} />
                          </button>

                          {!isDefaultCompany && (
                            <button
                              onClick={() => handleDelete(c)}
                              className="btn-icon"
                              title="Excluir Empresa e Recursos"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                background: 'transparent',
                                color: 'var(--status-error)',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALHES COMPLETOS DA EMPRESA (COM BOTS E ATENDENTES) */}
      {showDetailsModal && selectedCompany && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
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
              maxWidth: '850px',
              maxHeight: '90vh',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div 
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div 
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '1.1rem'
                  }}
                >
                  {selectedCompany.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {selectedCompany.name}
                    </h3>
                    {selectedCompany.isActive ? (
                      <span className="badge-status online" style={{ fontSize: '0.72rem' }}>● Ativa</span>
                    ) : (
                      <span className="badge-status finished" style={{ fontSize: '0.72rem' }}>● Suspensa</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ID: {selectedCompany.id} {selectedCompany.cnpj ? `| CNPJ: ${selectedCompany.cnpj}` : ''}
                  </span>
                </div>
              </div>

              <button onClick={() => setShowDetailsModal(false)} className="btn-icon" style={{ width: '34px', height: '34px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div 
              style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              <button
                onClick={() => setDetailsTab('overview')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: detailsTab === 'overview' ? 'var(--primary-subtle)' : 'transparent',
                  color: detailsTab === 'overview' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: detailsTab === 'overview' ? 700 : 500,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Building2 size={16} /> Visão Geral & Limites
              </button>

              <button
                onClick={() => setDetailsTab('bots')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: detailsTab === 'bots' ? 'var(--primary-subtle)' : 'transparent',
                  color: detailsTab === 'bots' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: detailsTab === 'bots' ? 700 : 500,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Bot size={16} /> Bots da Empresa ({companyDetails.bots?.length || 0})
              </button>

              <button
                onClick={() => setDetailsTab('users')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: detailsTab === 'users' ? 'var(--primary-subtle)' : 'transparent',
                  color: detailsTab === 'users' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: detailsTab === 'users' ? 700 : 500,
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Users size={16} /> Equipe & Atendentes ({companyDetails.users?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {loadingDetails ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                  <p style={{ fontSize: '0.85rem' }}>Carregando dados da empresa...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: VISÃO GERAL */}
                  {detailsTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '14px'
                        }}
                      >
                        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Plano de Bots</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                            {companyDetails.bots?.length || 0} / {selectedCompany.maxBots} slots
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Capacidade contratada</span>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Atendentes Conectados</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                            {companyDetails.users?.length || 0} membros
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Acesso ao painel ao vivo</span>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Data de Cadastro</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
                            {selectedCompany.createdAt ? new Date(selectedCompany.createdAt).toLocaleDateString('pt-BR') : '—'}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Criação do tenant</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
                          Ações Rápidas de Gestão
                        </h4>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => openEditModal(selectedCompany)}
                            className="btn btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                          >
                            <Sliders size={15} /> Ajustar Limite de Bots / Nome
                          </button>
                          <button
                            onClick={() => handleToggleActive(selectedCompany)}
                            className="btn btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: selectedCompany.isActive ? 'var(--status-error)' : '#10b981' }}
                          >
                            <Power size={15} /> {selectedCompany.isActive ? 'Suspender Acesso da Empresa' : 'Reativar Acesso'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: BOTS DA EMPRESA */}
                  {detailsTab === 'bots' && (
                    <div>
                      {companyDetails.bots?.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Bot size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                          <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Esta empresa ainda não possui nenhum bot criado.</p>
                          <span style={{ fontSize: '0.82rem' }}>O administrador desta empresa poderá criar até {selectedCompany.maxBots} bots.</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {companyDetails.bots.map(b => (
                            <div 
                              key={b.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '14px 18px',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Bot size={18} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                    {b.name}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    ID: {b.id} | Modelo IA: {b.model || 'gpt-3.5-turbo'}
                                  </span>
                                </div>
                              </div>

                              <div>
                                {b.status === 'connected' ? (
                                  <span className="badge-status online">● Conectado</span>
                                ) : b.status === 'connecting' ? (
                                  <span className="badge-status waiting">● Conectando</span>
                                ) : (
                                  <span className="badge-status finished">● Desconectado</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: EQUIPE E ATENDENTES */}
                  {detailsTab === 'users' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Membros com acesso ao painel desta empresa
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              window.sessionStorage.setItem('initial_users_company_filter', selectedCompany?.id);
                              setShowDetailsModal(false);
                              window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'users' }));
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            title="Abrir no Painel Geral de Usuários com filtro aplicado"
                          >
                            <ExternalLink size={14} /> Painel Completo
                          </button>
                          <button
                            onClick={() => setShowAddUserModal(true)}
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Plus size={14} /> Adicionar Atendente
                          </button>
                        </div>
                      </div>

                      {companyDetails.users?.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Users size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                          <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Nenhum usuário cadastrado nesta empresa.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {companyDetails.users.map(u => (
                            <div 
                              key={u.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '14px 18px',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                  {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                      {u.name}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '6px', background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)', color: u.role === 'admin' ? '#3b82f6' : 'var(--text-secondary)', fontWeight: 600 }}>
                                      {u.role === 'admin' ? 'Admin da Empresa' : 'Operador'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    {u.email} {u.phoneNumber ? `| Tel: ${u.phoneNumber}` : ''}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => handleToggleUserActive(u)}
                                  className="btn btn-secondary"
                                  style={{ 
                                    padding: '6px 10px', 
                                    fontSize: '0.74rem', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    color: u.isActive !== false ? 'var(--status-error)' : '#10b981'
                                  }}
                                  title={u.isActive !== false ? 'Suspender acesso deste usuário' : 'Reativar acesso deste usuário'}
                                >
                                  <Power size={13} /> {u.isActive !== false ? 'Suspender' : 'Reativar'}
                                </button>
                                <button
                                  onClick={() => {
                                    setTargetUserForPassword(u);
                                    setNewPasswordValue('');
                                    setShowResetPasswordModal(true);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Redefinir Senha deste Usuário"
                                >
                                  <KeyRound size={13} /> Resetar Senha
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR EMPRESA */}
      {showCreateModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
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
              maxWidth: '520px',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                    Nova Empresa Cliente
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Crie o tenant com login de administrador</span>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Seção 1: Dados da Empresa */}
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  1. Dados da Empresa
                </span>

                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Nome da Empresa / Razão Social *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Clínica Sorriso Perfeito"
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        CNPJ (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="00.000.000/0001-00"
                        value={createForm.cnpj}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, cnpj: e.target.value }))}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Limite de Bots *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={createForm.maxBots}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, maxBots: parseInt(e.target.value, 10) || 1 }))}
                        required
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Administrador da Empresa */}
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. Acesso do Administrador da Empresa
                </span>

                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Nome do Administrador *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Eduardo"
                      value={createForm.adminName}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminName: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      E-mail de Login *
                    </label>
                    <input
                      type="email"
                      placeholder="admin@clinica.com.br"
                      value={createForm.adminEmail}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Senha de Acesso (Mín. 8 caracteres) *
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={createForm.adminPassword}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminPassword: e.target.value }))}
                      required
                      minLength={8}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="btn btn-secondary"
                  style={{ padding: '10px 18px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '10px 22px', fontWeight: 700 }}
                >
                  Criar Empresa & Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EMPRESA */}
      {showEditModal && selectedCompany && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
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
              maxWidth: '460px',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Editar Empresa
                </h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  CNPJ
                </label>
                <input
                  type="text"
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cnpj: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Limite Máximo de Bots Contratados
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editForm.maxBots}
                  onChange={(e) => setEditForm(prev => ({ ...prev, maxBots: parseInt(e.target.value, 10) || 1 }))}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Status da Conta
                </label>
                <select
                  value={editForm.isActive ? 'true' : 'false'}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                >
                  <option value="true">Ativa (Acesso Liberado)</option>
                  <option value="false">Suspensa (Bloquear Acesso)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR ATENDENTE PARA EMPRESA */}
      {showAddUserModal && selectedCompany && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={20} color="var(--primary)" />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Novo Usuário
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Para a empresa: <strong>{selectedCompany.name}</strong>
                  </span>
                </div>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nome do Membro *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Beatriz Lima"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  E-mail de Login *
                </label>
                <input
                  type="email"
                  placeholder="beatriz@empresa.com.br"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Senha de Acesso (Mín. 8 caracteres) *
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Função na Empresa
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                >
                  <option value="operator">Operador / Atendente</option>
                  <option value="admin">Administrador da Empresa</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddUserModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Criar Atendente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESETAR SENHA DE USUÁRIO */}
      {showResetPasswordModal && targetUserForPassword && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 130,
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
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound size={20} color="var(--primary)" />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Redefinir Senha
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Usuário: <strong>{targetUserForPassword.name}</strong> ({targetUserForPassword.email})
                  </span>
                </div>
              </div>
              <button onClick={() => setShowResetPasswordModal(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nova Senha (Mínimo 8 caracteres) *
                </label>
                <input
                  type="password"
                  placeholder="Digite a nova senha..."
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  required
                  minLength={8}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowResetPasswordModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
