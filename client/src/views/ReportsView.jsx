import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Star, 
  Bot, 
  Users, 
  Download, 
  RefreshCw, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  MessageSquare, 
  Briefcase, 
  ArrowUpRight, 
  ShieldCheck, 
  Award, 
  Layers, 
  Flame,
  FileDown,
  Printer,
  FileText
} from 'lucide-react';
import { api, getStoredUser } from '../services/api';

export default function ReportsView() {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [report, setReport] = useState(null);
  const [bots, setBots] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filtros
  const [period, setPeriod] = useState('7days');
  const [selectedBotId, setSelectedBotId] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      if (period === 'custom') {
        if (customStart) queryParams.append('startDate', customStart);
        if (customEnd) queryParams.append('endDate', customEnd);
      }
      if (selectedBotId !== 'all') queryParams.append('botId', selectedBotId);
      if (selectedDepartment !== 'all') queryParams.append('department', selectedDepartment);

      const [reportData, botsData, rolesData] = await Promise.all([
        api.getAdvancedReports(queryParams.toString()),
        api.getBots().catch(() => []),
        api.getRoles().catch(() => [])
      ]);

      if (reportData) {
        setReport(reportData);
      }
      if (Array.isArray(botsData)) {
        setBots(botsData);
      }
      if (Array.isArray(rolesData)) {
        setRoles(rolesData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do relatório:', err);
      showToast(err.message || 'Erro ao carregar métricas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period, selectedBotId, selectedDepartment]);

  const handleApplyCustom = () => {
    if (period === 'custom') {
      loadData();
    } else {
      setPeriod('custom');
    }
  };

  const buildQueryParams = () => {
    const queryParams = new URLSearchParams();
    queryParams.append('period', period);
    if (period === 'custom') {
      if (customStart) queryParams.append('startDate', customStart);
      if (customEnd) queryParams.append('endDate', customEnd);
    }
    if (selectedBotId !== 'all') queryParams.append('botId', selectedBotId);
    if (selectedDepartment !== 'all') queryParams.append('department', selectedDepartment);
    return queryParams.toString();
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      await api.downloadReportCsv(buildQueryParams());
      showToast('Relatório CSV exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      showToast(err.message || 'Erro ao exportar relatório CSV', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      await api.downloadReportPdf(buildQueryParams());
      showToast('Relatório executivo em PDF baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      showToast(err.message || 'Erro ao gerar relatório PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Departamentos disponíveis para filtro
  const departmentsList = useMemo(() => {
    const list = new Set(['Vendas', 'Suporte Técnico', 'Financeiro', 'Atendimento / SAC']);
    roles.forEach(r => {
      if (r.department) list.add(r.department);
    });
    return Array.from(list);
  }, [roles]);

  const kpis = report?.kpis || {
    totalChats: 0,
    totalMessages: 0,
    clientMessages: 0,
    botOrAttendantMessages: 0,
    aiResolved: 0,
    humanAttended: 0,
    aiResolutionRate: 0,
    hoursSavedByAi: 0,
    avgCsat: 5.0,
    ratedChatsCount: 0,
    csatDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    avgTmaFormatted: '0 min',
    avgTmrFormatted: '0s'
  };

  // Cálculo para o gráfico SVG de evolução temporal
  const timelineData = report?.timeline || [];
  const maxChatsInTimeline = Math.max(...timelineData.map(d => d.chats || 0), 5);
  const maxMessagesInTimeline = Math.max(...timelineData.map(d => d.messages || 0), 10);

  // Cálculo para o gráfico de horários de pico (24h)
  const hourlyData = report?.hourlyDistribution || [];
  const maxHourlyCount = Math.max(...hourlyData.map(h => h.count || 0), 5);

  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
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
            fontSize: '0.9rem'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <BarChart3 size={20} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              Relatórios Avançados & Performance
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Métricas estratégicas de autoatendimento por IA, TMA, velocidade de resposta (TMR), satisfação e ranking da equipe.
          </p>
        </div>

        {/* Ações: Exportar PDF, CSV, Imprimir e Atualizar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} className="no-print">
          <button 
            onClick={loadData}
            className="btn btn-secondary"
            disabled={loading}
            style={{ height: '40px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button 
            onClick={handleExportPdf}
            className="btn btn-primary"
            disabled={exportingPdf || loading}
            style={{ 
              height: '40px', 
              padding: '0 18px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              border: 'none',
              color: '#ffffff',
              cursor: exportingPdf || loading ? 'not-allowed' : 'pointer'
            }}
            title="Exportar relatório executivo estruturado em PDF oficial"
          >
            <FileDown size={16} />
            <span>{exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}</span>
          </button>

          <button 
            onClick={handleExportCsv}
            className="btn btn-secondary"
            disabled={exportingCsv || loading}
            style={{ 
              height: '40px', 
              padding: '0 16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontWeight: 600,
              cursor: exportingCsv || loading ? 'not-allowed' : 'pointer'
            }}
            title="Exportar dados e métricas em planilha CSV"
          >
            <Download size={16} />
            <span>{exportingCsv ? 'Exportando...' : 'Exportar Excel (CSV)'}</span>
          </button>

          <button 
            onClick={handlePrint}
            className="btn btn-secondary"
            disabled={loading}
            style={{ 
              height: '40px', 
              padding: '0 14px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              cursor: 'pointer'
            }}
            title="Imprimir ou Salvar como PDF pelo navegador"
          >
            <Printer size={16} />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Período e Parâmetros */}
      <div 
        className="card" 
        style={{ 
          padding: '16px 20px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* Pílulas de Seleção de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
            Período:
          </span>
          {[
            { id: 'today', label: 'Hoje' },
            { id: '7days', label: 'Últimos 7 dias' },
            { id: '30days', label: 'Últimos 30 dias' },
            { id: 'this_month', label: 'Este Mês' },
            { id: 'custom', label: 'Personalizado' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: period === p.id ? 'var(--primary)' : 'var(--border-subtle)',
                backgroundColor: period === p.id ? 'var(--primary-subtle)' : 'transparent',
                color: period === p.id ? 'var(--primary)' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: period === p.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Inputs de Data para Período Personalizado */}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="date" 
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="input-field"
              style={{ height: '36px', fontSize: '0.82rem', padding: '0 8px' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>até</span>
            <input 
              type="date" 
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="input-field"
              style={{ height: '36px', fontSize: '0.82rem', padding: '0 8px' }}
            />
            <button 
              onClick={handleApplyCustom}
              className="btn btn-secondary"
              style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem' }}
            >
              Filtrar
            </button>
          </div>
        )}

        {/* Filtros de Bot e Departamento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {bots.length > 0 && (
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="input-select"
              style={{ height: '36px', fontSize: '0.82rem', minWidth: '150px' }}
            >
              <option value="all">🤖 Todos os Bots</option>
              {bots.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="input-select"
            style={{ height: '36px', fontSize: '0.82rem', minWidth: '160px' }}
          >
            <option value="all">🏢 Todos Departamentos</option>
            {departmentsList.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de KPIs Principais */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}
      >
        {/* KPI 1: Atendimentos Totais */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Atendimentos
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {kpis.totalChats}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>{kpis.totalMessages} mensagens trocadas</span>
          </div>
        </div>

        {/* KPI 2: Taxa de Resolução pela IA */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Resolução por IA
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
            {kpis.aiResolutionRate}%
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>{kpis.aiResolved} sem intervenção humana</span>
          </div>
        </div>

        {/* KPI 3: Tempo Médio de Atendimento (TMA) */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Tempo de Atendimento (TMA)
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {kpis.avgTmaFormatted}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Duração média por chamado</span>
          </div>
        </div>

        {/* KPI 4: Tempo Médio de 1ª Resposta (TMR) */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              1ª Resposta (TMR)
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {kpis.avgTmrFormatted}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Tempo até o primeiro contato</span>
          </div>
        </div>

        {/* KPI 5: Satisfação CSAT */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Satisfação (CSAT)
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{kpis.avgCsat}</span>
            <span style={{ fontSize: '1.2rem', color: '#f59e0b' }}>★</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>{kpis.ratedChatsCount} avaliações de clientes</span>
          </div>
        </div>

        {/* KPI 6: Economia de Horas Humanas */}
        <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Economia da Equipe
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {kpis.hoursSavedByAi}h
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Horas poupadas pela IA</span>
          </div>
        </div>
      </div>

      {/* Seção 2: Gráficos (Evolução Temporal & Distribuição por Departamento) */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', 
          gap: '20px', 
          marginBottom: '24px' 
        }}
      >
        {/* Gráfico 1: Evolução Temporal de Atendimentos */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Evolução de Atendimentos
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Volume de chamados processados no decorrer do período
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ color: 'var(--text-muted)' }}>Resolvidos por IA</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ color: 'var(--text-muted)' }}>Transbordo Humano</span>
              </div>
            </div>
          </div>

          {timelineData.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sem dados suficientes no período selecionado.
            </div>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingTop: '20px' }}>
              {timelineData.map((item, idx) => {
                const total = item.chats || 0;
                const heightPercent = Math.max(12, Math.round((total / maxChatsInTimeline) * 100));
                const aiPercent = total > 0 ? (item.ai / total) * 100 : 0;
                const humanPercent = total > 0 ? (item.human / total) * 100 : 0;

                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {total > 0 ? total : ''}
                    </div>

                    <div 
                      style={{ 
                        width: '100%', 
                        maxWidth: '28px', 
                        height: `${heightPercent}%`, 
                        borderRadius: '6px', 
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        transition: 'height 0.3s ease'
                      }}
                      title={`${item.label}: ${total} atendimentos (${item.ai} IA, ${item.human} Humanos)`}
                    >
                      <div style={{ height: `${humanPercent}%`, backgroundColor: '#f59e0b', width: '100%' }} />
                      <div style={{ height: `${aiPercent}%`, backgroundColor: '#10b981', width: '100%' }} />
                    </div>

                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '8px', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gráfico 2: Demanda por Departamento & CSAT */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Distribuição por Departamento
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Percentual e volume de chamados por setor da empresa
            </p>
          </div>

          {(report?.departments || []).length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Nenhum departamento registrado ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '6px' }}>
              {(report?.departments || []).map((dep, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.84rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dep.color }} />
                      <strong style={{ color: 'var(--text-main)' }}>{dep.name}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{dep.count}</strong> chamados ({dep.percentage}%)
                    </div>
                  </div>

                  <div 
                    style={{ 
                      width: '100%', 
                      height: '8px', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--bg-tertiary)', 
                      overflow: 'hidden' 
                    }}
                  >
                    <div 
                      style={{ 
                        width: `${dep.percentage}%`, 
                        height: '100%', 
                        backgroundColor: dep.color, 
                        borderRadius: '6px',
                        transition: 'width 0.4s ease'
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seção 3: Horários de Pico (Distribuição por Hora do Dia: 00h - 23h) */}
      <div className="card" style={{ padding: '22px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="#ef4444" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Horários de Pico (Distribuição por Hora: 00h às 23h)
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Identifique as faixas de maior fluxo de mensagens para planejar turnos e escalonamento da equipe
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', height: '120px', gap: '4px', paddingTop: '10px' }}>
          {hourlyData.map((h, i) => {
            const count = h.count || 0;
            const barHeight = maxHourlyCount > 0 ? Math.max(8, Math.round((count / maxHourlyCount) * 100)) : 8;
            const isHigh = count >= maxHourlyCount * 0.7 && count > 0;

            return (
              <div 
                key={i} 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  height: '100%', 
                  justifyContent: 'flex-end' 
                }}
              >
                <div 
                  style={{ 
                    width: '100%', 
                    height: `${barHeight}%`, 
                    borderRadius: '4px 4px 0 0', 
                    backgroundColor: isHigh ? '#ef4444' : (count > 0 ? '#3b82f6' : 'var(--bg-tertiary)'),
                    transition: 'height 0.2s ease',
                    cursor: 'pointer'
                  }} 
                  title={`${h.hour}: ${count} mensagens`}
                />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {i % 2 === 0 ? h.hour : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Seção 4: Ranking & Performance da Equipe (Tabela de Operadores) */}
      <div className="card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#f59e0b" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Performance dos Atendentes & Ranking da Equipe
              </h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Produtividade, tempo médio de atendimento (TMA) e avaliações recebidas por cada operador
            </p>
          </div>
        </div>

        {(report?.operators || []).length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Nenhum chamado atendido manualmente por operadores registrado neste período.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Posição / Operador</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Cargo & Setor</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Chamados</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Finalizados</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>TMA (Duração)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>TMR (1ª Resp.)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Nota CSAT</th>
                </tr>
              </thead>
              <tbody>
                {report.operators.map((op, idx) => {
                  const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));

                  return (
                    <tr 
                      key={op.id}
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1rem', width: '24px', textAlign: 'center', fontWeight: 700 }}>
                            {medal}
                          </span>
                          <div 
                            style={{ 
                              width: '34px', 
                              height: '34px', 
                              borderRadius: '8px', 
                              backgroundColor: `${op.roleColor}25`, 
                              color: op.roleColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}
                          >
                            {(op.name || 'O').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{op.name}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px' }}>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            backgroundColor: `${op.roleColor}18`,
                            color: op.roleColor,
                            border: `1px solid ${op.roleColor}35`
                          }}
                        >
                          <Briefcase size={11} />
                          {op.jobRole} ({op.department})
                        </span>
                      </td>

                      <td style={{ padding: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {op.totalChats}
                      </td>

                      <td style={{ padding: '14px', color: '#10b981', fontWeight: 600 }}>
                        {op.finishedChats}
                      </td>

                      <td style={{ padding: '14px', color: 'var(--text-main)', fontWeight: 600 }}>
                        {op.tmaFormatted}
                      </td>

                      <td style={{ padding: '14px', color: 'var(--text-muted)' }}>
                        {op.tmrFormatted}
                      </td>

                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#f59e0b' }}>
                          <span>{op.avgCsat}</span>
                          <span>★</span>
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
    </div>
  );
}
