import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Columns3, 
  Tag,
  Bot, 
  Users, 
  Zap, 
  UserCheck, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  GitBranch,
  Megaphone,
  Briefcase,
  BarChart3,
  Smartphone,
  ShieldCheck,
  ClipboardList,
  PhoneCall,
  Calendar,
  Package,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ZeplynLogo from './ZeplynLogo';

export default function Sidebar({ currentView, setCurrentView, collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [hoveredFooter, setHoveredFooter] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdminOrSuper = isSuperAdmin || user?.role === 'admin';

  // Grupos organizados e categorizados de navegação (Estrutura Operacional)
  const navSections = [
    {
      id: 'support_crm',
      title: 'Atendimento & CRM',
      items: [
        { 
          id: 'chat', 
          label: 'Atendimento ao Vivo', 
          icon: MessageSquare
        },
        { 
          id: 'kanban', 
          label: 'Quadro Kanban', 
          icon: Columns3 
        },
        { 
          id: 'appointments', 
          label: 'Agenda & Lembretes', 
          icon: Calendar
        },
        { 
          id: 'products', 
          label: 'Produtos & Catálogo', 
          icon: Package
        },
        { 
          id: 'contacts', 
          label: 'Contatos CRM', 
          icon: Users 
        },
        { 
          id: 'quick_messages', 
          label: 'Respostas Rápidas', 
          icon: Zap 
        },
        { 
          id: 'tags', 
          label: 'Etiquetas & Tags', 
          icon: Tag 
        }
      ]
    },
    {
      id: 'overview',
      title: 'Visão Geral & Métricas',
      items: [
        { 
          id: 'dashboard', 
          label: 'Dashboard Geral', 
          icon: LayoutDashboard 
        },
        { 
          id: 'wallboard', 
          label: 'Torre de Controle', 
          icon: Radio,
          badge: 'AO VIVO',
          badgeVariant: 'emerald'
        },
        { 
          id: 'reports', 
          label: 'Relatórios & Métricas', 
          icon: BarChart3
        }
      ]
    },
    {
      id: 'automation_ai',
      title: 'Canais & Automação',
      items: [
        { 
          id: 'connections', 
          label: 'Conexões WhatsApp', 
          icon: Smartphone
        },
        { 
          id: 'bots', 
          label: 'Bots & IA Avançada', 
          icon: Bot
        },
        { 
          id: 'flows', 
          label: 'Central URA & Menus', 
          icon: PhoneCall
        },
        { 
          id: 'campaigns', 
          label: 'Disparos em Massa', 
          icon: Megaphone
        }
      ]
    },
    {
      id: 'administration',
      title: isSuperAdmin ? 'Administração SaaS' : 'Gestão & Equipe',
      items: [
        ...(isSuperAdmin ? [
          { 
            id: 'companies', 
            label: 'Empresas SaaS', 
            icon: Building2 
          },
          { 
            id: 'users', 
            label: 'Usuários Globais', 
            icon: UserCheck 
          },
          { 
            id: 'access', 
            label: 'Controle de Acessos', 
            icon: ShieldCheck
          },
          { 
            id: 'audit', 
            label: 'Auditoria & Logs', 
            icon: ClipboardList
          },
          { 
            id: 'settings', 
            label: 'Configurações SaaS', 
            icon: Settings 
          }
        ] : (isAdminOrSuper ? [
          { 
            id: 'users', 
            label: 'Minha Equipe', 
            icon: Users
          },
          { 
            id: 'roles', 
            label: 'Cargos & Setores', 
            icon: Briefcase 
          },
          { 
            id: 'access', 
            label: 'Controle de Acessos', 
            icon: ShieldCheck
          },
          { 
            id: 'audit', 
            label: 'Auditoria da Empresa', 
            icon: ClipboardList
          },
          { 
            id: 'settings', 
            label: 'Configurações da Empresa', 
            icon: Settings 
          }
        ] : [
          { 
            id: 'settings', 
            label: 'Configurações da Empresa', 
            icon: Settings 
          }
        ]))
      ]
    }
  ];

  // Validador de permissão por tela e empresa
  const isItemAllowed = (item) => {
    // Configurações da Empresa: visível para todos os usuários
    if (item.id === 'settings') return true;

    // Superadmin sempre tem acesso total
    if (isSuperAdmin) return true;

    // Telas restritas exclusivas de Superadmin
    if (item.id === 'companies') return false;

    // A tela de acessos e auditoria são permitidas para Admin da empresa gerenciar a equipe
    if (item.id === 'access' || item.id === 'audit') return isAdminOrSuper;

    // Se for Admin da empresa, tem acesso irrestrito às ferramentas administrativas
    if (user?.role === 'admin') {
      if (['users', 'roles', 'audit', 'access'].includes(item.id)) return true;
      // Se a empresa possui restrição de módulos pelo Superadmin:
      if (Array.isArray(user?.companyAllowedScreens) && user.companyAllowedScreens.length > 0) {
        return user.companyAllowedScreens.includes(item.id);
      }
      return true;
    }

    // Para clientes / operadores comuns:
    // 1. Não pode ver telas de gestão/administração exclusivas
    if (['users', 'roles', 'companies', 'access', 'audit'].includes(item.id)) return false;

    // 2. Se a empresa tem restrição, bloqueia
    if (Array.isArray(user?.companyAllowedScreens) && user.companyAllowedScreens.length > 0) {
      if (!user.companyAllowedScreens.includes(item.id)) return false;
    }

    // 3. Se o usuário tem allowedScreens configurado:
    if (Array.isArray(user?.allowedScreens)) {
      return user.allowedScreens.includes(item.id);
    }

    // 4. Padrão se ainda não foi personalizado pelo admin:
    const defaultOperatorScreens = ['chat', 'kanban', 'contacts', 'products', 'quick_messages', 'tags'];
    return defaultOperatorScreens.includes(item.id);
  };

  const getBadgeStyle = (variant) => {
    switch (variant) {
      case 'purple':
        return {
          backgroundColor: 'rgba(168, 85, 247, 0.16)',
          color: '#d8b4fe',
          border: '1px solid rgba(168, 85, 247, 0.35)'
        };
      case 'emerald':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.16)',
          color: '#6ee7b7',
          border: '1px solid rgba(16, 185, 129, 0.35)'
        };
      case 'rose':
        return {
          backgroundColor: 'rgba(244, 63, 94, 0.16)',
          color: '#fda4af',
          border: '1px solid rgba(244, 63, 94, 0.35)'
        };
      case 'cyan':
        return {
          backgroundColor: 'rgba(6, 182, 212, 0.16)',
          color: '#67e8f9',
          border: '1px solid rgba(6, 182, 212, 0.35)'
        };
      case 'indigo':
      default:
        return {
          backgroundColor: 'rgba(99, 102, 241, 0.16)',
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.35)'
        };
    }
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  const userRoleLabel = isSuperAdmin 
    ? 'Super Admin' 
    : (user?.role === 'admin' 
        ? 'Admin' 
        : (user?.companyName || 'Atendente'));

  return (
    <aside 
      style={{
        width: collapsed ? '72px' : '268px',
        minWidth: collapsed ? '72px' : '268px',
        height: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        zIndex: 50,
        userSelect: 'none'
      }}
    >
      {/* Brand Header */}
      <div 
        style={{
          height: '70px',
          padding: collapsed ? '0 14px' : '0 18px 0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
          <ZeplynLogo 
            size={collapsed ? 36 : 38} 
            showText={!collapsed} 
            subtitle="Enterprise v2.0" 
          />
        </div>

        {!collapsed && (
          <button 
            onClick={() => setCollapsed(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Recolher barra lateral"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Botão de Expandir quando recolhido */}
      {collapsed && (
        <div style={{ padding: '8px 12px 0 12px', flexShrink: 0 }}>
          <button 
            onClick={() => setCollapsed(false)}
            style={{
              width: '100%',
              height: '32px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--primary)';
              e.currentTarget.style.borderColor = 'var(--primary-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
            title="Expandir barra lateral"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Nav List Organizada em Seções */}
      <div 
        style={{
          flex: 1,
          padding: collapsed ? '10px 8px 16px 8px' : '14px 10px 16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.12) transparent'
        }}
      >
        {navSections.map((section, sIndex) => {
          const visibleItems = section.items.filter(item => isItemAllowed(item));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Título ou Divisor de Seção */}
              {!collapsed ? (
                <div 
                  style={{
                    padding: '0 12px',
                    marginTop: sIndex === 0 && !collapsed ? '2px' : '16px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span 
                    style={{
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {section.title}
                  </span>
                </div>
              ) : (
                sIndex > 0 && (
                  <div 
                    style={{
                      height: '1px',
                      backgroundColor: 'var(--border-subtle)',
                      margin: '8px 10px'
                    }} 
                  />
                )
              )}

              {/* Itens da Seção */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  const isHovered = hoveredItemId === item.id;

                  return (
                    <div 
                      key={item.id} 
                      style={{ position: 'relative' }}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      <button
                        onClick={() => setCurrentView(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          height: '38px',
                          padding: collapsed ? '0' : '0 14px',
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: '9px',
                          border: 'none',
                          background: isActive 
                            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0.05) 100%)' 
                            : (isHovered ? 'var(--bg-card-hover)' : 'transparent'),
                          color: isActive ? 'var(--primary)' : (isHovered ? 'var(--text-main)' : 'var(--text-secondary)'),
                          fontWeight: isActive ? 600 : 500,
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                          textAlign: 'left'
                        }}
                      >
                        {/* Linha indicadora ativa */}
                        {isActive && (
                          <div 
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '15%',
                              bottom: '15%',
                              width: '3.5px',
                              borderRadius: '0 4px 4px 0',
                              backgroundColor: 'var(--primary)',
                              boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                            }} 
                          />
                        )}

                        <Icon 
                          size={19} 
                          strokeWidth={isActive ? 2.3 : 1.8} 
                          style={{ 
                            flexShrink: 0,
                            color: isActive ? 'var(--primary)' : 'inherit',
                            transform: isHovered && !isActive ? 'scale(1.06)' : 'none',
                            transition: 'transform 0.15s ease'
                          }} 
                        />

                        {!collapsed && (
                          <div 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              width: '100%', 
                              overflow: 'hidden' 
                            }}
                          >
                            <span 
                              style={{ 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {item.label}
                            </span>
                            {item.badge && (
                              <span 
                                style={{
                                  ...getBadgeStyle(item.badgeVariant),
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  marginLeft: '6px',
                                  flexShrink: 0,
                                  letterSpacing: '0.02em'
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>

                      {/* Tooltip flutuante elegante quando recolhido */}
                      {collapsed && isHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 'calc(100% + 12px)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: 'rgba(22, 28, 45, 0.98)',
                            border: '1px solid var(--border-subtle)',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            whiteSpace: 'nowrap',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            pointerEvents: 'none'
                          }}
                        >
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span 
                              style={{
                                ...getBadgeStyle(item.badgeVariant),
                                fontSize: '0.64rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '6px'
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Footer */}
      <div 
        style={{
          padding: collapsed ? '12px 8px' : '14px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          backgroundColor: 'var(--bg-primary)',
          flexShrink: 0,
          position: 'relative'
        }}
        onMouseEnter={() => setHoveredFooter(true)}
        onMouseLeave={() => setHoveredFooter(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {/* Avatar com status online */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'var(--primary)'
              }}
            >
              {userInitial}
            </div>
            <div 
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: user?.isAvailable !== false ? '#10b981' : '#f59e0b',
                border: '2px solid var(--bg-primary)',
                boxShadow: user?.isAvailable !== false ? '0 0 6px rgba(16, 185, 129, 0.6)' : '0 0 6px rgba(245, 158, 11, 0.6)'
              }} 
              title={user?.isAvailable !== false ? 'Disponível para atendimentos' : 'Pausado para atendimentos'}
            />
          </div>

          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <span 
                style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  color: 'var(--text-main)', 
                  whiteSpace: 'nowrap', 
                  textOverflow: 'ellipsis', 
                  overflow: 'hidden' 
                }}
              >
                {user?.name || 'Operador'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <span 
                  style={{ 
                    fontSize: '0.72rem', 
                    color: isSuperAdmin ? '#10b981' : 'var(--text-muted)', 
                    fontWeight: isSuperAdmin ? 600 : 400, 
                    whiteSpace: 'nowrap', 
                    textOverflow: 'ellipsis', 
                    overflow: 'hidden' 
                  }}
                >
                  {userRoleLabel}
                </span>
                <span style={{ fontSize: '0.68rem', color: user?.isAvailable !== false ? '#10b981' : '#f59e0b', fontWeight: 600, flexShrink: 0 }}>
                  • {user?.isAvailable !== false ? 'Disponível' : 'Pausado'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botão de Logout */}
        {!collapsed ? (
          <button 
            onClick={logout}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = 'var(--status-error)'; 
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = 'var(--text-muted)'; 
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Sair do sistema"
          >
            <LogOut size={18} />
          </button>
        ) : (
          hoveredFooter && (
            <div
              style={{
                position: 'absolute',
                left: 'calc(100% + 12px)',
                bottom: '12px',
                backgroundColor: 'rgba(22, 28, 45, 0.98)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(12px)',
                borderRadius: '10px',
                padding: '10px 14px',
                whiteSpace: 'nowrap',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {user?.name || 'Operador'}
                </div>
                <div style={{ fontSize: '0.72rem', color: isSuperAdmin ? '#10b981' : 'var(--text-muted)' }}>
                  {userRoleLabel}
                </div>
              </div>
              <button
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--status-error)',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--status-error)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = 'var(--status-error)';
                }}
              >
                <LogOut size={14} />
                <span>Sair do sistema</span>
              </button>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
