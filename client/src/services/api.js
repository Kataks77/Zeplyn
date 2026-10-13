import { encryptPayload, decryptPayload, isCryptoAvailable } from './crypto';

const API_BASE = '/api';

// Lista de rotas sensíveis a serem criptografadas de ponta a ponta
const SENSITIVE_ENDPOINTS = [
  '/login',
  '/register',
  '/logout',
  '/users',
  '/openai-key',
  '/groq-key',
  '/chats',
  '/contacts',
  '/settings',
  '/business-hours',
  '/notifications',
  '/bots',
  '/quick-messages',
  '/quick-replies',
  '/companies',
  '/dashboard',
  '/campaigns',
  '/roles',
  '/reports',
  '/stickers',
  '/metrics',
  '/record-metrics',
  '/audit-logs',
  '/appointments',
  '/products',
  '/wallboard'
];

function isSensitiveEndpoint(endpoint) {
  if (!endpoint) return false;
  const clean = endpoint.toLowerCase().split('?')[0];
  // Exclui apenas rotas de monitoramento público de infraestrutura e downloads binários
  if (clean === '/health' || clean.includes('/export')) return false;
  return SENSITIVE_ENDPOINTS.some(sens => clean.startsWith(sens) || clean.includes(sens)) || clean.startsWith('/');
}

export function getStoredToken() {
  return localStorage.getItem('sessionToken') || localStorage.getItem('token') || '';
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('sessionToken', token);
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('token');
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const canEncrypt = isCryptoAvailable() && isSensitiveEndpoint(endpoint);
  let requestOptions = { ...options };

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(canEncrypt ? { 'X-Encrypted-Payload': 'true', 'X-Accept-Encrypted': 'true' } : {}),
    ...(options.headers || {})
  };

  // Se for rota sensível, o ambiente suportar criptografia nativa e houver body JSON
  if (canEncrypt && requestOptions.body && !(requestOptions.body instanceof FormData)) {
    try {
      const encrypted = await encryptPayload(requestOptions.body);
      if (encrypted && typeof encrypted === 'string' && encrypted.includes(':')) {
        requestOptions.body = JSON.stringify({ _enc: encrypted });
      }
    } catch (encErr) {
      console.warn('⚠️ [API Client] Aviso na criptografia do payload, enviando padrão:', encErr);
    }
  }

  // Se o body for FormData (upload de arquivo), não setar Content-Type para o browser gerar o boundary
  if (requestOptions.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...requestOptions,
    headers
  });

  let data;
  try {
    data = await response.json();
    // Descriptografar resposta recebida se estiver criptografada
    if (data && typeof data === 'object' && data._enc) {
      if (isCryptoAvailable()) {
        data = await decryptPayload(data._enc);
      } else {
        data = data._enc;
      }
    }
  } catch {
    data = null;
  }

  if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
    setStoredToken(null);
    setStoredUser(null);
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403 && (data?.suspended || (data?.error && (data.error.includes('suspens') || data.error.includes('pendência'))))) {
    window.dispatchEvent(new CustomEvent('auth:suspended', { 
      detail: { 
        message: data?.error || 'Acesso suspenso por pendências financeiras. Entre em contato com o setor financeiro.',
        reason: data?.reason || 'financial_pending'
      } 
    }));
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Erro ${response.status} na requisição`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => apiRequest('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) => apiRequest('/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => apiRequest('/logout', { method: 'POST' }),

  // Bots
  getBots: async () => {
    const res = await apiRequest('/bots');
    return Array.isArray(res) ? res : (res?.bots || []);
  },
  getBot: (id) => apiRequest(`/bots/${id}`),
  createBot: (payload) => apiRequest('/bots', { method: 'POST', body: JSON.stringify(payload) }),
  updateBot: (id, payload) => apiRequest(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBot: (id) => apiRequest(`/bots/${id}`, { method: 'DELETE' }),
  startBot: (id, forceNewAuth = false) => apiRequest(`/bots/${id}/start`, { method: 'POST', body: JSON.stringify({ forceNewAuth }) }),
  stopBot: (id) => apiRequest(`/bots/${id}/stop`, { method: 'POST' }),
  disconnectBot: (id) => apiRequest(`/bots/${id}/disconnect`, { method: 'POST' }),
  testBot: (id, message) => apiRequest(`/bots/${id}/test`, { method: 'POST', body: JSON.stringify({ message }) }),
  getBotQR: async (id) => {
    const res = await apiRequest(`/bots/${id}/qr`);
    return {
      qr: res?.qrCode || res?.qr || null,
      qrCode: res?.qrCode || res?.qr || null,
      status: res?.status || 'ready'
    };
  },
  getBotQA: (botId) => apiRequest(`/bots/${botId}/qa`),
  addBotQA: (botId, payload) => apiRequest(`/bots/${botId}/qa`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteBotQA: (botId, qaId) => apiRequest(`/bots/${botId}/qa/${qaId}`, { method: 'DELETE' }),

  // Chats & Messages
  getChats: async (params = '') => {
    const res = await apiRequest(`/chats${params ? `?${params}` : ''}`);
    return res?.chats || (Array.isArray(res) ? res : []);
  },
  openChat: (payload) => apiRequest('/chats/open', { method: 'POST', body: JSON.stringify(payload) }),
  getChatMessages: async (botId, contactJid) => {
    const res = await apiRequest(`/chats/${botId}/${encodeURIComponent(contactJid)}/messages`);
    return res?.history || (Array.isArray(res) ? res : []);
  },
  sendMessage: (payload) => apiRequest('/chats/send-message', {
    method: 'POST',
    body: JSON.stringify({
      botId: payload.botId,
      contactJid: payload.to || payload.contactJid,
      to: payload.to || payload.contactJid,
      content: payload.message || payload.content,
      message: payload.message || payload.content,
      quotedMsgId: payload.quotedMsgId
    })
  }),
  takeOverChat: (chatId) => apiRequest(`/chats/${chatId}/takeover`, { method: 'POST', body: JSON.stringify({ chatId }) }),
  transferChat: (payload) => apiRequest('/chats/transfer', { method: 'POST', body: JSON.stringify(payload) }),
  finishChat: (chatId) => apiRequest(`/chats/${chatId}/finish`, { method: 'POST', body: JSON.stringify({ chatId }) }),
  reopenChat: (chatId) => apiRequest(`/chats/${chatId}/reopen`, { method: 'POST', body: JSON.stringify({ chatId }) }),
  reactToMessage: (payload) => apiRequest('/chats/react', { method: 'POST', body: JSON.stringify(payload) }),
  aiRewrite: (payload) => apiRequest('/chats/ai-rewrite', { method: 'POST', body: JSON.stringify(payload) }),
  updateChatTags: (payload) => apiRequest('/chats/tags', { method: 'POST', body: JSON.stringify(payload) }),
  getUserTags: async () => {
    const res = await apiRequest('/chats/user-tags');
    return res?.tags || [];
  },
  createUserTag: (payload) => apiRequest('/chats/user-tags', { method: 'POST', body: JSON.stringify(payload) }),
  updateUserTag: (tagId, payload) => apiRequest(`/chats/user-tags/${tagId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUserTag: (tagId) => apiRequest(`/chats/user-tags/${tagId}`, { method: 'DELETE' }),
  saveInternalNote: (payload) => apiRequest('/chats/internal-note', { method: 'POST', body: JSON.stringify(payload) }),
  summarizeChat: (payload) => apiRequest('/chats/summarize', { method: 'POST', body: JSON.stringify(payload) }),
  transcribeAudio: (payload) => apiRequest('/chats/transcribe-audio', { method: 'POST', body: JSON.stringify(payload) }),
  getQueueStats: async (botId = '') => {
    const res = await apiRequest(`/chats/queue/stats${botId ? `?botId=${botId}` : ''}`);
    return res?.stats || (res?.waitingCount !== undefined ? res : { waitingCount: 0, avgWaitSeconds: 0, avgWaitFormatted: '0 min' });
  },
  scheduleMessage: (payload) => apiRequest('/chats/scheduled', { method: 'POST', body: JSON.stringify(payload) }),
  cancelScheduledMessage: (id) => apiRequest(`/chats/scheduled/${id}`, { method: 'DELETE' }),

  // Contacts
  getContacts: async (botId = '') => {
    const res = await apiRequest(`/contacts${botId ? `?botId=${botId}` : ''}`);
    return res?.contacts || (Array.isArray(res) ? res : []);
  },
  createContact: (payload) => apiRequest('/contacts', { method: 'POST', body: JSON.stringify(payload) }),
  deleteContact: (payload) => apiRequest('/contacts/delete', { method: 'POST', body: JSON.stringify(payload) }),
  syncContactsFromChats: (botId) => apiRequest('/contacts/sync-chats', { method: 'POST', body: JSON.stringify({ botId }) }),
  importContactsArray: (botId, contacts) => apiRequest('/contacts/import-array', { method: 'POST', body: JSON.stringify({ botId, contacts }) }),
  clearContacts: (botId) => apiRequest('/contacts/clear', { method: 'POST', body: JSON.stringify({ botId }) }),
  syncContactPhotos: (botId = '', limit = 150) => apiRequest('/contacts/sync-photos', { method: 'POST', body: JSON.stringify({ botId, limit }) }),
  refreshContactPhoto: (contactId, botId = '') => apiRequest('/contacts/refresh-photo', { method: 'POST', body: JSON.stringify({ contactId, botId }) }),

  // Stickers / Figurinhas vinculadas ao usuário
  getStickers: async (botId = '') => {
    const res = await apiRequest(`/stickers${botId ? `?botId=${botId}` : ''}`);
    return res?.stickers || [];
  },
  uploadSticker: (formData) => apiRequest('/stickers/upload', { method: 'POST', body: formData }),
  saveSticker: (data) => apiRequest('/stickers/save', { method: 'POST', body: JSON.stringify(data) }),
  deleteSticker: (id) => apiRequest(`/stickers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  syncStickers: (botId) => apiRequest('/stickers/sync', { method: 'POST', body: JSON.stringify({ botId }) }),

  // Quick Messages (Legado)
  getQuickMessages: async () => {
    const res = await apiRequest('/quick-replies');
    return res?.quickReplies || [];
  },
  saveQuickMessage: (payload) => apiRequest('/quick-replies', { method: 'POST', body: JSON.stringify(payload) }),
  deleteQuickMessage: (id) => apiRequest(`/quick-replies/${id}`, { method: 'DELETE' }),

  // Quick Replies (Atalhos com / e Variáveis Dinâmicas)
  getQuickReplies: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    const queryString = query.toString();
    const res = await apiRequest(`/quick-replies${queryString ? '?' + queryString : ''}`);
    return res?.quickReplies || [];
  },
  createQuickReply: (payload) => apiRequest('/quick-replies', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuickReply: (id, payload) => apiRequest(`/quick-replies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteQuickReply: (id) => apiRequest(`/quick-replies/${id}`, { method: 'DELETE' }),
  previewQuickReply: (payload) => apiRequest('/quick-replies/preview', { method: 'POST', body: JSON.stringify(payload) }),

  // Metrics & Settings
  getMetrics: () => apiRequest('/metrics'),
  getSettings: () => apiRequest('/settings'),
  saveSettings: (payload) => apiRequest('/settings', { method: 'POST', body: JSON.stringify(payload) }),
  getBusinessHours: () => apiRequest('/business-hours'),
  saveBusinessHours: (payload) => apiRequest('/business-hours', { method: 'POST', body: JSON.stringify(payload) }),
  getHolidays: async () => {
    const res = await apiRequest('/business-hours/holidays');
    return res?.holidays || [];
  },
  addHoliday: (payload) => apiRequest('/business-hours/holidays', { method: 'POST', body: JSON.stringify(payload) }),
  deleteHoliday: (id) => apiRequest(`/business-hours/holidays/${id}`, { method: 'DELETE' }),
  getChatDossier: async (botId, contactJid, protocol = null) => {
    const url = `/chats/${botId}/${encodeURIComponent(contactJid)}/dossier${protocol ? `?protocol=${encodeURIComponent(protocol)}` : ''}`;
    const res = await apiRequest(url);
    return res?.dossier || null;
  },
  getChatAttendances: async (botId, contactJid) => {
    try {
      const res = await apiRequest(`/chats/${encodeURIComponent(botId)}/${encodeURIComponent(contactJid)}/attendances`);
      return res?.attendances || [];
    } catch (e) {
      console.warn('Erro ao obter histórico de atendimentos:', e);
      return [];
    }
  },
  updateContactName: (payload) => apiRequest('/chats/contact-name', { method: 'POST', body: JSON.stringify(payload) }),
  subscribePresence: (payload) => apiRequest('/chats/presence/subscribe', { method: 'POST', body: JSON.stringify(payload) }),
  submitCsat: (payload) => apiRequest('/chats/csat', { method: 'POST', body: JSON.stringify(payload) }),

  // Mensagens Agendadas & Follow-up
  getScheduledMessages: async (botId, contactJid) => {
    try {
      const res = await apiRequest(`/chats/${encodeURIComponent(botId)}/${encodeURIComponent(contactJid)}/scheduled-messages`);
      return res?.data || res?.scheduled || res?.messages || (Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('Erro ao obter mensagens agendadas:', e);
      return [];
    }
  },
  scheduleMessage: (payload) => apiRequest('/chats/schedule-message', { method: 'POST', body: JSON.stringify(payload) }),
  cancelScheduledMessage: (id) => apiRequest(`/chats/scheduled-messages/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Central de Agendamentos & Calendário
  getAppointments: async (params = {}) => {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await apiRequest(`/appointments${query ? `?${query}` : ''}`);
      return res?.appointments || [];
    } catch (e) {
      console.warn('Erro ao obter agendamentos:', e);
      return [];
    }
  },
  getAppointmentById: (id) => apiRequest(`/appointments/${encodeURIComponent(id)}`),
  createAppointment: (payload) => apiRequest('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAppointment: (id, payload) => apiRequest(`/appointments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAppointment: (id) => apiRequest(`/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  sendAppointmentReminder: (id, type = 'manual') => apiRequest(`/appointments/${encodeURIComponent(id)}/reminder`, { method: 'POST', body: JSON.stringify({ type }) }),
  getOpenAIKeyStatus: () => apiRequest('/openai-key'),
  saveOpenAIKey: (apiKey) => apiRequest('/openai-key', { method: 'POST', body: JSON.stringify({ apiKey }) }),
  getGroqKeyStatus: () => apiRequest('/groq-key'),
  saveGroqKey: (apiKey) => apiRequest('/groq-key', { method: 'POST', body: JSON.stringify({ apiKey }) }),

  // Users
  getUsers: async () => {
    const res = await apiRequest('/users');
    return Array.isArray(res) ? res : (res?.users || []);
  },
  getAttendants: async (companyId = '') => {
    const res = await apiRequest(`/users/attendants${companyId ? `?companyId=${companyId}` : ''}`);
    return Array.isArray(res) ? res : [];
  },
  updateAvailability: (isAvailable) => apiRequest('/users/me/availability', {
    method: 'PUT',
    body: JSON.stringify({ isAvailable })
  }),
  createUser: (payload) => apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id, payload) => apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Companies (Multi-Tenant SaaS)
  getCompanies: async () => {
    const res = await apiRequest('/companies');
    return Array.isArray(res) ? res : (res?.companies || []);
  },
  getCompany: (id) => apiRequest(`/companies/${id}`),
  getCompanyDetails: (id) => apiRequest(`/companies/${id}/details`),
  createCompany: (payload) => apiRequest('/companies', { method: 'POST', body: JSON.stringify(payload) }),
  updateCompany: (id, payload) => apiRequest(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCompany: (id) => apiRequest(`/companies/${id}`, { method: 'DELETE' }),

  // Campaigns (Disparos em Massa)
  getCampaigns: async (params = '') => {
    const res = await apiRequest(`/campaigns${params ? `?${params}` : ''}`);
    return res?.campaigns || (Array.isArray(res) ? res : []);
  },
  getCampaign: (id) => apiRequest(`/campaigns/${id}`),
  createCampaign: (payload) => apiRequest('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  startCampaign: (id) => apiRequest(`/campaigns/${id}/start`, { method: 'POST' }),
  pauseCampaign: (id) => apiRequest(`/campaigns/${id}/pause`, { method: 'POST' }),
  cancelCampaign: (id) => apiRequest(`/campaigns/${id}/cancel`, { method: 'POST' }),
  deleteCampaign: (id) => apiRequest(`/campaigns/${id}`, { method: 'DELETE' }),
  getCampaignLogs: async (id) => {
    const res = await apiRequest(`/campaigns/${id}/logs`);
    return res?.logs || [];
  },

  // Company Roles (Cargos da Empresa) & Setores
  getRoles: async (companyId = '') => {
    const res = await apiRequest(`/roles${companyId ? `?companyId=${companyId}` : ''}`);
    return res?.roles || (Array.isArray(res) ? res : []);
  },
  getCompanyDepartments: async (companyId = '') => {
    const res = await apiRequest(`/roles/departments${companyId ? `?companyId=${companyId}` : ''}`);
    return res?.departments || (Array.isArray(res) ? res : []);
  },
  getRole: (id) => apiRequest(`/roles/${id}`),
  createRole: (payload) => apiRequest('/roles', { method: 'POST', body: JSON.stringify(payload) }),
  updateRole: (id, payload) => apiRequest(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRole: (id) => apiRequest(`/roles/${id}`, { method: 'DELETE' }),

  // Reports & Advanced Metrics (Relatórios & Métricas)
  getAdvancedReports: async (queryParams = '') => {
    const res = await apiRequest(`/reports/advanced${queryParams ? `?${queryParams}` : ''}`);
    return res?.report || null;
  },
  downloadReportCsv: async (queryParams = '') => {
    const token = getStoredToken();
    const res = await fetch(`/api/reports/export?format=csv${queryParams ? `&${queryParams}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('Erro ao exportar relatório CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_metricas_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadReportPdf: async (queryParams = '') => {
    const token = getStoredToken();
    const res = await fetch(`/api/reports/export?format=pdf${queryParams ? `&${queryParams}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao exportar relatório em PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_metricas_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadChatDossierPdf: async (chatId, protocol = '') => {
    const token = getStoredToken();
    const res = await fetch(`/api/chats/${chatId}/pdf${protocol ? `?protocol=${encodeURIComponent(protocol)}` : ''}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao exportar dossiê em PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dossie_atendimento_${chatId}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Upload
  uploadFile: (formData) => apiRequest('/upload', { method: 'POST', body: formData }),

  // Access Control & Permissions (Controle de Acessos & Telas)
  getAccessMatrix: () => apiRequest('/access/matrix'),
  updateCompanyAccess: (companyId, allowedScreens) => apiRequest(`/access/company/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify({ allowedScreens })
  }),
  updateUserAccess: (userId, allowedScreens) => apiRequest(`/access/user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ allowedScreens })
  }),

  // Audit Logs (Trilha de Auditoria)
  getAuditLogs: (queryParams = '') => apiRequest(`/audit-logs${queryParams ? `?${queryParams}` : ''}`),
  trackNavigation: (screenId, screenTitle, previousScreen) => apiRequest('/audit-logs/track', {
    method: 'POST',
    body: JSON.stringify({ screenId, screenTitle, previousScreen })
  }).catch(() => {}),

  // Produtos & Catálogo Multi-Empresas
  getProducts: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.category && params.category !== 'Todas') q.append('category', params.category);
    if (params.isActive !== undefined && params.isActive !== 'all') q.append('isActive', params.isActive);
    if (params.companyId) q.append('companyId', params.companyId);
    if (params.sortBy) q.append('sortBy', params.sortBy);
    if (params.sortOrder) q.append('sortOrder', params.sortOrder);
    const qs = q.toString();
    return apiRequest(`/products${qs ? `?${qs}` : ''}`);
  },
  getProduct: (id) => apiRequest(`/products/${id}`),
  createProduct: (data) => apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProduct: (id, data) => apiRequest(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteProduct: (id) => apiRequest(`/products/${id}`, {
    method: 'DELETE'
  }),
  toggleProductStatus: (id) => apiRequest(`/products/${id}/toggle-status`, {
    method: 'PATCH'
  }),
  getProductCategories: (companyId = '') => apiRequest(`/products/categories${companyId ? `?companyId=${companyId}` : ''}`),
  getWallboard: (queryParams = '') => apiRequest(`/wallboard${queryParams ? `?${queryParams}` : ''}`)
};
