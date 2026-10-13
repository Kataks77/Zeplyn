import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Building2, 
  Tag, 
  ShieldCheck,
  RefreshCw,
  Layers,
  Sparkles
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';

const PRESET_COLORS = [
  { label: 'Azul Elétrico', value: '#3b82f6' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Púrpura / Índigo', value: '#6366f1' },
  { label: 'Violeta Neon', value: '#8b5cf6' },
  { label: 'Âmbar / Dourado', value: '#f59e0b' },
  { label: 'Rosa / Carmim', value: '#ec4899' },
  { label: 'Vermelho Coral', value: '#ef4444' },
  { label: 'Ciano Tecnológico', value: '#06b6d4' }
];

const PRESET_DEPARTMENTS = [
  'Vendas',
  'Suporte Técnico',
  'Financeiro / Cobrança',
  'Atendimento / SAC',
  'Comercial / Pré-Vendas',
  'Pós-Venda / CS',
  'Administrativo'
];

export default function RolesView({ embedded = false }) {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState({
    name: '',
    department: 'Vendas',
    customDepartment: '',
    color: '#6366f1',
    description: '',
    companyId: ''
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, compsData] = await Promise.all([
        api.getRoles(selectedCompanyId || undefined),
        isSuperAdmin ? api.getCompanies().catch(() => []) : Promise.resolve([])
      ]);

      setRoles(Array.isArray(rolesData) ? rolesData : []);
      if (Array.isArray(compsData) && compsData.length > 0) {
        setCompanies(compsData);
        if (!selectedCompanyId && isSuperAdmin) {
          // opcional: manter vazio para ver todos
        }
      }
    } catch (err) {
      console.error('Erro ao carregar cargos:', err);
      showToast(err.message || 'Erro ao carregar cargos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId]);

  // Departamentos distintos para filtro
  const departments = useMemo(() => {
    const set = new Set();
    (Array.isArray(roles) ? roles : []).forEach(r => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set);
  }, [roles]);

  // Cargos filtrados
  const filteredRoles = useMemo(() => {
    return (Array.isArray(roles) ? roles : []).filter(role => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        (role.name && role.name.toLowerCase().includes(term)) ||
        (role.department && role.department.toLowerCase().includes(term)) ||
        (role.description && role.description.toLowerCase().includes(term));

      const matchesDept = selectedDeptFilter === 'all' || role.department === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [roles, searchTerm, selectedDeptFilter]);

  // Métricas
  const totalRoles = (Array.isArray(roles) ? roles : []).length;
  const totalUsersAssigned = (Array.isArray(roles) ? roles : []).reduce((acc, curr) => acc + (parseInt(curr.userCount, 10) || 0), 0);
  const totalDepartments = departments.length;

  const handleOpenCreate = () => {
    setEditingRole(null);
    setForm({
      name: '',
      department: 'Vendas',
      customDepartment: '',
      color: '#6366f1',
      description: '',
      companyId: selectedCompanyId || currentUser?.companyId || ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (role) => {
    setEditingRole(role);
    const isCustom = !PRESET_DEPARTMENTS.includes(role.department);
    setForm({
      name: role.name || '',
      department: isCustom ? 'Outro' : (role.department || 'Vendas'),
      customDepartment: isCustom ? (role.department || '') : '',
      color: role.color || '#6366f1',
      description: role.description || '',
      companyId: role.companyId || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('O nome do cargo é obrigatório.', 'error');
      return;
    }

    const finalDepartment = form.department === 'Outro' 
      ? form.customDepartment.trim() 
      : form.department;

    if (!finalDepartment) {
      showToast('Informe o departamento.', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        department: finalDepartment,
        color: form.color,
        description: form.description.trim(),
        companyId: form.companyId || undefined
      };

      if (editingRole) {
        await api.updateRole(editingRole.id, payload);
        showToast('Cargo atualizado com sucesso!');
      } else {
        await api.createRole(payload);
        showToast('Novo cargo criado com sucesso!');
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Erro ao salvar cargo:', err);
      showToast(err.message || 'Erro ao salvar cargo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    const userCount = parseInt(role.userCount, 10) || 0;
    const msg = userCount > 0 
      ? `Atenção: Este cargo está atribuído a ${userCount} colaborador(es). Ao excluir, o cargo desses colaboradores será desvinculado. Deseja continuar?`
      : `Deseja realmente excluir o cargo "${role.name}"?`;

    if (!window.confirm(msg)) return;

    try {
      setDeletingId(role.id);
      await api.deleteRole(role.id);
      showToast('Cargo removido com sucesso!');
      loadData();
    } catch (err) {
      console.error('Erro ao deletar cargo:', err);
      showToast(err.message || 'Erro ao remover cargo', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ padding: embedded ? '0' : '24px', height: embedded ? 'auto' : 'calc(100vh - 70px)', overflowY: embedded ? 'visible' : 'auto' }}>
      {/* Toast Notification */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '12px',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            fontWeight: 500,
            fontSize: '0.9rem',
            animation: 'slideIn 0.2s ease-out'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header com Ações */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Briefcase size={20} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              Cargos da Empresa
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Defina os cargos, departamentos e equipes da empresa para distribuição automática de chamados (Round-Robin).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isSuperAdmin && companies.length > 0 && (
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="input-select"
              style={{ minWidth: '180px', height: '40px', fontSize: '0.85rem' }}
            >
              <option value="">🏢 Todas as Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <button 
            onClick={loadData}
            className="btn btn-secondary"
            style={{ height: '40px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Recarregar"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button 
            onClick={handleOpenCreate}
            className="btn btn-primary"
            style={{ 
              height: '40px', 
              padding: '0 18px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
            }}
          >
            <Plus size={17} />
            <span>Novo Cargo</span>
          </button>
        </div>
      </div>

      {/* Métricas Cards */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}
      >
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(99, 102, 241, 0.12)', 
              color: '#6366f1', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Briefcase size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total de Cargos
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {totalRoles}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(16, 185, 129, 0.12)', 
              color: '#10b981', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Colaboradores com Cargo
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {totalUsersAssigned}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(139, 92, 246, 0.12)', 
              color: '#8b5cf6', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Departamentos Ativos
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {totalDepartments}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(245, 158, 11, 0.12)', 
              color: '#f59e0b', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Fila Equitativa
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
              Round-Robin Ativo
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div 
        className="card" 
        style={{ 
          padding: '16px', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Buscar por cargo, departamento ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '38px', height: '40px', fontSize: '0.88rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Departamento:</span>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="input-select"
            style={{ height: '40px', fontSize: '0.85rem', minWidth: '160px' }}
          >
            <option value="all">Todos os Departamentos</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grade de Cargos */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px', marginBottom: '16px' }}></div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carregando cargos da empresa...</span>
        </div>
      ) : filteredRoles.length === 0 ? (
        <div 
          className="card" 
          style={{ 
            padding: '60px 24px', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '16px', 
              backgroundColor: 'rgba(99, 102, 241, 0.1)', 
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Briefcase size={28} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Nenhum cargo encontrado
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', marginBottom: '20px' }}>
            Crie cargos para os operadores da sua empresa (ex: Vendedor, Suporte N1, Atendimento SAC) para habilitar a distribuição de chats por departamento.
          </p>
          <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            <span>Cadastrar Primeiro Cargo</span>
          </button>
        </div>
      ) : (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '18px' 
          }}
        >
          {filteredRoles.map(role => {
            const roleColor = role.color || '#6366f1';
            const userCount = parseInt(role.userCount, 10) || 0;

            return (
              <div 
                key={role.id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${roleColor}`,
                  position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  minHeight: '190px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div 
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: roleColor,
                          boxShadow: `0 0 10px ${roleColor}`
                        }}
                      />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {role.name}
                      </h3>
                    </div>

                    <span 
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: `${roleColor}18`,
                        color: roleColor,
                        border: `1px solid ${roleColor}35`,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {role.department || 'Geral'}
                    </span>
                  </div>

                  <p 
                    style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--text-muted)', 
                      lineHeight: '1.45', 
                      margin: '0 0 16px 0',
                      minHeight: '38px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {role.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    <Users size={15} style={{ color: roleColor }} />
                    <span>
                      <strong style={{ color: 'var(--text-main)' }}>{userCount}</strong> {userCount === 1 ? 'colaborador' : 'colaboradores'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      onClick={() => handleOpenEdit(role)}
                      className="btn-icon"
                      style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                      title="Editar cargo"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(role)}
                      className="btn-icon"
                      disabled={deletingId === role.id}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', color: '#ef4444' }}
                      title="Excluir cargo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Cargo */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            padding: '20px'
          }}
        >
          <div 
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: `${form.color}20`,
                    color: form.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Briefcase size={18} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {editingRole ? 'Editar Cargo' : 'Novo Cargo da Empresa'}
                </h2>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {/* Empresa (apenas se superadmin) */}
              {isSuperAdmin && companies.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Empresa Vinculada
                  </label>
                  <select
                    value={form.companyId}
                    onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    className="input-select"
                    style={{ width: '100%', height: '42px' }}
                    required
                  >
                    <option value="">Selecione a empresa...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nome do Cargo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Nome do Cargo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text"
                  placeholder="Ex: Consultor de Vendas, Atendente N1, Suporte Técnico"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', height: '42px' }}
                  required
                />
              </div>

              {/* Departamento */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Departamento / Fila de Atendimento <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="input-select"
                  style={{ width: '100%', height: '42px', marginBottom: form.department === 'Outro' ? '10px' : '0' }}
                >
                  {PRESET_DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  <option value="Outro">Outro (Personalizado)...</option>
                </select>

                {form.department === 'Outro' && (
                  <input 
                    type="text"
                    placeholder="Digite o nome do departamento personalizado..."
                    value={form.customDepartment}
                    onChange={(e) => setForm({ ...form, customDepartment: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', height: '42px' }}
                    required
                  />
                )}
              </div>

              {/* Cor de Identificação */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Cor de Identificação
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.value })}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: c.value,
                        border: form.color === c.value ? '2px solid #fff' : '2px solid transparent',
                        outline: form.color === c.value ? `2px solid ${c.value}` : 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.1s'
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Descrição / Responsabilidades (Opcional)
                </label>
                <textarea 
                  placeholder="Ex: Responsável por atender leads transferidos do menu de vendas e fechar pedidos..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', height: '70px', padding: '10px', resize: 'vertical' }}
                />
              </div>

              {/* Preview Card */}
              <div 
                style={{ 
                  padding: '12px 16px', 
                  borderRadius: '10px', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: form.color }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {form.name || 'Nome do Cargo'}
                  </span>
                </div>
                <span 
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: `${form.color}20`,
                    color: form.color,
                    border: `1px solid ${form.color}40`
                  }}
                >
                  {form.department === 'Outro' ? (form.customDepartment || 'Departamento') : form.department}
                </span>
              </div>

              {/* Botões do Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
                  style={{ minWidth: '120px' }}
                >
                  {saving ? 'Salvando...' : (editingRole ? 'Salvar Alterações' : 'Criar Cargo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
