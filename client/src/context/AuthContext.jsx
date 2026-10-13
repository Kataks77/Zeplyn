import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken, getStoredUser, setStoredUser } from '../services/api';
import { socketService } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [socketOnline, setSocketOnline] = useState(() => Boolean(socketService.isConnected));
  const [selectedBotId, setSelectedBotId] = useState('all');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Atualiza o favicon na aba do navegador conforme o tema
    const faviconEl = document.querySelector("link[rel~='icon']");
    if (faviconEl) {
      faviconEl.href = theme === 'light' ? '/favicon-light.svg' : '/favicon-dark.svg';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    const handleSocketStatus = (e) => {
      setSocketOnline(Boolean(e.detail.connected));
    };

    const handleLocalUserUpdated = (e) => {
      if (e.detail) {
        setUser(e.detail);
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('socket:status', handleSocketStatus);
    window.addEventListener('auth:user_updated', handleLocalUserUpdated);

    // Escuta atualização de permissões do usuário em tempo real
    const cleanupUserPerms = socketService.on('user_permissions_updated', (data) => {
      if (String(data?.userId) === String(user?.id)) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, allowedScreens: data.allowedScreens };
          setStoredUser(updated);
          return updated;
        });
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: {
            message: 'Suas permissões de tela foram atualizadas em tempo real pela administração.',
            type: 'info'
          }
        }));
      }
    });

    // Escuta atualização de permissões da empresa em tempo real
    const cleanupCompanyPerms = socketService.on('company_permissions_updated', (data) => {
      if (String(data?.companyId) === String(user?.companyId)) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, companyAllowedScreens: data.allowedScreens };
          setStoredUser(updated);
          return updated;
        });
        window.dispatchEvent(new CustomEvent('app:toast', {
          detail: {
            message: 'Os módulos contratados pela sua empresa foram atualizados pelo administrador.',
            type: 'info'
          }
        }));
      }
    });

    // Escuta alteração de status ativo/inativo da empresa em tempo real
    const cleanupCompStatus = socketService.on('company_status_changed', (data) => {
      if (!data?.companyId) return;
      if (String(data.companyId) === String(user?.companyId)) {
        const isSuspended = data.suspended || data.isActive === false;
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, companyIsActive: !isSuspended };
          setStoredUser(updated);
          return updated;
        });
      }
    });

    // Escuta alteração de status ativo/inativo do usuário em tempo real
    const cleanupUserStatus = socketService.on('user_status_changed', (data) => {
      if (!data?.userId) return;
      if (String(data.userId) === String(user?.id)) {
        const isSuspended = data.suspended || data.isActive === false;
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, isActive: !isSuspended };
          setStoredUser(updated);
          return updated;
        });
      }
    });

    // Escuta alteração de status de disponibilidade para atendimento (Disponível vs Pausado)
    const cleanupAvailability = socketService.on('user:availability-changed', (data) => {
      if (String(data?.userId) === String(user?.id)) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, isAvailable: data.isAvailable !== false };
          setStoredUser(updated);
          return updated;
        });
      }
    });

    if (token) {
      socketService.connect(token);
      setSocketOnline(Boolean(socketService.isConnected));

      // Sincroniza dados e permissões atualizadas do usuário diretamente com o banco de dados
      api.getMe()
        .then(res => {
          if (res?.user) {
            setUser(res.user);
            setStoredUser(res.user);
          }
        })
        .catch(err => {
          console.warn('Aviso ao sincronizar perfil do usuário:', err?.message);
        });
    } else {
      socketService.disconnect();
      setSocketOnline(false);
    }

    setLoading(false);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('socket:status', handleSocketStatus);
      window.removeEventListener('auth:user_updated', handleLocalUserUpdated);
      if (typeof cleanupUserPerms === 'function') cleanupUserPerms();
      if (typeof cleanupCompanyPerms === 'function') cleanupCompanyPerms();
      if (typeof cleanupCompStatus === 'function') cleanupCompStatus();
      if (typeof cleanupUserStatus === 'function') cleanupUserStatus();
      if (typeof cleanupAvailability === 'function') cleanupAvailability();
    };
  }, [token, user?.id, user?.companyId]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.token && res.user) {
      setStoredToken(res.token);
      setStoredUser(res.user);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error('Falha ao autenticar.');
  };

  const register = async (payload) => {
    const res = await api.register(payload);
    return res;
  };

  const updateAvailability = async (isAvailable) => {
    try {
      const res = await api.updateAvailability(isAvailable);
      const updated = { ...user, isAvailable: res.isAvailable !== false };
      setStoredUser(updated);
      setUser(updated);
      return res;
    } catch (err) {
      console.error('Erro ao atualizar disponibilidade:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignorar falha no endpoint de logout
    } finally {
      setStoredToken(null);
      setStoredUser(null);
      setToken(null);
      setUser(null);
      socketService.disconnect();
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    isAvailable: user?.isAvailable !== false,
    updateAvailability,
    loading,
    login,
    register,
    logout,
    theme,
    toggleTheme,
    socketOnline,
    selectedBotId,
    setSelectedBotId
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
