import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { Bell, X, ShieldCheck } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import LiveChatView from './views/LiveChatView';
import KanbanView from './views/KanbanView';
import BotsView from './views/BotsView';
import ConnectionsView from './views/ConnectionsView';
import ContactsView from './views/ContactsView';
import QuickMessagesView from './views/QuickMessagesView';
import SettingsView from './views/SettingsView';
import UsersView from './views/UsersView';
import CompaniesView from './views/CompaniesView';
import TagsView from './views/TagsView';
import FlowsView from './views/FlowsView';
import CampaignsView from './views/CampaignsView';
import RolesView from './views/RolesView';
import ReportsView from './views/ReportsView';
import AccessControlView from './views/AccessControlView';
import AuditView from './views/AuditView';
import AppointmentsView from './views/AppointmentsView';
import ProductsView from './views/ProductsView';
import WallboardView from './views/WallboardView';
import { api } from './services/api';
import { socketService } from './services/socket';
import { desktopNotifications } from './services/desktopNotifications';

import SuspendedBlockedModal from './components/SuspendedBlockedModal';
import ErrorBoundary from './components/ErrorBoundary';
import CapsLockFloatingBanner from './components/CapsLockFloatingBanner';

export default function App() {
  const { isAuthenticated, loading, user } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [initialChatTarget, setInitialChatTarget] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [suspendedInfo, setSuspendedInfo] = useState(null);
  const [globalToast, setGlobalToast] = useState(null);
  const [showNotifBanner, setShowNotifBanner] = useState(() => {
    return desktopNotifications.isSupported() && desktopNotifications.getPermission() === 'default';
  });

  const handleOpenChat = (target = null) => {
    if (target) {
      try {
        window.sessionStorage.setItem('initial_chat_target', JSON.stringify(target));
      } catch (e) {}
      setInitialChatTarget(target);
    }
    setCurrentView('chat');
  };

  const previousViewRef = useRef(null);

  const titles = useMemo(() => ({
    dashboard: 'Dashboard Geral',
    wallboard: 'Torre de Controle (Ao Vivo)',
    chat: 'Atendimento ao Vivo',
    connections: 'Conexões WhatsApp',
    appointments: 'Agenda & Lembretes',
    products: 'Produtos & Catálogo',
    kanban: 'Quadro Kanban',
    tags: 'Etiquetas & Tags',
    bots: 'Bots & IA Avançada',
    flows: 'Central URA & Menus',
    contacts: 'Contatos CRM',
    quick_messages: 'Respostas Rápidas',
    users: user?.role === 'superadmin' ? 'Usuários Globais' : 'Minha Equipe',
    companies: 'Empresas SaaS',
    campaigns: 'Disparos em Massa',
    roles: 'Cargos & Setores',
    reports: 'Relatórios & Métricas',
    access: 'Controle de Acessos',
    audit: 'Auditoria & Logs',
    settings: 'Configurações'
  }), [user?.role]);

  // Rastreamento contínuo de navegação: toda e qualquer entrada ou saída de tela deixa rastro no histórico de auditoria
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const prevView = previousViewRef.current;
    if (prevView !== currentView) {
      const currentTitle = titles[currentView] || currentView;
      const prevTitle = prevView ? (titles[prevView] || prevView) : null;
      api.trackNavigation(currentView, currentTitle, prevTitle);
      previousViewRef.current = currentView;
    }
  }, [currentView, isAuthenticated, user, titles]);

  // Redireciona usuários sem permissão se tentarem acessar áreas restritas
  useEffect(() => {
    if (user) {
      if (user.role !== 'superadmin' && currentView === 'companies') {
        setCurrentView('dashboard');
      }
      if (user.role !== 'superadmin' && user.role !== 'admin' && (currentView === 'users' || currentView === 'roles' || currentView === 'access' || currentView === 'audit')) {
        setCurrentView('chat');
      }
      // Se for operador comum e a tela atual não constar nas suas permissões
      if (user.role !== 'superadmin' && user.role !== 'admin') {
        const allowed = Array.isArray(user.allowedScreens) 
          ? user.allowedScreens 
          : ['chat', 'kanban', 'contacts', 'products', 'quick_messages', 'tags'];
        // Configurações da Empresa é liberada para todos
        if (currentView !== 'settings' && !allowed.includes(currentView)) {
          const fallback = allowed[0] || 'chat';
          setCurrentView(fallback);
        }
      }
    }
  }, [user, currentView]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Escuta novo cliente em espera
    const cleanupWaiting = socketService.on('client-waiting', (data) => {
      desktopNotifications.notifyWaitingClient(data);
    });

    // Escuta intervenção humana solicitada
    const cleanupHuman = socketService.on('human-intervention-needed', (data) => {
      desktopNotifications.notifyWaitingClient({
        ...data,
        reason: 'Solicitação de atendente humano'
      });
    });

    // Escuta atualização de chat para status waiting
    const cleanupUpdated = socketService.on('chat-updated', (data) => {
      if (data?.status === 'waiting') {
        desktopNotifications.notifyWaitingClient(data);
      }
    });

    // Escuta suspensão / bloqueio em tempo real da empresa via Socket.IO
    const cleanupCompanySuspension = socketService.on('company_status_changed', (data) => {
      if (user?.role !== 'superadmin' && data?.companyId === user?.companyId) {
        if (data?.suspended || data?.isActive === false) {
          setSuspendedInfo({
            message: data?.message || 'Sua conta está temporariamente suspensa por pendências financeiras.',
            reason: data?.reason || 'financial_pending'
          });
        } else if (data?.isActive === true) {
          setSuspendedInfo(null);
        }
      }
    });

    // Escuta suspensão / desativação em tempo real de usuário via Socket.IO
    const cleanupUserSuspension = socketService.on('user_status_changed', (data) => {
      if (data?.userId === user?.id) {
        if (data?.suspended || data?.isActive === false) {
          setSuspendedInfo({
            message: data?.message || 'Seu acesso foi suspenso pela administração.',
            reason: 'user_inactive'
          });
        } else if (data?.isActive === true) {
          setSuspendedInfo(null);
        }
      }
    });

    // Escuta bloqueio disparado por requisições de API 403
    const handleAuthSuspended = (e) => {
      if (user?.role !== 'superadmin') {
        setSuspendedInfo(e.detail || {
          message: 'Acesso suspenso por pendências financeiras.',
          reason: 'financial_pending'
        });
      }
    };
    window.addEventListener('auth:suspended', handleAuthSuspended);

    // Navegação disparada pelo clique na notificação nativa do Windows
    const handleOpenChatFromNotification = (e) => {
      handleOpenChat(e.detail || null);
    };
    window.addEventListener('app:open_chat', handleOpenChatFromNotification);

    const handleNavigate = (e) => {
      if (e.detail) setCurrentView(e.detail);
    };
    window.addEventListener('app:navigate', handleNavigate);

    const updatePermission = () => {
      if (desktopNotifications.getPermission() !== 'default') {
        setShowNotifBanner(false);
      }
    };
    window.addEventListener('desktop:permission_changed', updatePermission);

    // Escuta notificações globais (ex: permissões atualizadas em tempo real)
    const handleToast = (e) => {
      if (e.detail?.message) {
        setGlobalToast(e.detail);
        setTimeout(() => setGlobalToast(null), 5000);
      }
    };
    window.addEventListener('app:toast', handleToast);

    return () => {
      cleanupWaiting?.();
      cleanupHuman?.();
      cleanupUpdated?.();
      cleanupCompanySuspension?.();
      cleanupUserSuspension?.();
      window.removeEventListener('auth:suspended', handleAuthSuspended);
      window.removeEventListener('app:open_chat', handleOpenChatFromNotification);
      window.removeEventListener('app:navigate', handleNavigate);
      window.removeEventListener('desktop:permission_changed', updatePermission);
      window.removeEventListener('app:toast', handleToast);
    };
  }, [isAuthenticated, user]);

  const handleRequestPermission = async () => {
    const res = await desktopNotifications.requestPermission();
    setShowNotifBanner(false);
    if (res === 'granted') {
      desktopNotifications.sendTestNotification();
    }
  };

  if (loading) {
    return (
      <div 
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--primary)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--primary)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px auto'
            }} 
          />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Carregando sistema...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Header currentViewTitle={titles[currentView] || 'Zeplyn'} />

        {showNotifBanner && (
          <div 
            style={{
              padding: '10px 24px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              fontSize: '0.86rem',
              color: 'var(--text-main)',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} style={{ color: '#10b981', flexShrink: 0 }} />
              <span>
                <strong>Notificações no Windows:</strong> Ative para receber alertas na área de trabalho e na central do Windows quando um cliente entrar na fila de espera.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <button 
                onClick={handleRequestPermission}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', height: 'auto', cursor: 'pointer' }}
              >
                Ativar Alertas do Windows
              </button>
              <button 
                onClick={() => setShowNotifBanner(false)}
                className="btn-icon"
                style={{ width: '28px', height: '28px', cursor: 'pointer' }}
                title="Fechar aviso"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ErrorBoundary key={currentView} onNavigateDashboard={() => setCurrentView('dashboard')}>
            {currentView === 'dashboard' && <DashboardView onNavigate={(view) => setCurrentView(view)} />}
            {currentView === 'wallboard' && <WallboardView onNavigate={(view) => setCurrentView(view)} onOpenChat={handleOpenChat} />}
            {currentView === 'companies' && user?.role === 'superadmin' && <CompaniesView />}
            {currentView === 'chat' && (
              <LiveChatView 
                initialChatTarget={initialChatTarget} 
                onClearInitialChatTarget={() => setInitialChatTarget(null)} 
              />
            )}
            {currentView === 'connections' && <ConnectionsView onOpenChat={handleOpenChat} />}
            {currentView === 'appointments' && <AppointmentsView onOpenChat={handleOpenChat} />}
            {currentView === 'products' && <ProductsView />}
            {currentView === 'kanban' && <KanbanView onOpenChat={handleOpenChat} />}
            {currentView === 'tags' && (
              <TagsView 
                onOpenChat={(filterTag) => {
                  if (filterTag) {
                    window.sessionStorage.setItem('initial_chat_tag_filter', filterTag);
                  }
                  handleOpenChat();
                }} 
              />
            )}
            {currentView === 'bots' && <BotsView />}
            {currentView === 'flows' && <FlowsView />}
            {currentView === 'campaigns' && <CampaignsView />}
            {currentView === 'contacts' && <ContactsView onOpenChat={handleOpenChat} />}
            {currentView === 'quick_messages' && <QuickMessagesView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'users' && (user?.role === 'superadmin' || user?.role === 'admin') && <UsersView initialTab="users" />}
            {currentView === 'roles' && (user?.role === 'superadmin' || user?.role === 'admin') && <RolesView />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'access' && (user?.role === 'superadmin' || user?.role === 'admin') && <AccessControlView />}
            {currentView === 'audit' && (user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'manager') && <AuditView />}
          </ErrorBoundary>
        </main>
      </div>

      {/* MODAL DE BLOQUEIO POR SUSPENSÃO FINANCEIRA */}
      {suspendedInfo && user?.role !== 'superadmin' && (
        <SuspendedBlockedModal 
          message={suspendedInfo.message} 
          reason={suspendedInfo.reason} 
        />
      )}

      {/* TOAST DE NOTIFICAÇÃO GLOBAL EM TEMPO REAL */}
      {globalToast && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 99999,
            padding: '14px 20px',
            borderRadius: '14px',
            backgroundColor: 'rgba(30, 41, 59, 0.96)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            maxWidth: '420px',
            fontSize: '0.86rem',
            fontWeight: 600
          }}
          className="animate-fade-in"
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
            <ShieldCheck size={18} />
          </div>
          <span style={{ flex: 1, lineHeight: '1.4' }}>{globalToast.message}</span>
          <button 
            onClick={() => setGlobalToast(null)} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* AVISO GLOBAL EM TEMPO REAL DE TECLA CAPS LOCK ATIVADA */}
      <CapsLockFloatingBanner />
    </div>
  );
}
