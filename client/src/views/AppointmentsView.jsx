import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Phone, 
  Edit2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  UserCheck, 
  Sparkles,
  CalendarCheck,
  List,
  Grid,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// Formata data local como YYYY-MM-DD sem distorção de fuso UTC
const toLocalDateKey = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function AppointmentsView() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => user?.companyId || 'company_default');

  const activeCompanyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : (user?.companyId || 'company_default');
  const activeCompanyName = useMemo(() => {
    if (isSuperAdmin && companies.length > 0) {
      return companies.find(c => c.id === activeCompanyId)?.name || user?.companyName || 'Empresa';
    }
    return user?.companyName || 'Sua Empresa';
  }, [isSuperAdmin, companies, activeCompanyId, user]);

  // Carrega empresas caso seja superadmin para permitir alternar agenda entre empresas
  useEffect(() => {
    if (isSuperAdmin && api.getCompanies) {
      api.getCompanies().then(res => {
        if (Array.isArray(res) && res.length > 0) {
          setCompanies(res);
          if (!selectedCompanyId || selectedCompanyId === 'company_default') {
            setSelectedCompanyId(res[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [isSuperAdmin]);

  const [appointments, setAppointments] = useState(() => {
    try {
      const companyKey = user?.companyId || 'company_default';
      const storageKey = `zeplyn_appointments_empresa_${companyKey}`;
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(`itec_appointments_empresa_${companyKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  // Atualiza a lista sempre que a empresa ativa mudar
  useEffect(() => {
    try {
      const storageKey = `zeplyn_appointments_empresa_${activeCompanyId}`;
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(`itec_appointments_empresa_${activeCompanyId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setAppointments(parsed);
          return;
        }
      }
      setAppointments([]);
    } catch (_) {
      setAppointments([]);
    }
  }, [activeCompanyId]);

  // Salvar no localStorage da empresa ativa sempre que houver alteração
  useEffect(() => {
    try {
      const storageKey = `zeplyn_appointments_empresa_${activeCompanyId}`;
      localStorage.setItem(storageKey, JSON.stringify(appointments));
    } catch (_) {}
  }, [appointments, activeCompanyId]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' ou 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Formulário
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    service: '',
    contactName: '',
    contactPhone: '',
    attendantName: '',
    date: toLocalDateKey(new Date()),
    time: '14:00',
    durationMinutes: 30,
    status: 'pending',
    notes: ''
  });

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const pending = appointments.filter(a => a.status === 'pending').length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const rate = total > 0 ? Math.round(((confirmed + completed) / total) * 100) : 0;
    return { total, confirmed, pending, completed, rate };
  }, [appointments]);

  // Filtragem
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (apt.contactName || '').toLowerCase();
        const phone = (apt.contactPhone || '').toLowerCase();
        const title = (apt.title || '').toLowerCase();
        const service = (apt.service || '').toLowerCase();
        const attendant = (apt.attendantName || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !title.includes(q) && !service.includes(q) && !attendant.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Navegação de Datas
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Abrir Modal de Novo Agendamento
  const handleOpenNewModal = (targetDate = null) => {
    const dStr = targetDate ? toLocalDateKey(targetDate) : toLocalDateKey(new Date());
    setFormData({
      id: '',
      title: '',
      service: '',
      contactName: '',
      contactPhone: '',
      attendantName: '',
      date: dStr,
      time: '14:00',
      durationMinutes: 30,
      status: 'pending',
      notes: ''
    });
    setIsEditing(false);
    setShowModal(true);
  };

  // Abrir Modal de Edição
  const handleOpenEditModal = (apt) => {
    setFormData({
      id: apt.id,
      title: apt.title,
      service: apt.service || '',
      contactName: apt.contactName,
      contactPhone: apt.contactPhone || '',
      attendantName: apt.attendantName || '',
      date: apt.date,
      time: apt.time,
      durationMinutes: apt.durationMinutes || 30,
      status: apt.status,
      notes: apt.notes || ''
    });
    setIsEditing(true);
    setShowDetailModal(false);
    setShowModal(true);
  };

  // Salvar Agendamento
  const handleSaveForm = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date || !formData.time) {
      showToast('Preencha o título, a data e o horário.', 'error');
      return;
    }

    if (isEditing && formData.id) {
      setAppointments(prev => prev.map(a => a.id === formData.id ? { ...formData } : a));
      showToast('Agendamento atualizado com sucesso!');
    } else {
      const newApt = {
        ...formData,
        id: `apt-${Date.now()}`,
        companyId: activeCompanyId
      };
      setAppointments(prev => [newApt, ...prev]);
      showToast('Novo compromisso adicionado à agenda!');
    }

    setShowModal(false);
  };

  // Excluir
  const handleDeleteAppointment = (id) => {
    if (!window.confirm('Deseja realmente remover este compromisso?')) return;
    setAppointments(prev => prev.filter(a => a.id !== id));
    setShowDetailModal(false);
    showToast('Compromisso excluído da agenda.');
  };

  // Mudar Status Rápido
  const handleQuickStatusChange = (id, newStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    if (selectedAppointment && selectedAppointment.id === id) {
      setSelectedAppointment(prev => ({ ...prev, status: newStatus }));
    }
    showToast('Status atualizado!');
  };

  // Grade de 42 dias para o mês
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Domingo

    const days = [];

    // Dias do mês anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Dias do próximo mês
    const totalDays = days.length;
    const remainingDays = 42 - totalDays;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentDate]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return { label: 'Confirmado', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'pending':
        return { label: 'Pendente', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'completed':
        return { label: 'Concluído', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'rescheduled':
        return { label: 'Reagendado', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
      case 'cancelled':
        return { label: 'Cancelado', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { label: 'Agendado', bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' };
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            fontWeight: 600
          }}
        >
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* HEADER SUPERIOR */}
      <div 
        style={{ 
          padding: '16px 24px', 
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarCheck size={22} color="var(--primary)" />
            <span>Central de Agendamentos & Calendário</span>
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Agenda visual integrada com visualização mensal e gerenciamento de horários
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isSuperAdmin && companies.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <Building2 size={16} color="var(--primary)" />
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                title="Empresa Selecionada"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)' }}>
                    🏢 {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Building2 size={15} color="var(--primary)" />
              <span>{activeCompanyName}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleOpenNewModal()}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '8px' }}
          >
            <Plus size={16} />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '14px', 
          padding: '16px 24px 8px' 
        }}
      >
        <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarIcon size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>TOTAL NA AGENDA</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.total}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>CONFIRMADOS</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>{stats.confirmed}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>PENDENTES</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b' }}>{stats.pending}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>TAXA DE COMPARECIMENTO</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#a855f7' }}>{stats.rate}%</span>
          </div>
        </div>
      </div>

      {/* BARRA DE CONTROLE: NAVEGAÇÃO DE MÊS + FILTROS */}
      <div 
        style={{ 
          padding: '12px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Navegador de Mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', borderRadius: '6px' }}
            title="Mês Anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 8px', minWidth: '180px', textAlign: 'center', color: 'var(--text-main)' }}>
            {monthNames[currentDate.getMonth()]} de {currentDate.getFullYear()}
          </h2>

          <button
            type="button"
            onClick={handleNextMonth}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', borderRadius: '6px' }}
            title="Próximo Mês"
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '6px', marginLeft: '6px' }}
          >
            Hoje
          </button>
        </div>

        {/* Filtros e Alternância de Visualização */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Buscar compromisso..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px', width: '100%' }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
            style={{ fontSize: '0.8rem', height: '34px', padding: '0 10px' }}
          >
            <option value="all">Todos os Status</option>
            <option value="confirmed">🟢 Confirmados</option>
            <option value="pending">🟡 Pendentes</option>
            <option value="completed">🔵 Concluídos</option>
            <option value="rescheduled">🟣 Reagendados</option>
            <option value="cancelled">🔴 Cancelados</option>
          </select>

          {/* Toggle Grade / Lista */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: viewMode === 'month' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'month' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              <Grid size={14} />
              <span>Grade</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              <List size={14} />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: CALENDÁRIO OU LISTA */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}>
        {viewMode === 'month' ? (
          /* GRADE MENSAL */
          <div 
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {/* Cabeçalho dos Dias da Semana */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                backgroundColor: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-subtle)',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                padding: '10px 0'
              }}
            >
              <div>DOM</div>
              <div>SEG</div>
              <div>TER</div>
              <div>QUA</div>
              <div>QUI</div>
              <div>SEX</div>
              <div>SÁB</div>
            </div>

            {/* Células de Dias */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gridAutoRows: 'minmax(115px, auto)'
              }}
            >
              {calendarDays.map((cell, idx) => {
                const cellDateStr = toLocalDateKey(cell.date);
                const todayStr = toLocalDateKey(new Date());
                const isToday = cellDateStr === todayStr;

                // Agendamentos para este dia específico
                const dayAppointments = filteredAppointments.filter(apt => apt.date === cellDateStr);

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenNewModal(cell.date)}
                    style={{
                      borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-subtle)' : 'none',
                      borderBottom: idx < 35 ? '1px solid var(--border-subtle)' : 'none',
                      padding: '8px',
                      backgroundColor: isToday ? 'rgba(59, 130, 246, 0.05)' : cell.isCurrentMonth ? 'transparent' : 'rgba(0,0,0,0.15)',
                      opacity: cell.isCurrentMonth ? 1 : 0.45,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '115px'
                    }}
                    onMouseEnter={(e) => {
                      if (cell.isCurrentMonth) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      if (cell.isCurrentMonth) e.currentTarget.style.backgroundColor = isToday ? 'rgba(59, 130, 246, 0.05)' : 'transparent';
                    }}
                  >
                    {/* Topo da Célula */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span 
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: isToday ? 800 : 600,
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                          color: isToday ? '#fff' : 'var(--text-main)'
                        }}
                      >
                        {cell.date.getDate()}
                      </span>

                      {dayAppointments.length > 0 && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                          {dayAppointments.length}
                        </span>
                      )}
                    </div>

                    {/* Chips de Agendamento */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                      {dayAppointments.slice(0, 3).map(apt => {
                        const badge = getStatusBadge(apt.status);
                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(apt);
                              setShowDetailModal(true);
                            }}
                            style={{
                              padding: '4px 6px',
                              borderRadius: '6px',
                              backgroundColor: badge.bg,
                              borderLeft: `3px solid ${badge.color}`,
                              color: 'var(--text-main)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '4px',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis'
                            }}
                            title={`${apt.time} - ${apt.contactName} (${apt.title})`}
                          >
                            <span style={{ color: badge.color, fontSize: '0.7rem' }}>{apt.time}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{apt.contactName}</span>
                          </div>
                        );
                      })}

                      {dayAppointments.length > 3 && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          +{dayAppointments.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VISÃO EM LISTA */
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '14px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {filteredAppointments.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CalendarIcon size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Nenhum compromisso encontrado.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                    <th style={{ padding: '12px 16px' }}>DATA & HORÁRIO</th>
                    <th style={{ padding: '12px 16px' }}>CLIENTE</th>
                    <th style={{ padding: '12px 16px' }}>SERVIÇO / ASSUNTO</th>
                    <th style={{ padding: '12px 16px' }}>PROFISSIONAL</th>
                    <th style={{ padding: '12px 16px' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map(apt => {
                    const badge = getStatusBadge(apt.status);
                    const [y, m, d] = (apt.date || '').split('-');
                    const dateFormatted = d ? `${d}/${m}/${y}` : apt.date;

                    return (
                      <tr 
                        key={apt.id} 
                        style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setShowDetailModal(true);
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                          <div>{dateFormatted}</div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{apt.time} ({apt.durationMinutes} min)</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{apt.contactName}</div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{apt.contactPhone}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{apt.title}</div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{apt.service}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {apt.attendantName || '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span 
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(apt);
                            }}
                            className="btn-icon"
                            style={{ width: '28px', height: '28px', marginRight: '6px' }}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAppointment(apt.id);
                            }}
                            className="btn-icon"
                            style={{ width: '28px', height: '28px', color: '#ef4444' }}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL: CRIAR OU EDITAR AGENDAMENTO */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
              maxWidth: '520px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    {isEditing ? 'Editar Agendamento' : 'Novo Agendamento na Agenda'}
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Preencha os dados do compromisso
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="btn-icon" 
                style={{ width: '30px', height: '30px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Título / Motivo *
                  </label>
                  <input 
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Consulta Médica, Reunião"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Serviço / Categoria
                  </label>
                  <input 
                    type="text"
                    value={formData.service}
                    onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                    placeholder="Ex: Clínica Geral, Vendas"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Nome do Cliente *
                  </label>
                  <input 
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Ex: João da Silva"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Telefone / WhatsApp
                  </label>
                  <input 
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="Ex: (11) 98765-4321"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Data do Agendamento *
                  </label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Horário *
                  </label>
                  <input 
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Duração
                  </label>
                  <select
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h 30min</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Status Inicial
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  >
                    <option value="pending">🟡 Pendente</option>
                    <option value="confirmed">🟢 Confirmado</option>
                    <option value="completed">🔵 Concluído</option>
                    <option value="rescheduled">🟣 Reagendado</option>
                    <option value="cancelled">🔴 Cancelado</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Profissional Responsável
                </label>
                <input 
                  type="text"
                  value={formData.attendantName}
                  onChange={(e) => setFormData(prev => ({ ...prev, attendantName: e.target.value }))}
                  placeholder="Ex: Dr. Marcos, Dra. Camila, etc."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Observações (opcional)
                </label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notas internas, recomendações..."
                  rows={2}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '0.85rem', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} />
                  <span>{isEditing ? 'Salvar Alterações' : 'Salvar Compromisso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO AGENDAMENTO */}
      {showDetailModal && selectedAppointment && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
              maxWidth: '460px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span 
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    backgroundColor: getStatusBadge(selectedAppointment.status).bg,
                    color: getStatusBadge(selectedAppointment.status).color,
                    border: `1px solid ${getStatusBadge(selectedAppointment.status).border}`,
                    display: 'inline-block',
                    marginBottom: '8px'
                  }}
                >
                  {getStatusBadge(selectedAppointment.status).label}
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {selectedAppointment.title}
                </h3>
                {selectedAppointment.service && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {selectedAppointment.service}
                  </span>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setShowDetailModal(false)} 
                className="btn-icon" 
                style={{ width: '30px', height: '30px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', padding: '14px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarIcon size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  {(() => {
                    const [y, m, d] = (selectedAppointment.date || '').split('-');
                    return d ? `${d}/${m}/${y}` : selectedAppointment.date;
                  })()} às {selectedAppointment.time} ({selectedAppointment.durationMinutes} min)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={16} color="#10b981" />
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                    {selectedAppointment.contactName}
                  </span>
                  {selectedAppointment.contactPhone && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                      {selectedAppointment.contactPhone}
                    </span>
                  )}
                </div>
              </div>

              {selectedAppointment.attendantName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserCheck size={16} color="#8b5cf6" />
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Atendido por: <strong>{selectedAppointment.attendantName}</strong>
                  </span>
                </div>
              )}

              {selectedAppointment.notes && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Obs:</strong> {selectedAppointment.notes}
                </div>
              )}
            </div>

            {/* Ações de Status */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                ALTERAR STATUS:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange(selectedAppointment.id, 'confirmed')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '5px 10px', color: '#10b981' }}
                >
                  ✓ Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange(selectedAppointment.id, 'completed')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '5px 10px', color: '#3b82f6' }}
                >
                  Concluir
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange(selectedAppointment.id, 'rescheduled')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '5px 10px', color: '#a855f7' }}
                >
                  Reagendar
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange(selectedAppointment.id, 'cancelled')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '5px 10px', color: '#ef4444' }}
                >
                  Cancelar
                </button>
              </div>
            </div>

            {/* Botões do Rodapé */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                className="btn btn-secondary"
                style={{ color: '#ef4444', fontSize: '0.8rem', padding: '7px 12px' }}
              >
                <Trash2 size={14} style={{ marginRight: '5px' }} />
                Excluir
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedAppointment)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                >
                  <Edit2 size={14} style={{ marginRight: '5px' }} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
