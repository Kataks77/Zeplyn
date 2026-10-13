import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, 
  Send, 
  Paperclip, 
  Bot, 
  User, 
  CheckCheck, 
  CheckCircle, 
  CornerUpLeft, 
  FileText, 
  Zap,
  MoreVertical,
  X,
  MessageSquare,
  Smile,
  Mic,
  Trash2,
  Sparkles,
  Loader2,
  Undo2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Sticker,
  Plus,
  RefreshCw,
  Tag,
  Lock,
  Pin,
  MapPin,
  Copy,
  Check,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Square,
  Edit2,
  Settings,
  Clock,
  Calendar,
  Star,
  Printer,
  Download,
  ShieldCheck,
  Headphones,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  MoreHorizontal,
  ArrowRightLeft,
  UserCheck,
  Users,
  Building2,
  Package,
  Camera
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { desktopNotifications } from '../services/desktopNotifications';
import WhatsAppAudioPlayer from '../components/chat/WhatsAppAudioPlayer';
import ChatMessageItem from '../components/chat/ChatMessageItem';

export const TelegramIcon = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export const InstagramIcon = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

export const WhatsAppIcon = ({ size = 14, color = 'currentColor', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

export const getChannelMeta = (channel, jid = '') => {
  const norm = channel || (jid?.endsWith('@telegram') ? 'telegram' : jid?.endsWith('@instagram') ? 'instagram' : 'whatsapp');
  if (norm === 'telegram') {
    return {
      channel: 'telegram',
      label: 'Telegram',
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.15)',
      border: 'rgba(2, 132, 199, 0.35)',
      icon: <TelegramIcon size={12} color="#0284c7" />
    };
  }
  if (norm === 'instagram') {
    return {
      channel: 'instagram',
      label: 'Instagram',
      color: '#e1306c',
      bg: 'rgba(225, 48, 108, 0.15)',
      border: 'rgba(225, 48, 108, 0.35)',
      icon: <InstagramIcon size={12} color="#e1306c" />
    };
  }
  return {
    channel: 'whatsapp',
    label: 'WhatsApp',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.35)',
    icon: <WhatsAppIcon size={12} color="#10b981" />
  };
};

export const PRESET_TAGS = [];

export const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getTagStyle = (tag, userTags = []) => {
  const label = typeof tag === 'string' ? tag : (tag?.name || tag?.label || '');
  if (!label) return { id: '', label: '', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };

  // 1. Prioridade: Etiquetas e Nomenclaturas personalizadas do usuário
  if (Array.isArray(userTags) && userTags.length > 0) {
    const userFound = userTags.find(t => (t.name && t.name.toLowerCase() === label.toLowerCase()) || t.id === tag?.id || t.id === label);
    if (userFound) {
      const c = userFound.color || '#3b82f6';
      return {
        id: userFound.id || label,
        label: userFound.name || label,
        color: c,
        bg: c.startsWith('#') && c.length === 7 ? `${c}22` : 'rgba(59, 130, 246, 0.15)',
        border: c.startsWith('#') && c.length === 7 ? `${c}55` : 'rgba(59, 130, 246, 0.35)'
      };
    }
  }

  // 2. Presets padrão
  const presetFound = PRESET_TAGS.find(p => p.label.toLowerCase() === label.toLowerCase() || p.id === tag?.id || p.id === label);
  if (presetFound) return presetFound;

  // 3. Fallback inteligente
  const customColor = (typeof tag === 'object' && tag?.color) ? tag.color : '#3b82f6';
  return {
    id: label,
    label: label,
    color: customColor,
    bg: customColor.startsWith('#') && customColor.length === 7 ? `${customColor}22` : 'rgba(59, 130, 246, 0.15)',
    border: customColor.startsWith('#') && customColor.length === 7 ? `${customColor}50` : 'rgba(59, 130, 246, 0.35)'
  };
};



const POPULAR_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "😎",
  "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😢", "😭", "😤",
  "😠", "😡", "🤯", "😳", "🥵", "🥶", "😱", "🤗", "🤔", "🤫",
  "😴", "🤐", "🤢", "🤡", "💩", "👻", "💀", "👽", "🤖", "🎃",
  "👍", "👎", "👏", "🙌", "🤝", "🙏", "✌️", "🤞", "🤟", "🤘",
  "👊", "✊", "🤛", "🤜", "💪", "❤️", "🧡", "💛", "💚", "💙",
  "💜", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
  "✨", "⭐", "🌟", "⚡", "🔥", "💥", "🎉", "🎊", "🎯", "🏆",
  "👀", "👁️", "👂", "👃", "🧠", "👋", "✍️", "☕", "🍺", "🍕"
];

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const AI_TONES = [
  { id: 'professional', label: 'Profissional & Polido', desc: 'Claro, cordial e empático (Recomendado)', icon: '✨' },
  { id: 'friendly', label: 'Amigável & Acolhedor', desc: 'Simpático e humanizado', icon: '😊' },
  { id: 'short', label: 'Direto & Curto', desc: 'Objetivo e sem rodeios', icon: '⚡' },
  { id: 'formal', label: 'Formal Executivo', desc: 'Polido para ambientes corporativos', icon: '👔' },
  { id: 'correct_only', label: 'Apenas Corrigir Português', desc: 'Mantém estilo, corrige gramática e pontuação', icon: '✍️' }
];

export default function LiveChatView({ initialChatTarget, onClearInitialChatTarget }) {
  const { user, selectedBotId, setSelectedBotId } = useAuth();
  const [chats, setChats] = useState([]);
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [visibleMessageLimit, setVisibleMessageLimit] = useState(80);

  useEffect(() => {
    setVisibleMessageLimit(80);
  }, [selectedChat?.id]);
  const [filterTab, setFilterTab] = useState(() => (user?.role === 'operator' ? 'mine' : 'all'));
  const [searchQuery, setSearchQuery] = useState('');
  const myAttendingCount = useMemo(() => {
    if (!user?.id) return 0;
    const seen = new Set();
    let count = 0;
    for (const c of chats) {
      if (c.attendantId === user.id && c.status === 'attending') {
        const cleanPhone = (c.contactJid || '').split('@')[0].replace(/\D/g, '');
        const key = cleanPhone.length >= 8 ? `${c.botId || ''}_${cleanPhone.slice(-8)}` : `${c.botId || ''}_${c.contactJid || c.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          count++;
        }
      }
    }
    return count;
  }, [chats, user?.id]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [quickMessages, setQuickMessages] = useState([]);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [quickReplyCategory, setQuickReplyCategory] = useState('Todos');
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState(null);
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [editingContactName, setEditingContactName] = useState('');
  const [savingContactName, setSavingContactName] = useState(false);
  // Presença em tempo real do WhatsApp (Online, Offline, Digitando, Gravando Áudio)
  const [chatPresences, setChatPresences] = useState({});

  const getPresenceForJid = useCallback((jid) => {
    if (!jid) return null;
    const cleanNum = jid.split('@')[0];
    return chatPresences[jid] 
      || chatPresences[`${cleanNum}@s.whatsapp.net`]
      || chatPresences[`${cleanNum}@lid`]
      || chatPresences[cleanNum]
      || null;
  }, [chatPresences]);

  // Novos estados: Citação, Emojis, Reações e Gravação de Áudio
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Modo de Envio (Mensagem WhatsApp vs Nota Interna Privada)
  const [inputMode, setInputMode] = useState('message'); // 'message' ou 'internal_note'

  // Estados para Etiquetas / Tags Coloridas e Nomenclaturas personalizadas do Usuário
  const [userTags, setUserTags] = useState([]);
  const [loadingUserTags, setLoadingUserTags] = useState(false);
  const [showManageTagsModal, setShowManageTagsModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null); // null ou { id, name, color }
  const [savingTag, setSavingTag] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState('all'); // 'all' ou label da tag
  const [showTagManagerPopover, setShowTagManagerPopover] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTagColor, setCustomTagColor] = useState('#3b82f6');
  const [updatingTags, setUpdatingTags] = useState(false);

  // Estados do Resumo Inteligente com IA
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [summarySavingNote, setSummarySavingNote] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // Estados da IA para reescrita inteligente
  const [isRewriting, setIsRewriting] = useState(false);
  const [showAiToneMenu, setShowAiToneMenu] = useState(false);
  const [viewingPdfModal, setViewingPdfModal] = useState(null);
  const [lastOriginalText, setLastOriginalText] = useState(null);
  const [aiToast, setAiToast] = useState(null);
  const [transcribingAudioId, setTranscribingAudioId] = useState(null);

  // Ditado por Voz Nativo do Navegador (Web Speech API - Sem IA / Grátis)
  const [isDictating, setIsDictating] = useState(false);
  const dictationRef = useRef(null);

  // Estados para Figurinhas (Stickers)
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [syncingStickers, setSyncingStickers] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const chatInputRef = useRef(null);

  // Estados da Fila de Espera & Round-Robin
  const [queueStats, setQueueStats] = useState({ waitingCount: 0, avgWaitSeconds: 0, avgWaitFormatted: '0 min' });
  const [loadingQueueStats, setLoadingQueueStats] = useState(false);

  // Estados de Transferência de Atendimento
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [chatToTransfer, setChatToTransfer] = useState(null);
  const [attendantsList, setAttendantsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [transferType, setTransferType] = useState('department'); // 'department' | 'attendant' | 'queue'
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loadingAttendants, setLoadingAttendants] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');
  const [selectedTargetAttendantId, setSelectedTargetAttendantId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [notifyClientWhatsApp, setNotifyClientWhatsApp] = useState(true);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Estados de Agendamento de Mensagens & Lembretes
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [pendingSchedules, setPendingSchedules] = useState([]);
  const [scheduleText, setScheduleText] = useState('');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleCancelIfReply, setScheduleCancelIfReply] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(() => desktopNotifications.isSoundMuted());

  const toggleSoundMuted = () => {
    const next = !isSoundMuted;
    setIsSoundMuted(next);
    desktopNotifications.setSoundMuted(next);
    if (!next) {
      desktopNotifications.playQueueAlert();
    }
    setAiToast({
      type: 'info',
      text: next ? '🔇 Alertas sonoros silenciados' : '🔔 Alertas sonoros ativados!'
    });
    setTimeout(() => setAiToast(null), 2500);
  };

  // Estados e Funções do Catálogo de Produtos no Chat
  const [showProductCatalog, setShowProductCatalog] = useState(false);
  const [chatProducts, setChatProducts] = useState([]);
  const [loadingChatProducts, setLoadingChatProducts] = useState(false);
  const [chatProductSearch, setChatProductSearch] = useState('');
  const [chatProductCategory, setChatProductCategory] = useState('Todas');

  const loadChatProducts = async () => {
    try {
      setLoadingChatProducts(true);
      const res = await api.getProducts({ isActive: true });
      if (res && Array.isArray(res.products)) {
        setChatProducts(res.products);
      }
    } catch (err) {
      console.error('Erro ao carregar produtos no chat:', err);
    } finally {
      setLoadingChatProducts(false);
    }
  };

  const handleSendProductToChat = async (prod, mode = 'send') => {
    if (!selectedChat || !prod) return;

    const priceFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(prod.price) || 0);
    const hasPromo = prod.promotionalPrice !== null && prod.promotionalPrice !== undefined && parseFloat(prod.promotionalPrice) > 0 && parseFloat(prod.promotionalPrice) < parseFloat(prod.price);
    const promoFormatted = hasPromo ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(prod.promotionalPrice)) : null;

    const details = [
      `📦 *${prod.name}*`,
      prod.brand ? `🏢 *Marca:* ${prod.brand}` : null,
      hasPromo 
        ? `🔥 *OFERTA ESPECIAL:* De ~${priceFormatted}~ por *${promoFormatted}*`
        : `💰 *Preço:* ${priceFormatted}`,
      prod.sku ? `📋 *SKU:* ${prod.sku}` : null,
      prod.category ? `🏷️ *Categoria:* ${prod.category}` : null,
      prod.checkoutUrl ? `💳 *Comprar Online:* ${prod.checkoutUrl}` : null,
      prod.description ? `\n${prod.description}` : null
    ].filter(Boolean).join('\n');

    if (mode === 'insert') {
      setInputText(prev => prev ? `${prev}\n\n${details}` : details);
      setShowProductCatalog(false);
      setTimeout(() => chatInputRef.current?.focus(), 50);
      setAiToast({ type: 'success', text: 'Produto inserido no campo de mensagem!' });
      setTimeout(() => setAiToast(null), 2500);
      return;
    }

    // Normaliza todas as fotos cadastradas no produto (até 5 fotos)
    let prodImages = [];
    if (Array.isArray(prod.images)) {
      prodImages = prod.images.filter(Boolean);
    } else if (typeof prod.images === 'string') {
      try {
        const parsed = JSON.parse(prod.images);
        if (Array.isArray(parsed)) prodImages = parsed.filter(Boolean);
      } catch (e) {}
    }
    if (prodImages.length === 0 && prod.imageUrl) {
      prodImages = [prod.imageUrl];
    }

    // Envio direto para o WhatsApp do cliente
    setShowProductCatalog(false);
    setSending(true);

    const quotedId = replyingTo?.id || null;
    const tempId = `local_${Date.now()}`;

    let outgoingMsg = '';
    if (prodImages.length > 1) {
      outgoingMsg = `[AlbumUrls:${prodImages.join(',')}|caption:${encodeURIComponent(details)}]`;
    } else if (prodImages.length === 1) {
      outgoingMsg = `[ImageUrl:${prodImages[0]}|caption:${encodeURIComponent(details)}]`;
    } else {
      outgoingMsg = details;
    }

    const localMsg = {
      id: tempId,
      role: 'attendant',
      content: outgoingMsg,
      timestamp: new Date().toISOString(),
      senderName: user?.name || 'Operador'
    };

    setMessages(prev => [...prev, localMsg]);
    setReplyingTo(null);
    scrollToBottom();

    try {
      const res = await api.sendMessage({
        botId: selectedChat.botId,
        to: selectedChat.contactJid,
        message: outgoingMsg,
        quotedMsgId: quotedId
      });

      if (res?.messageId) {
        setMessages(prev => {
          if (prev.some(m => m.id === res.messageId)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? { ...m, id: res.messageId, content: res.content || m.content } : m);
        });
      }

      setAiToast({ 
        type: 'success', 
        text: prodImages.length > 1 
          ? `Álbum com ${prodImages.length} fotos enviado com sucesso!` 
          : `Produto "${prod.name}" enviado com sucesso!` 
      });
      setTimeout(() => setAiToast(null), 3500);
      loadChats();
    } catch (err) {
      console.error('Erro ao enviar produto:', err);
      alert(`Erro ao enviar produto no chat: ${err.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Estados de Dossiê / Comprovante de Atendimento (PDF)
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierData, setDossierData] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);

  // Estados de Menu Três Pontinhos e Histórico de Atendimentos
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const threeDotsMenuRef = useRef(null);

  // Estados do Menu Unificado de Anexos e Recursos (+)
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef(null);

  useEffect(() => {
    const handleAttachOutsideClick = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleAttachOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleAttachOutsideClick);
    };
  }, [showAttachMenu]);

  const [showAttendanceHistoryModal, setShowAttendanceHistoryModal] = useState(false);
  const [attendanceHistoryList, setAttendanceHistoryList] = useState([]);
  const [loadingAttendanceHistory, setLoadingAttendanceHistory] = useState(false);
  const [expandedAttendanceId, setExpandedAttendanceId] = useState(null);
  const [copiedProt, setCopiedProt] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (threeDotsMenuRef.current && !threeDotsMenuRef.current.contains(e.target)) {
        setShowThreeDotsMenu(false);
      }
    };
    if (showThreeDotsMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showThreeDotsMenu]);

  const handleOpenAttendanceHistory = async (chat = selectedChat) => {
    if (!chat?.botId || !chat?.contactJid) return;
    setShowAttendanceHistoryModal(true);
    setLoadingAttendanceHistory(true);
    try {
      const data = await api.getChatAttendances(chat.botId, chat.contactJid);
      setAttendanceHistoryList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar histórico de atendimentos:', err);
      setAttendanceHistoryList([]);
    } finally {
      setLoadingAttendanceHistory(false);
    }
  };

  const handleCopyProtocol = (prot) => {
    if (!prot) return;
    navigator.clipboard?.writeText(prot);
    setCopiedProt(prot);
    setTimeout(() => setCopiedProt(null), 2000);
  };

  // Estados de Agendamento Rápido no Chat
  const [showQuickAptModal, setShowQuickAptModal] = useState(false);
  const [quickAptData, setQuickAptData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    durationMinutes: 30,
    notes: '',
    sendImmediateConfirmation: true
  });
  const [savingQuickApt, setSavingQuickApt] = useState(false);

  const handleOpenQuickAppointment = () => {
    if (!selectedChat) return;
    setQuickAptData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '14:00',
      durationMinutes: 30,
      notes: '',
      sendImmediateConfirmation: true
    });
    setShowQuickAptModal(true);
  };

  const handleSaveQuickAppointment = (e) => {
    e.preventDefault();
    if (!selectedChat || !quickAptData.title || !quickAptData.date || !quickAptData.time) {
      alert('Preencha o título, data e horário.');
      return;
    }
    try {
      let cleanPhone = (selectedChat.contactJid || '').split('@')[0].replace(/\D/g, '');
      const chatCompanyId = selectedChat.companyId || user?.companyId || 'company_default';
      const newApt = {
        id: `apt-${Date.now()}`,
        companyId: chatCompanyId,
        title: quickAptData.title,
        service: quickAptData.title,
        contactName: selectedChat.contactName || selectedChat.name || 'Cliente',
        contactPhone: cleanPhone,
        attendantName: user?.name || 'Atendente',
        date: quickAptData.date,
        time: quickAptData.time,
        durationMinutes: parseInt(quickAptData.durationMinutes, 10) || 30,
        status: 'pending',
        notes: quickAptData.notes || ''
      };

      try {
        const storageKey = `zeplyn_appointments_empresa_${chatCompanyId}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        localStorage.setItem(storageKey, JSON.stringify([newApt, ...existing]));
      } catch (_) {}

      setShowQuickAptModal(false);
      setAiToast({ title: 'Agendamento Registrado!', text: 'Compromisso marcado e visível na sua Agenda.' });
      setTimeout(() => setAiToast(null), 3500);
    } catch (err) {
      alert('Erro ao salvar agendamento.');
    }
  };

  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadCountWhileScrolled, setUnreadCountWhileScrolled] = useState(0);
  const fileInputRef = useRef(null);
  const stickerInputRef = useRef(null);

  // Estados de Busca Interna na Conversa Ativa
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatCurrentIndex, setInChatCurrentIndex] = useState(0);

  // Estados de Drag & Drop de Arquivos
  const [isDragOverChat, setIsDragOverChat] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const tagFilterScrollRef = useRef(null);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  // Carregar estatísticas da fila de espera (Round-Robin)
  const loadQueueStats = async () => {
    try {
      const stats = await api.getQueueStats(selectedBotId !== 'all' ? selectedBotId : '');
      if (stats) setQueueStats(stats);
    } catch (err) {
      console.error('Erro ao carregar estatísticas da fila:', err);
    }
  };

  // Carregar agendamentos do contato ativo
  const loadPendingSchedules = async () => {
    if (!selectedChat?.botId || !selectedChat?.contactJid) {
      setPendingSchedules([]);
      return;
    }
    try {
      const list = await api.getScheduledMessages(selectedChat.botId, selectedChat.contactJid);
      setPendingSchedules(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    }
  };

  // Abrir Dossiê / Comprovante Oficial do Atendimento
  const handleOpenDossier = async (targetProtocol = null) => {
    if (!selectedChat?.botId || !selectedChat?.contactJid) return;
    setLoadingDossier(true);
    setShowDossierModal(true);
    try {
      const data = await api.getChatDossier(selectedChat.botId, selectedChat.contactJid, targetProtocol);
      setDossierData(data);
    } catch (err) {
      console.error('Erro ao carregar dossiê:', err);
      alert('Não foi possível gerar o comprovante deste atendimento: ' + err.message);
      setShowDossierModal(false);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handlePrintDossier = () => {
    const printContent = document.getElementById('dossier-print-container');
    if (!printContent) return;

    let iframe = document.getElementById('dossier-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'dossier-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Comprovante de Atendimento - ${dossierData?.protocol || 'Dossiê'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              font-size: 13px;
              line-height: 1.5;
              padding: 0;
            }
            .dossier-no-print {
              display: none !important;
            }
            .dossier-box {
              background: #f8fafc !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 8px !important;
              padding: 12px 14px !important;
              color: #0f172a !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .dossier-messages-container {
              max-height: none !important;
              overflow: visible !important;
              height: auto !important;
              display: flex !important;
              flex-direction: column !important;
              gap: 8px !important;
            }
            .dossier-bubble-attendant {
              background: #eff6ff !important;
              border: 1px solid #bfdbfe !important;
              color: #1e3a8a !important;
              border-radius: 8px !important;
              padding: 10px 14px !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .dossier-bubble-client {
              background: #f8fafc !important;
              border: 1px solid #e2e8f0 !important;
              color: #0f172a !important;
              border-radius: 8px !important;
              padding: 10px 14px !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .dossier-text-muted {
              color: #64748b !important;
            }
            .dossier-hash {
              background: #f1f5f9 !important;
              color: #334155 !important;
              font-family: monospace !important;
              padding: 6px 10px !important;
              border-radius: 6px !important;
              border: 1px solid #cbd5e1 !important;
              word-break: break-all !important;
              font-size: 11px !important;
            }
            h2 {
              color: #2563eb !important;
            }
            div {
              color: inherit;
            }
          </style>
        </head>
        <body>
          <div style="background:#ffffff; color:#0f172a; padding:0;">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Erro ao imprimir via iframe:', err);
        window.print();
      }
    }, 300);
  };

  const handleOpenScheduleModal = () => {
    const nextHour = new Date(Date.now() + 60 * 60 * 1000);
    nextHour.setMinutes(0, 0, 0);
    const localIso = new Date(nextHour.getTime() - nextHour.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduleDateTime(localIso);
    setScheduleText(inputText.trim() || '');
    setScheduleCancelIfReply(true);
    setShowScheduleModal(true);
  };

  const handleApplySchedulePresetTime = (preset) => {
    const now = new Date();
    if (preset === '1h') {
      const target = new Date(now.getTime() + 60 * 60 * 1000);
      setScheduleDateTime(new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } else if (preset === 'tomorrow_9') {
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
      setScheduleDateTime(new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } else if (preset === 'tomorrow_14') {
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(14, 0, 0, 0);
      setScheduleDateTime(new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } else if (preset === 'monday_9') {
      const target = new Date(now);
      const day = target.getDay();
      const diff = day === 0 ? 1 : (8 - day);
      target.setDate(target.getDate() + diff);
      target.setHours(9, 0, 0, 0);
      setScheduleDateTime(new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleText.trim() || !scheduleDateTime) {
      alert('Por favor, informe a mensagem e a data/hora para o envio.');
      return;
    }
    try {
      setSavingSchedule(true);
      await api.scheduleMessage({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid,
        userId: user?.id,
        message: scheduleText.trim(),
        scheduledAt: new Date(scheduleDateTime).toISOString(),
        cancelIfCustomerReplies: scheduleCancelIfReply
      });
      setShowScheduleModal(false);
      setInputText('');
      loadPendingSchedules();
      setAiToast({ type: 'success', text: 'Mensagem agendada com sucesso!' });
      setTimeout(() => setAiToast(null), 4000);
    } catch (err) {
      alert(`Erro ao agendar mensagem: ${err.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCancelSchedule = async (id) => {
    if (!window.confirm('Deseja realmente cancelar esta mensagem agendada?')) return;
    try {
      await api.cancelScheduledMessage(id);
      loadPendingSchedules();
      setAiToast({ type: 'success', text: 'Agendamento cancelado.' });
      setTimeout(() => setAiToast(null), 3000);
    } catch (err) {
      alert(`Erro ao cancelar agendamento: ${err.message}`);
    }
  };

  // Carregar lista de chats
  const loadChats = async () => {
    try {
      const data = await api.getChats(selectedBotId !== 'all' ? `botId=${selectedBotId}` : '');
      if (Array.isArray(data)) {
        const seen = new Set();
        const deduplicated = [];
        for (const chat of data) {
          const isOmni = (chat.contactJid || '').endsWith('@instagram') || (chat.contactJid || '').endsWith('@telegram');
          const cleanPhone = (chat.contactJid || '').split('@')[0].replace(/\D/g, '');
          const uniqueKey = isOmni
            ? `${chat.contactJid}`
            : (cleanPhone.length >= 8 ? `${chat.botId || ''}_${cleanPhone.slice(-8)}` : `${chat.botId || ''}_${chat.contactJid || chat.id}`);
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            deduplicated.push(chat);
          }
        }
        setChats(deduplicated);
        chatsRef.current = deduplicated;

        // Atualização dinâmica do contador na aba do navegador
        const waitingCount = deduplicated.filter(c => c.status === 'waiting').length;
        const unreadCount = deduplicated.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        desktopNotifications.updateTitleBadge({ waitingCount, unreadCount });

        return deduplicated;
      }
    } catch (err) {
      console.error('Erro ao carregar chats:', err);
    }
    return [];
  };

  // Transcrever áudio sob demanda via Whisper
  const handleTranscribeAudio = async (messageId, audioUrl) => {
    if (!audioUrl) return;
    try {
      setTranscribingAudioId(messageId || audioUrl);
      const res = await api.transcribeAudio({
        messageId,
        audioUrl,
        botId: selectedChat?.botId,
        contactJid: selectedChat?.contactJid
      });
      if (res?.transcription) {
        setMessages(prev => prev.map(m => {
          if (m.id === messageId || (m.content && m.content.includes(audioUrl))) {
            const current = m.content || '';
            const newContent = current.includes('[AudioUrl:')
              ? current.replace(/\[AudioUrl:[^\]]+\](.*)/, `[AudioUrl:${audioUrl}] ${res.transcription}`)
              : `[AudioUrl:${audioUrl}] ${res.transcription}`;
            return { ...m, content: newContent };
          }
          return m;
        }));
        const toastMsg = res?.isFree
          ? 'Áudio transcrito com sucesso via Groq (Custo R$ 0,00)!'
          : 'Áudio transcrito com sucesso!';
        setAiToast({ type: 'success', text: toastMsg });
        setTimeout(() => setAiToast(null), 3500);
      }
    } catch (err) {
      console.error('Erro ao transcrever áudio:', err);
      alert(`Erro na transcrição: ${err.message}`);
    } finally {
      setTranscribingAudioId(null);
    }
  };

  // Ditado de voz pelo navegador (Web Speech API nativo - Sem IA / Grátis)
  const toggleDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não possui suporte ao reconhecimento de voz nativo. Recomendamos utilizar o Google Chrome ou Microsoft Edge.');
      return;
    }

    if (isDictating) {
      try {
        dictationRef.current?.stop();
      } catch (e) {}
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsDictating(true);
        setAiToast({ type: 'info', text: '🎙️ Ditado ativo: fale no microfone que o navegador digitará seu texto...' });
        setTimeout(() => setAiToast(null), 3000);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(prev => prev ? `${prev} ${transcript.trim()}` : transcript.trim());
        }
      };

      recognition.onerror = (err) => {
        console.warn('Aviso no ditado de voz:', err);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      dictationRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Erro ao iniciar reconhecimento de voz nativo:', err);
      setIsDictating(false);
    }
  };

  // Carregar respostas rápidas
  const loadQuickMessages = async () => {
    try {
      const data = await api.getQuickReplies();
      if (Array.isArray(data)) {
        setQuickMessages(data);
      }
    } catch (err) {
      console.error('Erro ao carregar respostas rápidas:', err);
    }
  };

  // Substitui variáveis dinâmicas ({primeiro_nome}, {saudacao}, etc.)
  const parseQuickReplyVariables = (templateText) => {
    if (!templateText) return '';
    const now = new Date();
    const hour = now.getHours();
    let saudacao = 'Olá';
    if (hour >= 5 && hour < 12) saudacao = 'Bom dia';
    else if (hour >= 12 && hour < 18) saudacao = 'Boa tarde';
    else saudacao = 'Boa noite';

    const fullName = selectedChat?.contactName || selectedChat?.name || (selectedChat?.contactJid ? selectedChat.contactJid.split('@')[0] : 'Cliente');
    const firstName = fullName.split(' ')[0] || 'Cliente';
    const attendantName = user?.name || 'Atendente';
    const companyName = 'Zeplyn';
    const protocol = selectedChat?.protocol || `PROT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const phone = selectedChat?.contactJid ? selectedChat.contactJid.split('@')[0] : '';
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return templateText
      .replace(/{primeiro_nome}/gi, firstName)
      .replace(/{nome}/gi, fullName)
      .replace(/{saudacao}/gi, saudacao)
      .replace(/{atendente}/gi, attendantName)
      .replace(/{protocolo}/gi, protocol)
      .replace(/{empresa}/gi, companyName)
      .replace(/{telefone}/gi, phone)
      .replace(/{data}/gi, dateStr)
      .replace(/{hora}/gi, timeStr);
  };

  // Filtra as respostas rápidas por busca e categoria
  const filteredQuickReplies = quickMessages.filter(qm => {
    if (quickReplyCategory !== 'Todos' && qm.category && qm.category !== quickReplyCategory) {
      return false;
    }
    if (!slashQuery) return true;
    const q = slashQuery.toLowerCase().replace(/^\/+/, '');
    const rawShortcut = (qm.shortcut || '').toLowerCase().replace(/^\/+/, '');
    const rawTitle = (qm.title || '').toLowerCase();
    const rawMessage = (qm.message || qm.content || '').toLowerCase();
    return rawShortcut.includes(q) || rawTitle.includes(q) || rawMessage.includes(q);
  });

  // Aplica o atalho e substitui no campo de texto
  const handleApplyQuickReply = (qm) => {
    const rawContent = qm.message || qm.content || '';
    const parsed = parseQuickReplyVariables(rawContent);

    if (inputText.startsWith('/')) {
      setInputText(parsed);
    } else {
      const lastSlashIndex = inputText.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        const before = inputText.substring(0, lastSlashIndex);
        setInputText(before ? `${before.trim()} ${parsed}` : parsed);
      } else {
        setInputText(parsed);
      }
    }
    setShowQuickDropdown(false);
    setSlashQuery('');
  };

  // Trata digitação e abertura de atalhos por barra (/)
  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    const lastSlashIndex = val.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      const textAfterSlash = val.substring(lastSlashIndex + 1);
      if (!textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
        setSlashQuery(textAfterSlash);
        setSlashSelectedIndex(0);
        setShowQuickDropdown(true);
        return;
      }
    }
    if (showQuickDropdown && !val.includes('/')) {
      setShowQuickDropdown(false);
      setSlashQuery('');
    }
  };

  // Navegação no menu flutuante com setas (↑, ↓), Enter e Esc
  const handleChatInputKeyDown = (e) => {
    if (showQuickDropdown && filteredQuickReplies.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev => (prev + 1) % filteredQuickReplies.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredQuickReplies[slashSelectedIndex] || filteredQuickReplies[0];
        if (selected) {
          handleApplyQuickReply(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowQuickDropdown(false);
        setSlashQuery('');
        return;
      }
    }
  };

  // Formatar número do WhatsApp no padrão brasileiro visual (+55 (DD) 9NNNN-NNNN)
  const formatBrazilianPhone = (jidOrPhone) => {
    if (!jidOrPhone) return '';
    const clean = String(jidOrPhone).split('@')[0].replace(/\D/g, '');
    if (!clean) return jidOrPhone;

    if (clean.startsWith('55') && clean.length >= 12) {
      const ddd = clean.substring(2, 4);
      const rest = clean.substring(4);
      if (rest.length === 9) {
        return `+55 (${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
      } else if (rest.length === 8) {
        return `+55 (${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
      }
      return `+55 (${ddd}) ${rest}`;
    }

    if (clean.length === 11) {
      const ddd = clean.substring(0, 2);
      const rest = clean.substring(2);
      return `+55 (${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
    }

    if (clean.length === 10) {
      const ddd = clean.substring(0, 2);
      const rest = clean.substring(2);
      return `+55 (${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
    }

    return `+${clean}`;
  };

  // Separa e contabiliza todas as mídias da conversa (Áudio, Imagem, Vídeo, Docs, Links, Outros)
  const contactMedia = useMemo(() => {
    const audios = [];
    const images = [];
    const videos = [];
    const docs = [];
    const links = [];
    const others = [];

    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    (messages || []).forEach((m) => {
      const c = m.content || '';
      const time = m.timestamp;
      const isMe = m.role === 'assistant' || m.role === 'attendant';

      // 1. Áudio
      const audioMatch = c.match(/\[AudioUrl:(.*?)\]/);
      if (audioMatch) {
        audios.push({ id: m.id, url: audioMatch[1], timestamp: time, isMe });
      } else if (c.includes('.webm') || c.includes('.ogg') || c.includes('.mp3') || c.includes('ptt_')) {
        const matches = c.match(/(https?:\/\/[^\s]+|\/uploads\/[^\s]+)/i);
        if (matches && (matches[0].endsWith('.webm') || matches[0].endsWith('.ogg') || matches[0].endsWith('.mp3'))) {
          audios.push({ id: m.id, url: matches[0], timestamp: time, isMe });
        }
      }

      // 2. Imagem / Álbum
      const albumMatch = c.match(/\[AlbumUrls:(.*?)\]/);
      if (albumMatch) {
        const urls = albumMatch[1].split('|')[0].split(',').map(u => u.trim()).filter(Boolean);
        urls.forEach((u, i) => images.push({ id: `${m.id}_${i}`, url: u, timestamp: time, isMe }));
      }
      const imgMatch = c.match(/\[ImageUrl:(.*?)\]/);
      if (imgMatch) {
        images.push({ id: m.id, url: imgMatch[1], timestamp: time, isMe });
      } else if (/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(c.trim()) || (/^\/uploads\/.*\.(jpeg|jpg|gif|png|webp)/i.test(c.trim()) && !c.includes('[StickerUrl:'))) {
        images.push({ id: m.id, url: c.trim(), timestamp: time, isMe });
      }

      // 3. Vídeo
      const vidMatch = c.match(/\[VideoUrl:(.*?)\]/);
      if (vidMatch) {
        videos.push({ id: m.id, url: vidMatch[1], timestamp: time, isMe });
      } else if (/\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i.test(c.trim())) {
        videos.push({ id: m.id, url: c.trim(), timestamp: time, isMe });
      }

      // 4. Docs
      const docMatch = c.match(/\[DocumentUrl:(.*?)\|filename:(.*?)\]/);
      if (docMatch) {
        docs.push({ id: m.id, url: docMatch[1], name: docMatch[2], timestamp: time, isMe });
      } else if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip)(\?.*)?$/i.test(c.trim())) {
        docs.push({ id: m.id, url: c.trim(), name: c.split('/').pop(), timestamp: time, isMe });
      }

      // 5. Links
      const detectedLinks = c.match(urlRegex);
      if (detectedLinks) {
        detectedLinks.forEach(link => {
          if (!link.includes('/uploads/') && !/\.(png|jpe?g|gif|webp|mp3|ogg|webm|mp4|pdf)$/i.test(link)) {
            links.push({ id: m.id, url: link, timestamp: time, isMe });
          }
        });
      }

      // 6. Outros (Figurinhas, Contatos, Localizações)
      const stickerMatch = c.match(/\[StickerUrl:(.*?)\]/);
      if (stickerMatch) {
        others.push({ id: m.id, type: 'sticker', url: stickerMatch[1], timestamp: time, isMe });
      } else if (c.includes('[LocationCard:')) {
        const inner = c.replace(/\[LocationCard:(.*?)\]/, '$1');
        const parts = inner.split('|');
        const namePart = parts.find(p => p.startsWith('name='));
        const latPart = parts.find(p => p.startsWith('lat='));
        const lngPart = parts.find(p => p.startsWith('lng='));
        const locName = namePart ? namePart.replace('name=', '') : 'Localização';
        const lat = latPart ? latPart.replace('lat=', '') : '';
        const lng = lngPart ? lngPart.replace('lng=', '') : '';
        others.push({ id: m.id, type: 'location', title: `📍 ${locName || 'Localização'}`, url: `https://www.google.com/maps?q=${lat},${lng}`, timestamp: time, isMe });
      } else if (c.includes('[ContactCard:') || c.includes('BEGIN:VCARD')) {
        const inner = c.includes('[ContactCard:') ? c.replace(/\[ContactCard:(.*?)\]/, '$1') : '';
        const parts = inner.split('|');
        const namePart = parts.find(p => p.startsWith('name='));
        const phonePart = parts.find(p => p.startsWith('phone='));
        const cName = namePart ? namePart.replace('name=', '') : 'Contato';
        const cPhone = phonePart ? phonePart.replace('phone=', '') : '';
        others.push({ id: m.id, type: 'vcard', title: `👤 ${cName}`, phone: cPhone, timestamp: time, isMe });
      }
    });

    return { audios, images, videos, docs, links, others };
  }, [messages]);

  // Editar Nome do Contato Manualmente
  const handleOpenEditContactModal = () => {
    setEditingContactName(selectedChat?.contactName || selectedChat?.name || '');
    setShowEditContactModal(true);
  };

  const handleSaveContactName = async (e) => {
    e?.preventDefault();
    if (!selectedChat?.contactJid || !editingContactName.trim()) return;

    try {
      setSavingContactName(true);
      await api.updateContactName({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid,
        name: editingContactName.trim()
      });

      setSelectedChat(prev => prev ? ({ ...prev, contactName: editingContactName.trim(), name: editingContactName.trim() }) : null);

      setChats(prev => prev.map(c => 
        (c.id === selectedChat.id || c.contactJid === selectedChat.contactJid)
          ? { ...c, contactName: editingContactName.trim(), name: editingContactName.trim() }
          : c
      ));

      setShowEditContactModal(false);
      setAiToast({ type: 'success', text: 'Nome do contato atualizado com sucesso!' });
      setTimeout(() => setAiToast(null), 3000);
    } catch (err) {
      console.error('Erro ao atualizar nome do contato:', err);
      alert(`Erro ao atualizar nome do contato: ${err.message}`);
    } finally {
      setSavingContactName(false);
    }
  };

  // Carregar etiquetas e nomenclaturas personalizadas do usuário logado
  const loadUserTags = async () => {
    try {
      setLoadingUserTags(true);
      const data = await api.getUserTags();
      if (Array.isArray(data)) {
        setUserTags(data);
      }
    } catch (err) {
      console.error('Erro ao carregar etiquetas do usuário:', err);
    } finally {
      setLoadingUserTags(false);
    }
  };

  useEffect(() => {
    loadChats();
    loadQuickMessages();
    loadUserTags();

    const savedFilter = window.sessionStorage.getItem('initial_chat_tag_filter');
    if (savedFilter) {
      setSelectedTagFilter(savedFilter);
      window.sessionStorage.removeItem('initial_chat_tag_filter');
    }

    // Eventos do Socket para atualização em tempo real
    const handleMessageTranscribed = (payload) => {
      if (!payload) return;
      setMessages(prev => prev.map(m => {
        if (m.id === payload.messageId || (payload.audioUrl && m.content && m.content.includes(payload.audioUrl))) {
          return { ...m, content: payload.newContent || `[AudioUrl:${payload.audioUrl}] ${payload.transcription}` };
        }
        return m;
      }));
    };
    const cleanupTranscribed = socketService.on('chat-message-transcribed', handleMessageTranscribed);

    const handleNewIncoming = (payload) => {
      loadChats();

      const isAssistant = payload.role === 'assistant' || payload.role === 'attendant';
      const cleanIncoming = (payload.contactJid || payload.userId || '').replace(/[^0-9]/g, '');
      const cleanCurrent = (selectedChat?.contactJid || '').replace(/[^0-9]/g, '');

      const isInstagramContact = Boolean((payload.contactJid || payload.userId || '').endsWith('@instagram') || selectedChat?.contactJid?.endsWith('@instagram'));

      const isCurrentChat = Boolean(selectedChat && 
        ((!payload.botId || payload.botId === selectedChat.botId || isInstagramContact) &&
        (payload.contactJid === selectedChat.contactJid || 
        payload.userId === selectedChat.contactJid || 
        payload.chatId === selectedChat.id ||
        (cleanIncoming && cleanCurrent && cleanIncoming === cleanCurrent) ||
        (payload.contactId && selectedChat.contactJid?.includes(payload.contactId)))));

      // Alertas sonoros e notificações em tempo real
      if (!isAssistant && (payload.contactJid || payload.userId)) {
        const isFromWaiting = payload.status === 'waiting' || (chatsRef.current && chatsRef.current.some(c => (c.contactJid === payload.contactJid || c.id === payload.chatId) && c.status === 'waiting'));
        if (isFromWaiting) {
          desktopNotifications.playQueueAlert();
        } else {
          desktopNotifications.playMessageChime();
        }

        if (!isCurrentChat || document.hidden) {
          desktopNotifications.notifyNewMessage({
            contactName: payload.contactName || payload.senderName || 'Cliente',
            message: payload.message || payload.content || 'Nova mensagem recebida',
            contactJid: payload.contactJid || payload.userId,
            chatId: payload.chatId
          });
        }
      }

      if (!selectedChat) return;

      if (isCurrentChat) {
        const isAssistant = payload.role === 'assistant' || payload.role === 'attendant';
        const senderName = payload.senderName || (isAssistant ? (user?.name || 'Operador') : (payload.contactName || selectedChat.contactName));
        const newMsg = {
          id: payload.id || `ws_${Date.now()}_${Math.random()}`,
          role: payload.role || (isAssistant ? 'assistant' : (payload.contactJid || payload.userId ? 'user' : 'assistant')),
          content: payload.message || payload.content,
          senderName: senderName,
          timestamp: new Date(payload.timestamp || Date.now()).toISOString()
        };
        setMessages(prev => {
          // 1. Se já existe mensagem com o mesmo id, não duplica MAS atualiza se o conteúdo mudou
          if (newMsg.id && prev.some(m => m.id === newMsg.id)) {
            return prev.map(m => m.id === newMsg.id ? { ...m, ...newMsg, content: newMsg.content || m.content } : m);
          }

          // Função auxiliar para extrair texto limpo sem prefixo de citação para match robusto
          const getBaseText = (txt) => {
            if (!txt || typeof txt !== 'string') return '';
            let s = txt.trim();
            if (s.startsWith('[Em resposta a: "')) {
              const closeIdx = s.indexOf('"] ');
              if (closeIdx !== -1) {
                s = s.substring(closeIdx + 3).trim();
              }
            }
            return s;
          };

          // 2. Se for mensagem enviada (assistant/attendant), substitui mensagem local otimista pendente
          if (isAssistant) {
            const incomingBase = getBaseText(newMsg.content);
            const localIdx = prev.findIndex(m => {
              if (!String(m.id).startsWith('local_') || String(m.id).startsWith('local_note_')) return false;
              if (m.content === newMsg.content) return true;
              const localBase = getBaseText(m.content);
              if (localBase && incomingBase && localBase === incomingBase) return true;
              if (localBase && newMsg.content && newMsg.content.endsWith(localBase)) return true;
              if (incomingBase && m.content && m.content.endsWith(incomingBase)) return true;
              return false;
            });

            if (localIdx !== -1) {
              const updated = [...prev];
              updated[localIdx] = newMsg;
              return updated;
            }
          }

          return [...prev, newMsg];
        });
        if (messagesContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
          const isScrolledUp = (scrollHeight - scrollTop - clientHeight) > 120;
          if (isScrolledUp) {
            setShowScrollBottom(true);
            setUnreadCountWhileScrolled(prev => prev + 1);
          } else {
            scrollToBottom();
          }
        } else {
          scrollToBottom();
        }
      }
    };

    const cleanupReceived = socketService.on('whatsapp-message-received', handleNewIncoming);
    const cleanupSent = socketService.on('whatsapp-message-sent', handleNewIncoming);
    const cleanupGeneric = socketService.on('new_message', handleNewIncoming);
    
    const cleanupReaction = socketService.on('whatsapp-reaction-updated', (data) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reaction: data.reaction } : m));
    });

    const refreshChatList = () => {
      loadChats();
      loadQueueStats();
    };
    const cleanupUpdate = socketService.on('chat-updated', refreshChatList);
    const cleanupCapture = socketService.on('chat-captured', refreshChatList);
    const cleanupRelease = socketService.on('chat-released', refreshChatList);
    const handleChatTransferred = (data) => {
      refreshChatList();
      if (!data) return;

      // Se foi transferido para o atendente logado no momento
      if (data.toAttendantId === user?.id) {
        desktopNotifications.playTransferAlert();
        desktopNotifications.notifyTransfer({
          contactName: data.chat?.contactName,
          contactJid: data.chat?.contactJid,
          fromAttendantName: data.fromAttendantName,
          note: data.note,
          chatId: data.chat?.id
        });

        setAiToast({
          type: 'success',
          text: `🔄 Atendimento de "${data.chat?.contactName || 'Cliente'}" foi transferido para você por ${data.fromAttendantName || 'Colega'}!`
        });
        setTimeout(() => setAiToast(null), 6000);
      }

      // Atualiza selectedChat se for a conversa atualmente aberta na tela
      if (selectedChat && (selectedChat.id === data.chat?.id || selectedChat.contactJid === data.chat?.contactJid)) {
        setSelectedChat(prev => ({
          ...prev,
          status: data.toQueue ? 'waiting' : 'attending',
          attendantId: data.toAttendantId,
          attendantName: data.toAttendantName
        }));
      }
    };

    const cleanupTransfer = socketService.on('chat-transferred', handleChatTransferred);
    const cleanupMerged = socketService.on('chat-merged', refreshChatList);
    const cleanupStatus = socketService.on('chat_status_updated', refreshChatList);
    const handleQueueAlert = (data) => {
      refreshChatList();
      desktopNotifications.playQueueAlert();
      desktopNotifications.notifyQueueAlert({
        contactName: data?.contactName || data?.chat?.contactName,
        contactJid: data?.contactJid || data?.chat?.contactJid,
        sectorName: data?.sectorName,
        chatId: data?.chatId || data?.chat?.id
      });
    };
    const cleanupHumanNeeded = socketService.on('human-intervention-needed', handleQueueAlert);
    const cleanupClientWaiting = socketService.on('client-waiting', handleQueueAlert);

    const cleanupCsatRecorded = socketService.on('csat-recorded', (data) => {
      loadChats();
      if (data?.contactJid && selectedChat && (selectedChat.contactJid === data.contactJid || selectedChat.id === data.chatId)) {
        setSelectedChat(prev => prev ? ({
          ...prev,
          csatRating: data.rating,
          csatComment: data.comment,
          protocol: data.protocol || prev.protocol
        }) : null);
      }
    });

    const cleanupSchedCreated = socketService.on('scheduled-message:created', () => {
      loadPendingSchedules();
    });
    const cleanupSchedSent = socketService.on('scheduled-message:sent', () => {
      loadPendingSchedules();
      loadChats();
    });
    const cleanupSchedCancelled = socketService.on('scheduled-message:cancelled', () => {
      loadPendingSchedules();
    });

    const cleanupStickersUpdated = socketService.on('bot-stickers-updated', (data) => {
      if (data?.botId === selectedChat?.botId && data?.sticker?.url) {
        setStickers(prev => [data.sticker.url, ...prev.filter(s => s !== data.sticker.url)]);
      }
    });

    const cleanupUserStickersUpdated = socketService.on('user-stickers-updated', (data) => {
      if ((!data?.userId || data?.userId === user?.id) && data?.sticker?.url) {
        setStickers(prev => [data.sticker.url, ...prev.filter(s => s !== data.sticker.url)]);
      }
    });

    const cleanupUserStickersDeleted = socketService.on('user-stickers-deleted', (data) => {
      if (!data?.userId || data?.userId === user?.id) {
        setStickers(prev => prev.filter(s => s !== data.stickerId && !s.includes(data.stickerId)));
      }
    });

    const cleanupStickersCleared = socketService.on('bot-stickers-cleared', (data) => {
      if (data?.botId === selectedChat?.botId) {
        setStickers([]);
      }
    });

    const cleanupTagsUpdated = socketService.on('chat:tags-updated', (data) => {
      loadChats();
      if (data?.contactJid && selectedChat && (selectedChat.contactJid === data.contactJid || selectedChat.id === data.chatId)) {
        setSelectedChat(prev => prev ? ({ ...prev, tags: data.tags }) : null);
      }
    });

    const cleanupPresence = socketService.on('whatsapp-presence-updated', (data) => {
      if (!data?.contactJid) return;
      setChatPresences(prev => ({
        ...prev,
        [data.contactJid]: data,
        ...(data.alternateJid ? { [data.alternateJid]: data } : {})
      }));
    });

    return () => {
      desktopNotifications.clearTitleBadge();
      cleanupReceived?.();
      cleanupSent?.();
      cleanupGeneric?.();
      cleanupReaction?.();
      cleanupTranscribed?.();
      cleanupUpdate?.();
      cleanupCapture?.();
      cleanupRelease?.();
      cleanupTransfer?.();
      cleanupMerged?.();
      cleanupStatus?.();
      cleanupHumanNeeded?.();
      cleanupClientWaiting?.();
      cleanupCsatRecorded?.();
      cleanupSchedCreated?.();
      cleanupSchedSent?.();
      cleanupSchedCancelled?.();
      cleanupStickersUpdated?.();
      cleanupUserStickersUpdated?.();
      cleanupUserStickersDeleted?.();
      cleanupStickersCleared?.();
      cleanupTagsUpdated?.();
      cleanupPresence?.();
    };
  }, [selectedBotId, selectedChat?.id, selectedChat?.contactJid]);

  useEffect(() => {
    loadQueueStats();
    const interval = setInterval(loadQueueStats, 15000);
    return () => clearInterval(interval);
  }, [selectedBotId]);

  useEffect(() => {
    loadPendingSchedules();
  }, [selectedChat?.botId, selectedChat?.contactJid]);

  const matchPhone = (phoneA, phoneB) => {
    if (!phoneA || !phoneB) return false;
    const a = String(phoneA).replace(/\D/g, '');
    const b = String(phoneB).replace(/\D/g, '');
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8)) return true;
    return false;
  };

  const findMatchingChat = (chatList, target) => {
    if (!Array.isArray(chatList) || !target) return null;
    const targetChatId = target.id || target.chatId;
    const targetJid = target.contactJid || target.jid;
    const cleanTargetPhone = (targetJid || target.phoneNumber || '').replace(/\D/g, '');

    return chatList.find(c => {
      if (targetChatId && (c.id === targetChatId || c.chatId === targetChatId)) return true;
      if (targetJid && (c.contactJid === targetJid || c.jid === targetJid)) return true;
      if (cleanTargetPhone && matchPhone(c.contactJid, cleanTargetPhone)) return true;
      if (target.phoneNumber && matchPhone(c.contactJid, target.phoneNumber)) return true;
      return false;
    }) || null;
  };

  const openTargetChat = useCallback(async (target) => {
    if (!target) return;

    try {
      const targetChatId = target.id || target.chatId;
      const targetJid = target.contactJid || (target.phoneNumber ? `${String(target.phoneNumber).replace(/\D/g, '')}@s.whatsapp.net` : null) || target.jid;
      const cleanTargetPhone = (targetJid || target.phoneNumber || '').replace(/\D/g, '');
      const targetName = target.contactName || target.name || (cleanTargetPhone ? `Contato ${cleanTargetPhone}` : 'Cliente');
      const targetBotId = target.botId || (selectedBotId !== 'all' ? selectedBotId : null);

      // 1. Tentar encontrar na lista atual de chats em memória
      let match = findMatchingChat(chatsRef.current, target);

      // 2. Se não encontrou na memória, busca chats atualizados da API
      if (!match) {
        try {
          const freshChats = await api.getChats(selectedBotId !== 'all' ? `botId=${selectedBotId}` : '');
          if (Array.isArray(freshChats)) {
            const seen = new Set();
            const deduplicated = [];
            for (const chat of freshChats) {
              const isOmni = (chat.contactJid || '').endsWith('@instagram') || (chat.contactJid || '').endsWith('@telegram');
              const cleanPhone = (chat.contactJid || '').split('@')[0].replace(/\D/g, '');
              const uniqueKey = isOmni ? `${chat.contactJid}` : (cleanPhone.length >= 8 ? `${chat.botId || ''}_${cleanPhone.slice(-8)}` : `${chat.botId || ''}_${chat.contactJid || chat.id}`);
              if (!seen.has(uniqueKey)) {
                seen.add(uniqueKey);
                deduplicated.push(chat);
              }
            }
            setChats(deduplicated);
            chatsRef.current = deduplicated;
            match = findMatchingChat(deduplicated, target);
          }
        } catch (e) {
          console.warn('Aviso ao buscar chats atualizados:', e);
        }
      }

      // 3. Se ainda assim não encontrou (ex: contato recém-criado ou importado no CRM sem histórico de chat prévio),
      // chama api.openChat para garantir e retornar a conversa do banco de dados!
      if (!match && (targetJid || cleanTargetPhone)) {
        try {
          const res = await api.openChat({
            botId: targetBotId,
            contactJid: targetJid || `${cleanTargetPhone}@s.whatsapp.net`,
            contactName: targetName,
            phoneNumber: cleanTargetPhone
          });
          if (res?.success && res.chat) {
            match = res.chat;
            setChats(prev => {
              const cleanMatch = (match.contactJid || '').split('@')[0].replace(/\D/g, '');
              const filtered = prev.filter(c => {
                if (c.id === match.id) return false;
                const cClean = (c.contactJid || '').split('@')[0].replace(/\D/g, '');
                if (c.botId === match.botId && cleanMatch.length >= 8 && cClean.length >= 8 && cleanMatch.slice(-8) === cClean.slice(-8)) {
                  return false;
                }
                return true;
              });
              const updated = [match, ...filtered];
              chatsRef.current = updated;
              return updated;
            });
          }
        } catch (apiErr) {
          console.warn('Aviso ao registrar conversa no banco de dados via API:', apiErr);
        }
      }

      // 4. Fallback de garantia máxima: cria o objeto de conversa localmente para abrir instantaneamente na tela
      if (!match && (targetJid || cleanTargetPhone)) {
        const fallbackJid = targetJid || `${cleanTargetPhone}@s.whatsapp.net`;
        const resolvedBotId = targetBotId || (selectedBotId !== 'all' ? selectedBotId : 'default');
        match = {
          id: targetChatId || `chat_${resolvedBotId}_${cleanTargetPhone}`,
          botId: resolvedBotId,
          contactJid: fallbackJid,
          contactName: targetName,
          status: 'waiting',
          tags: '[]'
        };
        setChats(prev => {
          const cleanFallback = (fallbackJid || '').split('@')[0].replace(/\D/g, '');
          const filtered = prev.filter(c => {
            if (c.id === match.id || c.contactJid === fallbackJid) return false;
            const cClean = (c.contactJid || '').split('@')[0].replace(/\D/g, '');
            if (c.botId === match.botId && cleanFallback.length >= 8 && cClean.length >= 8 && cleanFallback.slice(-8) === cClean.slice(-8)) {
              return false;
            }
            return true;
          });
          const updated = [match, ...filtered];
          chatsRef.current = updated;
          return updated;
        });
      }

      // 5. Seleciona o chat e ajusta filtros da interface para ficar 100% visível
      if (match) {
        setSelectedChat(match);
        setFilterTab('all');
        setSelectedTagFilter('all');
        setSearchQuery('');

        if (match.botId && selectedBotId !== 'all' && selectedBotId !== match.botId && setSelectedBotId) {
          setSelectedBotId('all');
        }
      }
    } catch (err) {
      console.error('Erro ao abrir conversa selecionada:', err);
    } finally {
      try {
        window.sessionStorage.removeItem('initial_chat_target');
      } catch (e) {}
      onClearInitialChatTarget?.();
    }
  }, [selectedBotId, setSelectedBotId, onClearInitialChatTarget]);

  // Listener para inicializar chat via prop initialChatTarget ou sessionStorage
  useEffect(() => {
    let target = initialChatTarget;
    if (!target) {
      try {
        const stored = window.sessionStorage.getItem('initial_chat_target');
        if (stored) target = JSON.parse(stored);
      } catch (e) {}
    }

    if (target) {
      openTargetChat(target);
    }
  }, [initialChatTarget, openTargetChat]);

  // Listener para quando o operador clica na Notificação do Windows
  useEffect(() => {
    const handleOpenChatFromNotification = (e) => {
      if (e.detail) {
        openTargetChat(e.detail);
      }
    };

    window.addEventListener('app:open_chat', handleOpenChatFromNotification);
    return () => window.removeEventListener('app:open_chat', handleOpenChatFromNotification);
  }, [openTargetChat]);

  // Carregar mensagens ao selecionar chat
  useEffect(() => {
    if (!selectedChat) return;

    let isMounted = true;
    setLoadingMessages(true);

    api.getChatMessages(selectedChat.botId, selectedChat.contactJid)
      .then(msgs => {
        if (isMounted) {
          setMessages(Array.isArray(msgs) ? msgs : []);
          setLoadingMessages(false);
          scrollToBottom();
        }
      })
      .catch(err => {
        console.error('Erro ao buscar mensagens do chat:', err);
        if (isMounted) setLoadingMessages(false);
      });

    return () => { isMounted = false; };
  }, [selectedChat?.id, selectedChat?.contactJid]);

  // Assinar presença (Online / Offline / Digitando) no WhatsApp ao abrir chat
  useEffect(() => {
    if (!selectedChat?.contactJid) return;
    const requestPresence = () => {
      socketService.emit('subscribe-presence', {
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid
      });
      api.subscribePresence?.({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid
      }).catch(() => {});
    };

    requestPresence();
    const subInterval = setInterval(requestPresence, 20000);
    return () => clearInterval(subInterval);
  }, [selectedChat?.botId, selectedChat?.contactJid]);

  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const handleScrollToBottomClick = () => {
    scrollToBottom(true);
    setShowScrollBottom(false);
    setUnreadCountWhileScrolled(0);
  };

  const handleTimelineScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Se estiver a mais de 120px do fundo (saiu das conversas recentes de hoje)
    const isScrolledUp = distanceFromBottom > 120;
    setShowScrollBottom(isScrolledUp);
    if (!isScrolledUp) {
      setUnreadCountWhileScrolled(0);
    }
  };

  const scrollToTop = () => {
    messagesTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Identifica informações detalhadas de mídia para citações e respostas (Foto, Figurinha, Vídeo, Áudio, Documento)
  const getMessageMediaInfo = (msgOrContent) => {
    if (!msgOrContent) return null;
    const content = typeof msgOrContent === 'string' ? msgOrContent : (msgOrContent.content || '');
    const type = typeof msgOrContent === 'object' ? (msgOrContent.type || msgOrContent.mediaType) : null;
    let clean = content.replace(/\[Em resposta a: ".*?"\]\s*/g, '').trim();

    // Se estiver no formato Etiqueta|URL (usado nas citações)
    if (clean.includes('|')) {
      const parts = clean.split('|');
      const label = parts[0].trim();
      const possibleUrl = parts[1]?.trim();
      if (possibleUrl && (possibleUrl.startsWith('/uploads/') || possibleUrl.startsWith('http'))) {
        if (possibleUrl.toLowerCase().includes('.webp') || label.toLowerCase().includes('figurinha')) {
          return { type: 'sticker', label: 'Figurinha', url: possibleUrl };
        }
        if (/\.(jpeg|jpg|png|gif)(\?.*)?$/i.test(possibleUrl) || label.toLowerCase().includes('foto')) {
          return { type: 'image', label: label || 'Foto', url: possibleUrl };
        }
        if (/\.(mp4|webm|mov)(\?.*)?$/i.test(possibleUrl) || label.toLowerCase().includes('vídeo') || label.toLowerCase().includes('video')) {
          return { type: 'video', label: label || 'Vídeo', url: possibleUrl };
        }
      }
    }

    // 1. Figurinha (Sticker)
    if (type === 'sticker' || clean.includes('[StickerUrl:')) {
      const match = clean.match(/\[StickerUrl:(.*?)\]/);
      const url = match ? match[1] : (typeof msgOrContent === 'object' ? (msgOrContent.url || msgOrContent.mediaUrl || clean) : clean);
      return { type: 'sticker', label: 'Figurinha', url };
    }
    if ((clean.startsWith('/uploads/') || clean.startsWith('http')) && clean.toLowerCase().includes('.webp') && !clean.includes('[ImageUrl:') && !clean.includes('[VideoUrl:') && !clean.includes('[AudioUrl:')) {
      return { type: 'sticker', label: 'Figurinha', url: clean };
    }

    // 2. Álbum / Imagem / Foto
    if (clean.includes('[AlbumUrls:')) {
      const match = clean.match(/\[AlbumUrls:(.*?)\]/);
      let rawUrls = [];
      if (match) {
        rawUrls = match[1].split('|')[0].split(',').map(u => u.trim()).filter(Boolean);
      }
      const caption = clean.replace(/\[AlbumUrls:.*?\]/g, '').trim();
      const label = caption || `Álbum (${rawUrls.length} fotos)`;
      return { type: 'image', label, url: rawUrls[0] || '', caption, urls: rawUrls };
    }
    if (type === 'image' || clean.includes('[ImageUrl:')) {
      const match = clean.match(/\[ImageUrl:(.*?)\]/);
      let rawUrl = match ? match[1] : (typeof msgOrContent === 'object' ? (msgOrContent.url || clean) : clean);
      let url = rawUrl;
      if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes('|')) {
        url = rawUrl.split('|')[0];
      }
      const caption = clean.replace(/\[ImageUrl:.*?\]/g, '').trim();
      const label = caption || 'Foto';
      return { type: 'image', label, url, caption };
    }
    if ((clean.startsWith('/uploads/') || clean.startsWith('http')) && /\.(jpeg|jpg|png|gif)(\?.*)?$/i.test(clean)) {
      return { type: 'image', label: 'Foto', url: clean };
    }

    // 3. Vídeo
    if (type === 'video' || clean.includes('[VideoUrl:')) {
      const match = clean.match(/\[VideoUrl:(.*?)\]/);
      let rawUrl = match ? match[1] : null;
      let url = rawUrl;
      if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes('|')) {
        url = rawUrl.split('|')[0];
      }
      const caption = clean.replace(/\[VideoUrl:.*?\]/g, '').trim();
      const label = caption || 'Vídeo';
      return { type: 'video', label, url, caption };
    }
    if ((clean.startsWith('/uploads/') || clean.startsWith('http')) && /\.(mp4|webm|mov)(\?.*)?$/i.test(clean)) {
      return { type: 'video', label: 'Vídeo', url: clean };
    }

    // 4. Áudio / Mensagem de Voz
    if (type === 'audio' || clean.includes('[AudioUrl:')) {
      const match = clean.match(/\[AudioUrl:(.*?)\]/);
      let rawUrl = match ? match[1] : null;
      let url = rawUrl;
      if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes('|')) {
        url = rawUrl.split('|')[0];
      }
      return { type: 'audio', label: 'Áudio', url };
    }
    if ((clean.startsWith('/uploads/') || clean.startsWith('http')) && /\.(ogg|mp3|wav|m4a|aac|opus)(\?.*)?$/i.test(clean)) {
      return { type: 'audio', label: 'Áudio', url: clean };
    }

    // 5. Documento
    if (type === 'document' || clean.includes('[DocumentUrl:')) {
      const fnMatch = clean.match(/filename:(.*?)(?:\]|$)/);
      const filename = fnMatch ? fnMatch[1].trim() : 'Documento';
      const urlMatch = clean.match(/\[DocumentUrl:(.*?)(?:\||\])/);
      return { type: 'document', label: `Documento: ${filename}`, filename, url: urlMatch ? urlMatch[1] : null };
    }

    // 6. Localização
    if (clean.includes('[LocationCard:')) {
      const inner = clean.replace(/\[LocationCard:(.*?)\]/, '$1');
      const parts = inner.split('|');
      const namePart = parts.find(p => p.startsWith('name='));
      const locName = namePart ? namePart.replace('name=', '') : '';
      return { type: 'location', label: `📍 ${locName || 'Localização'}` };
    }

    // 7. Contato
    if (clean.includes('[ContactCard:')) {
      const inner = clean.replace(/\[ContactCard:(.*?)\]/, '$1');
      const parts = inner.split('|');
      const namePart = parts.find(p => p.startsWith('name='));
      const cName = namePart ? namePart.replace('name=', '') : 'Contato';
      return { type: 'contact', label: `👤 Contato: ${cName}` };
    }

    return null;
  };

  const formatQuotedSnippet = (content) => {
    if (!content) return '';
    const raw = typeof content === 'string' ? content : (content.content || '');
    let origText = raw;
    if (origText.startsWith('[Em resposta a: "')) {
      const closeIdx = origText.indexOf('"] ');
      if (closeIdx !== -1) {
        origText = origText.substring(closeIdx + 3);
      }
    }
    const media = getMessageMediaInfo(content);
    if (media) {
      if (media.type === 'sticker') return media.url ? `Figurinha|${media.url}` : 'Figurinha';
      if (media.type === 'image') return media.url ? `${media.caption || 'Foto'}|${media.url}` : (media.caption || 'Foto');
      if (media.type === 'video') return media.url ? `${media.caption || 'Vídeo'}|${media.url}` : (media.caption || 'Vídeo');
      if (media.type === 'audio') return 'Áudio';
      if (media.type === 'document') return media.filename ? `Documento: ${media.filename}` : 'Documento';
      if (media.type === 'location') return media.label;
      if (media.type === 'contact') return media.label;
    }
    return origText.length > 50 ? origText.substring(0, 50) + '...' : origText;
  };

  // Divisor de Dias estilo WhatsApp (Hoje, Ontem, Anteontem, 24/09/2026)
  const getDayDividerLabel = (timestamp) => {
    if (!timestamp) return null;
    const msgDate = new Date(timestamp);
    if (isNaN(msgDate.getTime())) return null;

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const msgZero = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate()).getTime();

    const diffDays = Math.round((todayZero - msgZero) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays === 2) return 'Anteontem';

    const dd = String(msgDate.getDate()).padStart(2, '0');
    const mm = String(msgDate.getMonth() + 1).padStart(2, '0');
    const yyyy = msgDate.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedChat || sending) return;

    if (inputMode === 'internal_note') {
      return handleSaveInternalNote();
    }

    const text = inputText.trim();
    const quotedId = replyingTo?.id || null;
    const quotedSnippet = replyingTo ? formatQuotedSnippet(replyingTo.content) : null;

    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowStickerPicker(false);
    setShowQuickDropdown(false);
    setSending(true);

    // Adicionar mensagem localmente de forma otimista ANTES do envio
    const tempId = `local_${Date.now()}`;
    const localContent = quotedSnippet ? `[Em resposta a: "${quotedSnippet}"] ${text}` : text;
    const localMsg = {
      id: tempId,
      role: 'attendant',
      content: localContent,
      timestamp: new Date().toISOString(),
      senderName: user?.name || 'Operador'
    };
    setMessages(prev => [...prev, localMsg]);
    scrollToBottom();

    try {
      const res = await api.sendMessage({
        botId: selectedChat.botId,
        to: selectedChat.contactJid,
        message: text,
        quotedMsgId: quotedId
      });
      if (res?.botId && res.botId !== selectedChat.botId) {
        setSelectedChat(prev => ({ ...prev, botId: res.botId }));
      }
      if (res?.messageId) {
        setMessages(prev => {
          if (prev.some(m => m.id === res.messageId)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? { ...m, id: res.messageId, content: res.content || m.content } : m);
        });
      }
      loadChats();
    } catch (err) {
      alert(`Erro ao enviar mensagem: ${err.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleSaveInternalNote = async (customText = null) => {
    const textToSave = (customText !== null ? customText : inputText).trim();
    if (!textToSave || !selectedChat || sending) return;

    if (customText === null) {
      setInputText('');
    }
    setSending(true);

    const tempId = `local_note_${Date.now()}`;
    const localMsg = {
      id: tempId,
      role: 'internal_note',
      content: textToSave,
      senderName: user?.name || 'Operador',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, localMsg]);
    scrollToBottom();

    try {
      await api.saveInternalNote({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid,
        chatId: selectedChat.id,
        note: textToSave
      });
      loadChats();
      setAiToast({ type: 'success', text: 'Nota interna privada salva com sucesso!' });
      setTimeout(() => setAiToast(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar nota interna:', err);
      alert(`Erro ao salvar nota interna: ${err.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleToggleTag = async (tagItem) => {
    if (!selectedChat || updatingTags) return;
    const tagLabel = typeof tagItem === 'string' ? tagItem : (tagItem.name || tagItem.label || '');
    if (!tagLabel) return;

    const currentTags = parseTags(selectedChat.tags);
    const exists = currentTags.some(t => (typeof t === 'string' ? t : (t.name || t.label)) === tagLabel);

    let nextTags;
    if (exists) {
      nextTags = currentTags.filter(t => (typeof t === 'string' ? t : (t.name || t.label)) !== tagLabel);
    } else {
      nextTags = [...currentTags, tagLabel];
    }

    try {
      setUpdatingTags(true);
      setSelectedChat(prev => prev ? ({ ...prev, tags: nextTags }) : null);
      setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, tags: nextTags } : c));

      await api.updateChatTags({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid,
        chatId: selectedChat.id,
        tags: nextTags
      });
    } catch (err) {
      console.error('Erro ao atualizar tags:', err);
      alert('Erro ao atualizar etiquetas: ' + err.message);
      loadChats();
    } finally {
      setUpdatingTags(false);
    }
  };

  const handleSaveUserTag = async () => {
    if (!customTagInput.trim() || savingTag) return;
    setSavingTag(true);
    try {
      if (editingTag) {
        // Atualizando nomenclatura existente
        const res = await api.updateUserTag(editingTag.id, {
          name: customTagInput.trim(),
          color: customTagColor
        });
        if (res?.tag) {
          setUserTags(prev => prev.map(t => t.id === editingTag.id ? res.tag : t));
          if (selectedChat) {
            const currentTags = parseTags(selectedChat.tags);
            if (currentTags.includes(editingTag.name)) {
              const updatedTags = currentTags.map(t => t === editingTag.name ? res.tag.name : t);
              setSelectedChat(prev => ({ ...prev, tags: updatedTags }));
            }
          }
          loadChats();
          setAiToast({ type: 'success', text: `Etiqueta "${res.tag.name}" atualizada!` });
          setTimeout(() => setAiToast(null), 3000);
        }
        setEditingTag(null);
      } else {
        // Criando nova etiqueta para este usuário
        const res = await api.createUserTag({
          name: customTagInput.trim(),
          color: customTagColor
        });
        if (res?.tag) {
          setUserTags(prev => [...prev, res.tag]);
          if (selectedChat && showTagManagerPopover) {
            await handleToggleTag(res.tag.name);
          }
          setAiToast({ type: 'success', text: `Nomenclatura "${res.tag.name}" salva para a empresa!` });
          setTimeout(() => setAiToast(null), 3000);
        }
      }
      setCustomTagInput('');
      setCustomTagColor('#3b82f6');
    } catch (err) {
      alert(err.message || 'Erro ao salvar etiqueta');
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteUserTag = async (tagId, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Deseja realmente remover esta nomenclatura de etiqueta da empresa?')) return;
    try {
      await api.deleteUserTag(tagId);
      setUserTags(prev => prev.filter(t => t.id !== tagId));
      setAiToast({ type: 'info', text: 'Etiqueta removida da empresa.' });
      setTimeout(() => setAiToast(null), 2500);
    } catch (err) {
      alert(err.message || 'Erro ao excluir etiqueta');
    }
  };

  const handleStartEditTag = (tag, e) => {
    if (e) e.stopPropagation();
    setEditingTag(tag);
    setCustomTagInput(tag.name);
    setCustomTagColor(tag.color || '#3b82f6');
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setCustomTagInput('');
    setCustomTagColor('#3b82f6');
  };

  const handleOpenSummary = async () => {
    if (!selectedChat) return;
    setShowSummaryModal(true);
    setSummaryData(null);
    setSummaryError(null);
    setSummaryLoading(true);

    try {
      const res = await api.summarizeChat({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid,
        chatId: selectedChat.id
      });
      if (res?.summary) {
        setSummaryData(res.summary);
      } else {
        throw new Error('Nenhum resumo retornado pela IA.');
      }
    } catch (err) {
      console.error('Erro ao resumir conversa:', err);
      setSummaryError(err.message || 'Falha ao gerar resumo com IA. Verifique as configurações de API da OpenAI.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (!summaryData) return;
    navigator.clipboard.writeText(summaryData);
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2500);
  };

  const handleSaveSummaryAsNote = async () => {
    if (!summaryData || !selectedChat) return;
    setSummarySavingNote(true);
    try {
      await handleSaveInternalNote(`📋 Resumo da Conversa (Gerado por IA):\n\n${summaryData}`);
      setShowSummaryModal(false);
      setAiToast({ type: 'success', text: 'Resumo salvo como Nota Interna na conversa!' });
      setTimeout(() => setAiToast(null), 3500);
    } catch (err) {
      alert('Erro ao salvar resumo como nota interna: ' + err.message);
    } finally {
      setSummarySavingNote(false);
    }
  };

  const handleTakeOver = async () => {
    if (!selectedChat) return;
    try {
      const isNew = selectedChat.status === 'finished';
      const res = await api.takeOverChat(selectedChat.id);
      setSelectedChat(prev => ({ 
        ...prev, 
        status: 'attending', 
        attendantId: user?.id,
        attendantName: user?.name || 'Atendente',
        csatRating: isNew ? null : prev.csatRating,
        csatComment: isNew ? null : prev.csatComment,
        protocol: res?.chat?.protocol || prev.protocol
      }));
      loadChats();
      if (selectedChat?.botId && selectedChat?.contactJid) {
        api.getChatMessages(selectedChat.botId, selectedChat.contactJid)
          .then(msgs => {
            setMessages(Array.isArray(msgs) ? msgs : []);
            scrollToBottom();
          })
          .catch(() => {});
      }
      setAiToast({ 
        type: 'success', 
        text: isNew ? '🚀 Novo atendimento iniciado com sucesso!' : 'Atendimento assumido!' 
      });
      setTimeout(() => setAiToast(null), 3500);
    } catch (err) {
      alert(`Erro ao assumir atendimento: ${err.message}`);
    }
  };

  const handleFinishChat = async () => {
    if (!selectedChat) return;
    const finishedChatId = selectedChat.id;
    const finishedContactJid = selectedChat.contactJid;
    const finishedContactName = selectedChat.contactName || (finishedContactJid ? finishedContactJid.split('@')[0] : 'Cliente');

    try {
      await api.finishChat(finishedChatId);

      // 1. Fecha a tela da conversa atual que acabou de ser finalizada
      setSelectedChat(null);
      setMessages([]);

      // 2. Atualiza a lista completa de atendimentos
      const freshChats = await loadChats();
      const chatPool = Array.isArray(freshChats) && freshChats.length > 0 ? freshChats : (chatsRef.current || []);

      // 3. Filtra conversas ativas (não finalizadas e diferentes da recém-encerrada)
      const otherActiveChats = chatPool.filter(c => 
        c.id !== finishedChatId && 
        c.contactJid !== finishedContactJid && 
        c.status !== 'finished'
      );

      // Prioridade 1: Próximo atendimento que já está sendo atendido por este mesmo operador
      let nextChat = otherActiveChats.find(c => c.attendantId === user?.id && c.status === 'attending');

      // Prioridade 2: Próximo cliente aguardando na fila de espera
      if (!nextChat) {
        nextChat = otherActiveChats.find(c => c.status === 'waiting');
      }

      // Prioridade 3: Qualquer outro atendimento aberto na lista
      if (!nextChat) {
        nextChat = otherActiveChats.find(c => c.status === 'attending');
      }

      if (nextChat) {
        // Se houver próximo cliente, ajusta a aba para a conversa ficar visível e abre imediatamente
        if (nextChat.status === 'waiting' && filterTab === 'mine') {
          setFilterTab('waiting');
        } else if (nextChat.attendantId !== user?.id && filterTab === 'mine') {
          setFilterTab('all');
        }

        setSelectedChat(nextChat);
        setAiToast({ 
          type: 'success', 
          text: `Atendimento com ${finishedContactName} finalizado! Aberto próximo cliente: ${nextChat.contactName || nextChat.contactJid.split('@')[0]}` 
        });
        setTimeout(() => setAiToast(null), 4000);
      } else {
        // Se não houver mais nenhum cliente pendente, a tela do atendimento permanece fechada
        setAiToast({ 
          type: 'success', 
          text: `Atendimento com ${finishedContactName} finalizado com sucesso! Fila livre.` 
        });
        setTimeout(() => setAiToast(null), 3500);
      }
    } catch (err) {
      alert(`Erro ao finalizar atendimento: ${err.message}`);
    }
  };

  const handleOpenTransferModal = async (chat = null) => {
    const targetChat = chat || selectedChat;
    if (!targetChat) return;
    setChatToTransfer(targetChat);
    setTransferType('department');
    setSelectedDepartment('');
    setSelectedTargetAttendantId('');
    setTransferNote('');
    setTransferSearch('');
    setNotifyClientWhatsApp(true);
    setShowTransferModal(true);
    setLoadingAttendants(true);
    try {
      const [attData, deptsData] = await Promise.allSettled([
        api.getAttendants(),
        api.getCompanyDepartments ? api.getCompanyDepartments() : []
      ]);
      if (attData.status === 'fulfilled' && Array.isArray(attData.value)) {
        setAttendantsList(attData.value);
      }
      if (deptsData.status === 'fulfilled' && Array.isArray(deptsData.value)) {
        setDepartmentsList(deptsData.value);
        if (deptsData.value.length > 0) {
          const firstDept = deptsData.value[0]?.name || deptsData.value[0];
          setSelectedDepartment(firstDept || '');
        }
      }
    } catch (err) {
      console.error('Erro ao carregar atendentes e setores:', err);
    } finally {
      setLoadingAttendants(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!chatToTransfer) return;

    if (transferType === 'department') {
      if (!selectedDepartment) {
        alert('Por favor, selecione um departamento / setor da empresa.');
        return;
      }
    } else if (transferType === 'attendant') {
      if (!selectedTargetAttendantId) {
        alert('Por favor, selecione um atendente de destino.');
        return;
      }
    }

    setSubmittingTransfer(true);
    try {
      await api.transferChat({
        botId: chatToTransfer.botId,
        contactJid: chatToTransfer.contactJid,
        chatId: chatToTransfer.id,
        targetDepartment: transferType === 'department' ? selectedDepartment : null,
        targetAttendantId: transferType === 'attendant' ? selectedTargetAttendantId : (transferType === 'queue' ? 'queue' : null),
        transferNote: transferNote.trim() || null,
        notifyClient: notifyClientWhatsApp
      });

      setShowTransferModal(false);
      loadChats();

      let targetName = 'Fila Geral de Espera';
      if (transferType === 'department') {
        targetName = `Setor ${selectedDepartment}`;
      } else if (transferType === 'attendant') {
        targetName = attendantsList.find(a => a.id === selectedTargetAttendantId)?.name || 'novo atendente';
      }

      setAiToast({ 
        type: 'success', 
        text: `Atendimento transferido para ${targetName} com sucesso!` 
      });
      setTimeout(() => setAiToast(null), 4000);

      if (selectedChat && selectedChat.id === chatToTransfer.id) {
        setSelectedChat(prev => ({
          ...prev,
          status: transferType === 'attendant' ? 'attending' : 'waiting',
          attendantId: transferType === 'attendant' ? selectedTargetAttendantId : null,
          attendantName: transferType === 'attendant' ? targetName : null
        }));
      }
    } catch (err) {
      alert(`Erro ao transferir atendimento: ${err.message}`);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Lógica de busca de mensagens dentro da conversa ativa
  const matchedMessageIds = useMemo(() => {
    if (!inChatSearchQuery.trim()) return [];
    const q = inChatSearchQuery.toLowerCase();
    const ids = [];
    messages.forEach(m => {
      const text = typeof m.content === 'string' ? m.content.toLowerCase() : '';
      if (text.includes(q)) ids.push(m.id || m.timestamp);
    });
    return ids;
  }, [messages, inChatSearchQuery]);

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.3s ease';
      el.style.boxShadow = '0 0 0 3px #3b82f6';
      setTimeout(() => {
        el.style.boxShadow = 'none';
      }, 2000);
    }
  };

  const handleNextMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (inChatCurrentIndex + 1) % matchedMessageIds.length;
    setInChatCurrentIndex(nextIdx);
    scrollToMessage(matchedMessageIds[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const prevIdx = (inChatCurrentIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
    setInChatCurrentIndex(prevIdx);
    scrollToMessage(matchedMessageIds[prevIdx]);
  };

  const uploadChatFile = async (file) => {
    if (!file || !selectedChat) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('botId', selectedChat.botId);
    formData.append('to', selectedChat.contactJid);
    if (replyingTo?.id) {
      formData.append('quotedMsgId', replyingTo.id);
    }

    try {
      await api.uploadFile(formData);
      scrollToBottom();
      setAiToast({ type: 'success', text: `Arquivo "${file.name}" enviado com sucesso!` });
      setTimeout(() => setAiToast(null), 3000);
    } catch (err) {
      alert(`Erro ao enviar arquivo: ${err.message}`);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadChatFile(file);
      e.target.value = '';
    }
  };

  const handleChatDragOver = (e) => {
    e.preventDefault();
    if (!isDragOverChat) setIsDragOverChat(true);
  };

  const handleChatDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOverChat(false);
    }
  };

  const handleChatDrop = async (e) => {
    e.preventDefault();
    setIsDragOverChat(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadChatFile(file);
    }
  };

  // Reagir com emoji a uma mensagem
  const handleReact = async (messageId, emoji) => {
    if (!selectedChat) return;
    try {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction: emoji === m.reaction ? '' : emoji } : m));
      await api.reactToMessage({
        botId: selectedChat.botId,
        contactJid: selectedChat.contactJid,
        messageId: messageId,
        reaction: emoji
      });
    } catch (err) {
      console.error('Erro ao reagir à mensagem:', err);
    }
  };

  // Reescrever texto ou gerar resposta com IA
  const handleAiRewrite = async (tone = 'professional', customSourceText = null) => {
    try {
      setShowAiToneMenu(false);
      setShowEmojiPicker(false);
      setShowQuickDropdown(false);

      const targetText = customSourceText !== null ? customSourceText : inputText;
      const lastCustMsg = [...messages].reverse().find(m => m.role === 'user')?.content || null;

      if (!targetText?.trim() && !lastCustMsg) {
        setAiToast({ type: 'warning', text: 'Digite uma mensagem ou selecione um recado para a IA reescrever.' });
        setTimeout(() => setAiToast(null), 4000);
        return;
      }

      setIsRewriting(true);
      const res = await api.aiRewrite({
        text: targetText?.trim() || '',
        tone,
        botId: selectedChat?.botId || (selectedBotId !== 'all' ? selectedBotId : null),
        lastCustomerMessage: lastCustMsg
      });

      if (res?.rewritten) {
        if (inputText.trim()) {
          setLastOriginalText(inputText);
        }
        setInputText(res.rewritten);
        setAiToast({ type: 'success', text: 'Mensagem aprimorada com sucesso pela IA!' });
        setTimeout(() => setAiToast(null), 4000);
      } else {
        throw new Error('Nenhuma resposta retornada pela IA.');
      }
    } catch (err) {
      console.error('Erro ao reescrever texto com IA:', err);
      setAiToast({ 
        type: 'error', 
        text: err.message || 'Erro ao comunicar com a IA. Verifique sua chave da OpenAI nas configurações.' 
      });
      setTimeout(() => setAiToast(null), 6000);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleUndoAiRewrite = () => {
    if (lastOriginalText !== null) {
      setInputText(lastOriginalText);
      setLastOriginalText(null);
      setAiToast({ type: 'info', text: 'Texto original restaurado.' });
      setTimeout(() => setAiToast(null), 3000);
    }
  };

  // Carregar figurinhas vinculadas ao usuário
  const loadStickers = async (targetBotId = null) => {
    const currentBotId = targetBotId || selectedChat?.botId || (selectedBotId !== 'all' ? selectedBotId : '');
    try {
      setLoadingStickers(true);
      const data = await api.getStickers(currentBotId);
      if (Array.isArray(data)) {
        const seen = new Set();
        const unique = [];
        for (const s of data) {
          const url = typeof s === 'string' ? s : s?.url;
          const key = (typeof s === 'object' && s?.fileHash) ? s.fileHash : url;
          if (url && !seen.has(key)) {
            seen.add(key);
            unique.push(url);
          }
        }
        setStickers(unique);
      }
    } catch (err) {
      console.error('Erro ao carregar figurinhas vinculadas:', err);
    } finally {
      setLoadingStickers(false);
    }
  };

  // Sincronizar figurinhas da conexão ativa
  const handleSyncStickers = async () => {
    if (!selectedChat?.botId) return;
    try {
      setSyncingStickers(true);
      await api.syncStickers(selectedChat.botId);
      await loadStickers(selectedChat.botId);
    } catch (err) {
      console.error('Erro ao sincronizar figurinhas da conexão:', err);
    } finally {
      setSyncingStickers(false);
    }
  };

  // Enviar figurinha para o WhatsApp do cliente
  const handleSendSticker = async (stickerUrl) => {
    if (!selectedChat || sending) return;

    setShowStickerPicker(false);
    setSending(true);

    const tempId = `local_${Date.now()}`;
    const quotedId = replyingTo?.id || null;
    const quotedSnippet = replyingTo ? formatQuotedSnippet(replyingTo.content) : null;
    const localContent = quotedSnippet ? `[Em resposta a: "${quotedSnippet}"] ${stickerUrl}` : stickerUrl;

    const localMsg = {
      id: tempId,
      role: 'attendant',
      content: localContent,
      timestamp: new Date().toISOString(),
      senderName: user?.name || 'Operador'
    };

    setMessages(prev => [...prev, localMsg]);
    setReplyingTo(null);
    scrollToBottom();

    try {
      const res = await api.sendMessage({
        botId: selectedChat.botId,
        to: selectedChat.contactJid,
        message: stickerUrl,
        quotedMsgId: quotedId
      });
      if (res?.botId && res.botId !== selectedChat.botId) {
        setSelectedChat(prev => ({ ...prev, botId: res.botId }));
      }
      if (res?.messageId) {
        setMessages(prev => {
          if (prev.some(m => m.id === res.messageId)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? { ...m, id: res.messageId, content: res.content || m.content } : m);
        });
      }
      loadChats();
    } catch (err) {
      alert(`Erro ao enviar figurinha: ${err.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Upload de nova figurinha vinculada ao usuário
  const handleUploadSticker = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSticker(true);
      const formData = new FormData();
      formData.append('file', file);
      if (selectedChat?.botId) {
        formData.append('botId', selectedChat.botId);
      }

      const res = await api.uploadSticker(formData);
      if (res?.sticker) {
        setStickers(prev => [res.sticker, ...prev.filter(s => s !== res.sticker)]);
        if (selectedChat) {
          await handleSendSticker(res.sticker);
        }
      }
    } catch (err) {
      alert(`Erro ao adicionar figurinha: ${err.message}`);
    } finally {
      setUploadingSticker(false);
      if (stickerInputRef.current) stickerInputRef.current.value = '';
    }
  };

  // Helper: Detecta se a mensagem é uma figurinha
  const isStickerMsg = (msg) => {
    if (!msg) return false;
    if (msg.type === 'sticker' || msg.mediaType === 'sticker') return true;
    const content = (msg.content || '').trim();
    if (content.includes('[StickerUrl:')) return true;
    const clean = content.replace(/\[Em resposta a: ".*?"\]\s*/g, '').trim();
    if (clean.includes('[StickerUrl:')) return true;
    if ((clean.startsWith('/uploads/') || clean.startsWith('http://') || clean.startsWith('https://')) &&
        clean.toLowerCase().includes('.webp') &&
        !clean.includes('[ImageUrl:') && !clean.includes('[AudioUrl:') && !clean.includes('[VideoUrl:') && !clean.includes('[DocumentUrl:')) {
      return true;
    }
    return false;
  };

  // Helper: Extrai a URL da figurinha da mensagem
  const extractStickerUrl = (msg) => {
    if (!msg) return null;
    if (msg.type === 'sticker' && msg.url) return msg.url;
    const content = (msg.content || '').trim();
    const match = content.match(/\[StickerUrl:(.*?)\]/);
    if (match) return match[1].trim();
    const clean = content.replace(/\[Em resposta a: ".*?"\]\s*/g, '').trim();
    const cleanMatch = clean.match(/\[StickerUrl:(.*?)\]/);
    if (cleanMatch) return cleanMatch[1].trim();
    if ((clean.startsWith('/uploads/') || clean.startsWith('http://') || clean.startsWith('https://')) && clean.toLowerCase().includes('.webp')) {
      return clean;
    }
    return null;
  };

  // Abrir Menu de Contexto ao clicar com o botão direito na mensagem
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    e.stopPropagation();

    const isStk = isStickerMsg(msg);
    const menuWidth = 230;
    const menuHeight = isStk ? 220 : 175;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      visible: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      msg,
      isSticker: isStk,
      showReactions: false
    });
  };

  // Fechar Menu de Contexto ao clicar fora ou pressionar ESC
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = (e) => {
      if (e.target && e.target.closest && e.target.closest('#message-context-menu')) return;
      setContextMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Carregar figurinhas do usuário ao montar ou trocar de usuário
  useEffect(() => {
    loadStickers();
  }, [user?.id]);

  // Ação 1: Adicionar às figurinhas (Salvar na coleção do usuário autenticado)
  const handleSaveStickerToMyCollection = async (msg) => {
    setContextMenu(null);
    const stickerUrl = extractStickerUrl(msg);
    if (!stickerUrl) {
      setAiToast({ type: 'warning', text: 'Não foi possível extrair a figurinha desta mensagem.' });
      setTimeout(() => setAiToast(null), 3000);
      return;
    }

    try {
      const res = await api.saveSticker({
        url: stickerUrl,
        botId: selectedChat?.botId || null,
        name: 'Minha Figurinha'
      });

      const finalUrl = res?.sticker || res?.row?.url || stickerUrl;
      setStickers(prev => [finalUrl, ...prev.filter(s => s !== finalUrl)]);
      setAiToast({ type: 'success', text: 'Figurinha adicionada às suas figurinhas com sucesso! 🎉' });
      setTimeout(() => setAiToast(null), 3500);
    } catch (err) {
      console.error('Erro ao adicionar figurinha às minhas figurinhas:', err);
      setAiToast({ type: 'error', text: `Erro ao adicionar figurinha: ${err.message}` });
      setTimeout(() => setAiToast(null), 4000);
    }
  };

  // Ação 2: Responder com IA
  const handleAiReplyToMessage = async (msg) => {
    setContextMenu(null);
    setReplyingTo(msg);

    try {
      setIsRewriting(true);
      setAiToast({ type: 'info', text: 'Gerando resposta inteligente com IA...' });

      let contextText = '';
      if (isStickerMsg(msg)) {
        contextText = 'O cliente enviou uma figurinha no WhatsApp. Sugira uma resposta curta, cordial, prestativa e amigável para continuar o atendimento.';
      } else {
        contextText = (msg.content || '').replace(/\[Em resposta a: ".*?"\]\s*/g, '').trim();
      }

      const res = await api.aiRewrite({
        text: '',
        tone: 'professional',
        botId: selectedChat?.botId || (selectedBotId !== 'all' ? selectedBotId : null),
        lastCustomerMessage: contextText
      });

      if (res?.rewritten) {
        setInputText(res.rewritten);
        setAiToast({ type: 'success', text: 'Sugestão de resposta gerada pela IA!' });
        setTimeout(() => setAiToast(null), 3500);
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      } else {
        throw new Error('Nenhuma resposta retornada pela IA.');
      }
    } catch (err) {
      console.error('Erro ao responder com IA:', err);
      setAiToast({ 
        type: 'error', 
        text: err.message || 'Erro ao comunicar com a IA. Verifique sua chave da OpenAI nas configurações.' 
      });
      setTimeout(() => setAiToast(null), 5000);
    } finally {
      setIsRewriting(false);
    }
  };

  // Ação 3: Responder (Citar mensagem)
  const handleReplyMessage = (msg) => {
    setContextMenu(null);
    setReplyingTo(msg);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 50);
  };

  // Ação 4: Reagir à mensagem
  const handleReactionFromMenu = (msg, emoji) => {
    handleReact(msg.id, emoji);
    setContextMenu(null);
  };

  // Deletar figurinha da coleção do usuário
  const handleDeleteUserSticker = async (e, stickerUrl) => {
    e.stopPropagation();
    try {
      await api.deleteSticker(stickerUrl);
      setStickers(prev => prev.filter(s => s !== stickerUrl));
      setAiToast({ type: 'info', text: 'Figurinha removida da sua coleção.' });
      setTimeout(() => setAiToast(null), 3000);
    } catch (err) {
      console.error('Erro ao deletar figurinha:', err);
    }
  };

  // Gravação de Áudio via Microfone
  const startAudioRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true, 
          noiseSuppression: false, // Evita corte de sílabas e efeito robótico/aquário do Chrome
          autoGainControl: true 
        }
      });
      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac'
      ];
      const supportedMime = mimeCandidates.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || 'audio/webm';
      const recorderOptions = {
        mimeType: supportedMime,
        audioBitsPerSecond: 128000 // 128 kbps: áudio de alta definição, claro e natural
      };
      const recorder = new MediaRecorder(stream, recorderOptions);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: supportedMime });
        const ext = supportedMime.includes('ogg') ? 'ogg' : (supportedMime.includes('mp4') ? 'mp4' : 'webm');
        const file = new File([audioBlob], `ptt_${Date.now()}.${ext}`, { type: supportedMime });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('botId', selectedChat.botId);
        formData.append('to', selectedChat.contactJid);
        if (replyingTo?.id) {
          formData.append('quotedMsgId', replyingTo.id);
        }

        try {
          setIsUploadingAudio(true);
          await api.uploadFile(formData);
          setReplyingTo(null);
          loadChats();
          setAiToast({ type: 'success', text: 'Nota de voz PTT enviada com sucesso!' });
          setTimeout(() => setAiToast(null), 3000);
        } catch (err) {
          console.error('Erro ao enviar áudio gravado:', err);
          alert(`Erro ao enviar áudio gravado: ${err.message}`);
        } finally {
          setIsUploadingAudio(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Erro microfone:', err);
      alert('Não foi possível acessar seu microfone. Verifique as permissões nas configurações do navegador.');
    }
  };

  const cancelAudioRecord = () => {
    if (mediaRecorderRef.current) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendAudioRecord = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const renderMessageContent = (content, isMe = false, msg = null) => {
    if (!content) return '';

    let mainContent = content;
    let quoteElement = null;

    if (mainContent.startsWith('[Em resposta a: "')) {
      const closeIdx = mainContent.indexOf('"] ');
      if (closeIdx !== -1) {
        let quotedRaw = mainContent.substring(17, closeIdx);
        mainContent = mainContent.substring(closeIdx + 3);

        let quotedLabel = quotedRaw;
        let quotedMediaUrl = null;

        if (quotedRaw.includes('|')) {
          const parts = quotedRaw.split('|');
          quotedLabel = parts[0];
          quotedMediaUrl = parts[1];
        }

        const mediaInfo = getMessageMediaInfo(quotedMediaUrl || quotedRaw);
        const isSticker = mediaInfo?.type === 'sticker' || 
          quotedLabel === 'Figurinha' || 
          quotedRaw.toLowerCase().includes('.webp') ||
          quotedRaw.toLowerCase().includes('chat_sticker') ||
          quotedRaw.toLowerCase().includes('sticker');

        const isImage = !isSticker && (
          mediaInfo?.type === 'image' || 
          quotedLabel === 'Foto' || 
          /\.(jpeg|jpg|png|gif)/i.test(quotedRaw)
        );

        const isVideo = !isSticker && (
          mediaInfo?.type === 'video' || 
          quotedLabel === 'Vídeo' || 
          /\.(mp4|webm)/i.test(quotedRaw)
        );

        const isAudio = mediaInfo?.type === 'audio' || quotedLabel === 'Áudio' || /\.(ogg|mp3|wav|opus)/i.test(quotedRaw);
        const isDoc = mediaInfo?.type === 'document' || quotedLabel.startsWith('Documento');

        // Se previewUrl for nulo ou terminar com reticências '...', recupera a URL original no histórico
        let previewUrl = mediaInfo?.url || quotedMediaUrl;
        if (!previewUrl || previewUrl.endsWith('...')) {
          const cleanPart = quotedRaw.replace('...', '').trim();
          const matchMsg = messages.find(m => m.content && m.content.includes(cleanPart));
          if (matchMsg) {
            const mInfo = getMessageMediaInfo(matchMsg);
            if (mInfo?.url) previewUrl = mInfo.url;
          }
        }
        if (!previewUrl && (quotedRaw.startsWith('/uploads/') || quotedRaw.startsWith('http')) && !quotedRaw.endsWith('...')) {
          previewUrl = quotedRaw;
        }

        quoteElement = (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '6px 10px',
            marginBottom: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.22)',
            borderLeft: '3px solid var(--primary)',
            borderRadius: '6px',
            fontSize: '0.78rem',
            maxWidth: '100%'
          }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontWeight: 700, display: 'block', fontSize: '0.70rem', color: 'var(--primary)', marginBottom: '1px' }}>
                Mensagem Citada
              </span>
              <div style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: 'rgba(255, 255, 255, 0.92)'
              }}>
                {isSticker ? (
                  <>
                    <Sticker size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>Figurinha</span>
                  </>
                ) : isImage ? (
                  <>
                    <ImageIcon size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{mediaInfo?.caption || quotedLabel || 'Foto'}</span>
                  </>
                ) : isVideo ? (
                  <>
                    <VideoIcon size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{mediaInfo?.caption || 'Vídeo'}</span>
                  </>
                ) : isAudio ? (
                  <>
                    <Mic size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>Áudio</span>
                  </>
                ) : isDoc ? (
                  <>
                    <FileText size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{quotedLabel}</span>
                  </>
                ) : (
                  <span>{quotedLabel}</span>
                )}
              </div>
            </div>

            {previewUrl && (isSticker || isImage || isVideo) && (
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: 'rgba(0,0,0,0.2)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {isVideo ? (
                  <video src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                ) : (
                  <img 
                    src={previewUrl} 
                    alt="Citação" 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: isSticker ? 'contain' : 'cover' 
                    }} 
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            )}
          </div>
        );
      }
    }

    const trimmedContent = mainContent.trim();
    const stickerMatch = trimmedContent.match(/\[StickerUrl:(.*?)\]/) ||
      ((trimmedContent.startsWith('/uploads/') || trimmedContent.startsWith('http')) && trimmedContent.includes('.webp') ? [null, trimmedContent] : null);
    if (stickerMatch) {
      return (
        <div>
          {quoteElement}
          <div style={{ marginTop: '4px' }}>
            <img 
              src={stickerMatch[1]} 
              alt="Figurinha" 
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              style={{ width: '135px', height: '135px', objectFit: 'contain', display: 'block', background: 'transparent' }} 
              onError={(e) => { 
                e.target.style.display = 'none'; 
                if (!e.target.nextSibling) {
                  e.target.insertAdjacentHTML('afterend', '<span style="font-size:0.75rem;opacity:0.6;font-style:italic">[Figurinha expirada]</span>');
                }
              }}
            />
          </div>
        </div>
      );
    }

    const albumMatch = mainContent.match(/\[AlbumUrls:(.*?)\]/);
    if (albumMatch) {
      const parts = albumMatch[1].split('|');
      const urls = parts[0].split(',').map(u => u.trim()).filter(Boolean);
      const captionPart = parts.find(p => p.startsWith('caption:'));
      const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : '';

      return (
        <div>
          {quoteElement}
          <div style={{ marginTop: '4px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: urls.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: '4px',
              maxWidth: '300px',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {urls.map((imgUrl, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    cursor: 'pointer',
                    gridColumn: (urls.length === 3 && idx === 0) || (urls.length === 5 && idx === 0) ? 'span 2' : 'span 1'
                  }}
                  onClick={() => window.open(imgUrl, '_blank')}
                  title="Clique para abrir imagem"
                >
                  <img
                    src={imgUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ))}
            </div>
            {caption && (
              <div style={{ marginTop: '6px', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{caption}</div>
            )}
          </div>
        </div>
      );
    }

    const imgMatch = mainContent.match(/\[ImageUrl:(.*?)\]/);
    if (imgMatch) {
      const parts = imgMatch[1].split('|');
      const imgUrl = parts[0];
      const captionPart = parts.find(p => p.startsWith('caption:'));
      const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : '';

      return (
        <div>
          {quoteElement}
          <div style={{ marginTop: '4px' }}>
            <img 
              src={imgUrl} 
              alt="Mídia" 
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'cover', display: 'block' }} 
              onError={(e) => { 
                e.target.style.display = 'none'; 
                if (!e.target.nextSibling) {
                  e.target.insertAdjacentHTML('afterend', '<span style="font-size:0.75rem;opacity:0.6;font-style:italic">[Imagem expirada ou não disponível]</span>');
                }
              }}
            />
            {caption && (
              <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>{caption}</div>
            )}
          </div>
        </div>
      );
    }

    const audioMatch = mainContent.match(/\[AudioUrl:(.*?)\]/);
    if (audioMatch) {
      const parts = audioMatch[1].split('|');
      const audioUrl = parts[0];
      const textPart = mainContent.replace(/\[AudioUrl:.*?\]/, '').trim();
      const hasValidTranscription = textPart && textPart !== '(Transcrição indisponível)' && !textPart.startsWith('(Erro');
      const isCurrentlyTranscribing = transcribingAudioId === (msg?.id || audioUrl);

      return (
        <div>
          {quoteElement}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <WhatsAppAudioPlayer src={audioUrl} isMe={isMe} />

            {/* Bloco de Transcrição Whisper */}
            {hasValidTranscription ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: isMe ? 'rgba(0, 0, 0, 0.22)' : 'var(--bg-secondary)',
                  border: '1px solid',
                  borderColor: isMe ? 'rgba(255, 255, 255, 0.18)' : 'var(--border-subtle)',
                  fontSize: '0.82rem',
                  lineHeight: '1.45',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isMe ? '#ffffff' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={11} />
                    <span>Transcrição do Áudio</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(textPart);
                      setAiToast({ type: 'success', text: 'Transcrição copiada!' });
                      setTimeout(() => setAiToast(null), 2500);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isMe ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.68rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                    title="Copiar texto transcrito"
                  >
                    <Copy size={11} />
                    <span>Copiar</span>
                  </button>
                </div>
                <div style={{ color: isMe ? '#ffffff' : 'var(--text-main)', fontStyle: 'italic', wordBreak: 'break-word' }}>
                  "{textPart}"
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleTranscribeAudio(msg?.id, audioUrl)}
                  disabled={isCurrentlyTranscribing}
                  className="btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    height: 'auto',
                    backgroundColor: isMe ? 'rgba(255, 255, 255, 0.2)' : 'var(--primary-subtle)',
                    color: isMe ? '#ffffff' : 'var(--primary)',
                    border: '1px solid',
                    borderColor: isMe ? 'rgba(255, 255, 255, 0.35)' : 'var(--primary)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: isCurrentlyTranscribing ? 'not-allowed' : 'pointer'
                  }}
                  title="Converter este áudio em texto (Grátis via Groq ou Whisper)"
                >
                  {isCurrentlyTranscribing ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Transcrevendo áudio...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>Transcrever Áudio</span>
                    </>
                  )}
                </button>
                {textPart === '(Transcrição indisponível)' && (
                  <span style={{ fontSize: '0.7rem', color: isMe ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)', fontStyle: 'italic' }}>
                    Áudio não transcrito
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    const videoMatch = mainContent.match(/\[VideoUrl:(.*?)\]/);
    if (videoMatch) {
      const parts = videoMatch[1].split('|');
      const videoUrl = parts[0];
      const captionPart = parts.find(p => p.startsWith('caption:'));
      const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : '';

      return (
        <div>
          {quoteElement}
          <div style={{ marginTop: '4px' }}>
            <video 
              controls 
              src={videoUrl} 
              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', display: 'block' }} 
              onError={(e) => {
                e.target.style.display = 'none';
                if (!e.target.nextSibling) {
                  e.target.insertAdjacentHTML('afterend', '<span style="font-size:0.75rem;opacity:0.6;font-style:italic">[Vídeo expirado ou não disponível]</span>');
                }
              }}
            />
            {caption && (
              <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>{caption}</div>
            )}
          </div>
        </div>
      );
    }
    const docMatch = mainContent.match(/\[DocumentUrl:(.*?)\|filename:(.*?)\]/);
    if (docMatch) {
      const fileUrl = docMatch[1];
      const fileName = docMatch[2];
      const isPdf = (fileName || '').toLowerCase().endsWith('.pdf') || fileUrl.toLowerCase().endsWith('.pdf');

      return (
        <div>
          {quoteElement}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'underline', fontWeight: 600 }}
            >
              <FileText size={16} /> {fileName}
            </a>
            {isPdf && (
              <button
                type="button"
                onClick={() => setViewingPdfModal({ url: fileUrl, name: fileName })}
                style={{
                  background: 'var(--primary-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--primary)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Eye size={12} /> Visualizar PDF
              </button>
            )}
          </div>
        </div>
      );
    }

    const locMatch = mainContent.match(/\[LocationCard:(.*?)\]/);
    if (locMatch) {
      const inner = locMatch[1];
      const parts = inner.split('|');
      const latPart = parts.find(p => p.startsWith('lat='));
      const lngPart = parts.find(p => p.startsWith('lng='));
      const namePart = parts.find(p => p.startsWith('name='));
      const addrPart = parts.find(p => p.startsWith('address='));
      const commPart = parts.find(p => p.startsWith('comment='));
      const lat = latPart ? latPart.replace('lat=', '') : '';
      const lng = lngPart ? lngPart.replace('lng=', '') : '';
      const locName = namePart ? namePart.replace('name=', '') : '';
      const locAddr = addrPart ? addrPart.replace('address=', '') : '';
      const locComment = commPart ? commPart.replace('comment=', '') : '';
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

      return (
        <div style={{ maxWidth: '320px', minWidth: '240px' }}>
          {quoteElement}
          <div 
            style={{
              marginTop: '6px',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : 'var(--bg-secondary)',
              border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-subtle)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
            }}
          >
            {/* Header com Mapa estilizado */}
            <div 
              style={{
                height: '75px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <div 
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.15,
                  backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)',
                  backgroundSize: '12px 12px'
                }} 
              />
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  zIndex: 1
                }}
              >
                <MapPin size={22} />
              </div>
            </div>

            {/* Informações de Localização */}
            <div style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '3px' }}>
                Localização Compartilhada
              </span>
              <strong style={{ fontSize: '0.92rem', color: isMe ? '#ffffff' : 'var(--text-main)', display: 'block', lineHeight: 1.3 }}>
                {locName || 'Ponto no Mapa'}
              </strong>
              {locAddr && (
                <p style={{ fontSize: '0.78rem', color: isMe ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                  {locAddr}
                </p>
              )}
              {locComment && (
                <p style={{ fontSize: '0.75rem', color: isMe ? 'rgba(255,255,255,0.9)' : 'var(--text-main)', fontStyle: 'italic', margin: '4px 0 0 0' }}>
                  "{locComment}"
                </p>
              )}

              {/* Botões de Ação para Google Maps e Waze */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'var(--primary-subtle)',
                    color: isMe ? '#ffffff' : 'var(--primary)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--primary)'
                  }}
                  title="Abrir no Google Maps"
                >
                  <ExternalLink size={13} />
                  <span>Google Maps</span>
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : 'var(--bg-tertiary)',
                    color: isMe ? '#ffffff' : 'var(--text-main)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    border: '1px solid var(--border-subtle)'
                  }}
                  title="Abrir no Waze"
                >
                  <span>Waze</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const contactMatch = mainContent.match(/\[ContactCard:(.*?)\]/);
    if (contactMatch) {
      const inner = contactMatch[1];
      const parts = inner.split('|');
      const namePart = parts.find(p => p.startsWith('name='));
      const phonePart = parts.find(p => p.startsWith('phone='));
      const cName = namePart ? namePart.replace('name=', '') : 'Contato';
      const cPhone = phonePart ? phonePart.replace('phone=', '') : '';
      const cleanPhoneDigits = cPhone.replace(/\D/g, '');

      return (
        <div style={{ maxWidth: '300px', minWidth: '240px' }}>
          {quoteElement}
          <div 
            style={{
              marginTop: '6px',
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : 'var(--bg-secondary)',
              border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-subtle)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : 'var(--primary-subtle)',
                  color: isMe ? '#ffffff' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  flexShrink: 0
                }}
              >
                <User size={22} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--primary)', display: 'block' }}>
                  Contato Compartilhado
                </span>
                <strong style={{ fontSize: '0.92rem', color: isMe ? '#ffffff' : 'var(--text-main)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cName}
                </strong>
                {cPhone && (
                  <span style={{ fontSize: '0.78rem', color: isMe ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', fontFamily: 'monospace', display: 'block' }}>
                    {cPhone}
                  </span>
                )}
              </div>
            </div>

            {/* Ações: Conversar no WhatsApp / Copiar Número */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {cleanPhoneDigits && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(cleanPhoneDigits);
                    setAiToast({ type: 'success', text: `Número ${cPhone} copiado!` });
                    setTimeout(() => setAiToast(null), 2500);
                  }}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'var(--primary-subtle)',
                    color: isMe ? '#ffffff' : 'var(--primary)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--primary)',
                    cursor: 'pointer'
                  }}
                  title="Copiar telefone do contato"
                >
                  <Copy size={12} />
                  <span>Copiar</span>
                </button>
              )}
              {cleanPhoneDigits && (
                <a
                  href={`https://wa.me/${cleanPhoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    border: 'none'
                  }}
                  title="Conversar com este número no WhatsApp"
                >
                  <MessageSquare size={12} />
                  <span>Chamar</span>
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div>
        {quoteElement}
        <div>{mainContent}</div>
      </div>
    );
  };

  // Filtragem de chats por busca, aba de status e etiqueta com deduplicação defensiva de contatos
  const filteredChats = useMemo(() => {
    const list = chats.filter(chat => {
      const matchesQuery = 
        (chat.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (chat.contactJid || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesQuery) return false;

      if (filterTab === 'waiting') return chat.status === 'waiting';
      if (filterTab === 'attending') return chat.status === 'attending';
      if (filterTab === 'finished') return chat.status === 'finished';
      if (filterTab === 'mine') return chat.attendantId === user?.id;

      // Filtro por Etiqueta
      if (selectedTagFilter !== 'all') {
        const chatTags = parseTags(chat.tags);
        const matchesTag = chatTags.some(t => {
          const label = typeof t === 'string' ? t : (t?.name || t?.label);
          return label === selectedTagFilter || t?.id === selectedTagFilter;
        });
        if (!matchesTag) return false;
      }

      return true;
    });

    const seen = new Set();
    const unique = [];
    for (const chat of list) {
      const isOmni = (chat.contactJid || '').endsWith('@instagram') || (chat.contactJid || '').endsWith('@telegram');
      const cleanPhone = (chat.contactJid || '').split('@')[0].replace(/\D/g, '');
      const uniqueKey = isOmni
        ? `${chat.contactJid}`
        : (cleanPhone.length >= 8 ? `${chat.botId || ''}_${cleanPhone.slice(-8)}` : `${chat.botId || ''}_${chat.contactJid || chat.id}`);

      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        unique.push(chat);
      }
    }
    return unique;
  }, [chats, searchQuery, filterTab, user?.id, selectedTagFilter]);

  return (
    <div style={{ display: 'flex', height: '100%', maxHeight: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      {/* Coluna 1: Lista de Conversas */}
      <div 
        style={{
          width: '340px',
          minWidth: '340px',
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Busca e Abas */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar contato ou número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '38px', height: '38px', fontSize: '0.85rem' }}
              />
            </div>
            <button
              type="button"
              onClick={toggleSoundMuted}
              title={isSoundMuted ? "Alertas sonoros desativados (Clique para ativar som)" : "Alertas sonoros ativados (Clique para silenciar)"}
              style={{
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: isSoundMuted ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-primary)',
                color: isSoundMuted ? '#ef4444' : 'var(--primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              {isSoundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          {/* Abas de Status com suporte a Meus Atendimentos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {[
              { id: 'mine', label: 'Meus', count: myAttendingCount, badgeColor: 'var(--primary)' },
              { id: 'waiting', label: 'Fila', count: queueStats.waitingCount, badgeColor: '#ef4444' },
              { id: 'attending', label: 'Ao Vivo' },
              { id: 'finished', label: 'Fim' },
              { id: 'all', label: 'Todos' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                style={{
                  padding: '6px 2px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterTab === tab.id ? 'var(--primary-subtle)' : 'transparent',
                  color: filterTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px'
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span 
                    style={{
                      backgroundColor: tab.badgeColor || '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '0 4px',
                      lineHeight: '14px'
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Painel de Fila de Espera & Estatísticas Round-Robin */}
          {(filterTab === 'waiting' || queueStats.waitingCount > 0) && (
            <div 
              style={{
                margin: '8px 0',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <Clock size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Fila: <strong style={{ color: '#ef4444' }}>{queueStats.waitingCount}</strong> {queueStats.waitingCount === 1 ? 'cliente' : 'clientes'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Espera média: <strong style={{ color: 'var(--text-main)' }}>{queueStats.avgWaitFormatted}</strong>
                  </div>
                </div>
              </div>

              <span 
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  flexShrink: 0
                }}
                title="Novo lead é distribuído automaticamente entre os operadores disponíveis"
              >
                Round-Robin
              </span>
            </div>
          )}

          {/* Barra de Filtros Rápidos por Etiquetas / Tags do Usuário */}
          <div style={{ marginTop: '8px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={11} color="var(--primary)" />
                <span>Status & Etiquetas</span>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {!isTagsExpanded && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (tagFilterScrollRef.current) {
                          tagFilterScrollRef.current.scrollBy({ left: -110, behavior: 'smooth' });
                        }
                      }}
                      className="btn-icon"
                      style={{ width: '22px', height: '22px', padding: 0 }}
                      title="Rolar etiquetas para esquerda"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (tagFilterScrollRef.current) {
                          tagFilterScrollRef.current.scrollBy({ left: 110, behavior: 'smooth' });
                        }
                      }}
                      className="btn-icon"
                      style={{ width: '22px', height: '22px', padding: 0 }}
                      title="Rolar etiquetas para direita"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </>
                )}

                {/* Botão de Expandir / Recolher para ver todas */}
                <button
                  type="button"
                  onClick={() => setIsTagsExpanded(prev => !prev)}
                  className="btn-icon"
                  style={{ 
                    width: '22px', 
                    height: '22px', 
                    padding: 0, 
                    color: isTagsExpanded ? 'var(--primary)' : 'var(--text-muted)',
                    backgroundColor: isTagsExpanded ? 'var(--primary-subtle)' : 'transparent'
                  }}
                  title={isTagsExpanded ? 'Recolher em barra única' : 'Ver todas as etiquetas'}
                >
                  <ChevronDown size={13} style={{ transform: isTagsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </button>
              </div>
            </div>

            {/* Container com Rolagem Horizontal Suave + Suporte ao Scroll do Mouse */}
            <div
              ref={tagFilterScrollRef}
              className="custom-horizontal-scrollbar"
              onWheel={(e) => {
                if (!isTagsExpanded && e.deltaY !== 0 && tagFilterScrollRef.current) {
                  tagFilterScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: isTagsExpanded ? 'wrap' : 'nowrap',
                gap: '5px',
                overflowX: isTagsExpanded ? 'visible' : 'auto',
                overflowY: isTagsExpanded ? 'visible' : 'hidden',
                paddingTop: '2px',
                paddingBottom: isTagsExpanded ? '4px' : '6px',
                scrollBehavior: 'smooth'
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedTagFilter('all')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '16px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: selectedTagFilter === 'all' ? 'var(--primary)' : 'var(--border-subtle)',
                  backgroundColor: selectedTagFilter === 'all' ? 'var(--primary-subtle)' : 'transparent',
                  color: selectedTagFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                🏷️ Todas
              </button>
              {(userTags.length > 0 ? userTags : PRESET_TAGS).map(tagItem => {
                const tagLabel = tagItem.name || tagItem.label;
                const isSelected = selectedTagFilter === tagLabel || selectedTagFilter === tagItem.id;
                const style = getTagStyle(tagItem, userTags);
                const count = chats.filter(c => parseTags(c.tags).some(t => (typeof t === 'string' ? t : (t.name || t.label)) === tagLabel)).length;
                return (
                  <button
                    key={tagItem.id || tagLabel}
                    type="button"
                    onClick={() => setSelectedTagFilter(isSelected ? 'all' : tagLabel)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '16px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: isSelected ? style.color : (count > 0 ? style.border : 'var(--border-subtle)'),
                      backgroundColor: isSelected ? style.bg : (count > 0 ? 'rgba(255,255,255,0.03)' : 'transparent'),
                      color: isSelected ? style.color : (count > 0 ? 'var(--text-main)' : 'var(--text-muted)'),
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0
                    }}
                    title={`Filtrar por ${tagLabel}`}
                  >
                    <span>{tagLabel}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize: '0.62rem',
                        backgroundColor: isSelected ? style.color : 'rgba(255, 255, 255, 0.12)',
                        color: isSelected ? '#ffffff' : 'inherit',
                        padding: '0 4px',
                        borderRadius: '8px'
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'tags' }))}
                style={{
                  padding: '3px 8px',
                  borderRadius: '16px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  border: '1px dashed var(--primary)',
                  backgroundColor: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  flexShrink: 0
                }}
                title="Gerenciar e criar minhas nomenclaturas na tela dedicada"
              >
                <Settings size={11} />
                <span>Nomenclaturas</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Itens */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Nenhum atendimento encontrado.
            </div>
          ) : (
            filteredChats.map(chat => {
              const isSelected = selectedChat && (selectedChat.id === chat.id || selectedChat.contactJid === chat.contactJid);
              const cleanNumber = (chat.contactJid || '').split('@')[0];
              const chatTags = parseTags(chat.tags);
              const chatChannelMeta = getChannelMeta(chat.channel, chat.contactJid);

              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Avatar */}
                  <div 
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      flexShrink: 0,
                      overflow: 'hidden',
                      marginTop: '2px',
                      position: 'relative'
                    }}
                  >
                    {chat.profilePicUrl ? (
                      <img 
                        src={chat.profilePicUrl} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.target.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      (chat.contactName || cleanNumber || 'C').charAt(0).toUpperCase()
                    )}
                    {getPresenceForJid(chat.contactJid)?.presence === 'available' && (
                      <span 
                        style={{
                          position: 'absolute',
                          bottom: '0px',
                          right: '0px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          border: '2px solid var(--bg-secondary)',
                          boxShadow: '0 0 6px #10b981'
                        }}
                        title="Online"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, marginRight: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.contactName || cleanNumber}
                        </span>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: chatChannelMeta.bg,
                            color: chatChannelMeta.color,
                            border: `1px solid ${chatChannelMeta.border}`,
                            flexShrink: 0
                          }}
                          title={`Canal: ${chatChannelMeta.label}`}
                        >
                          {chatChannelMeta.icon}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {chat.csatRating && chat.status === 'finished' && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(245, 158, 11, 0.12)', padding: '1px 5px', borderRadius: '4px' }}>
                            ⭐ {chat.csatRating}/5
                          </span>
                        )}
                        <span className={`badge-status ${chat.status}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          {chat.status === 'attending' ? 'Ao Vivo' : chat.status === 'waiting' ? 'Aguardando' : 'Finalizado'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {(() => {
                        const p = getPresenceForJid(chat.contactJid);
                        if (p?.presence === 'composing') {
                          return (
                            <span style={{ color: '#10b981', fontWeight: 600, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              ✍️ digitando...
                            </span>
                          );
                        }
                        if (p?.presence === 'recording') {
                          return (
                            <span style={{ color: '#10b981', fontWeight: 600, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              🎙️ gravando áudio...
                            </span>
                          );
                        }
                        return (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNumber}</span>
                        );
                      })()}
                      {chat.attendantName && (
                        <span 
                          style={{ 
                            fontSize: '0.68rem', 
                            color: '#93c5fd', 
                            backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                            padding: '1px 6px', 
                            borderRadius: '4px', 
                            maxWidth: '120px', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }} 
                          title={`Atendente responsável: ${chat.attendantName}`}
                        >
                          <User size={10} /> {chat.attendantName}
                        </span>
                      )}
                    </div>

                    {/* Etiquetas / Tags Coloridas do Chat */}
                    {chatTags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {chatTags.slice(0, 3).map((tag, tIdx) => {
                          const style = getTagStyle(tag, userTags);
                          return (
                            <span
                              key={tIdx}
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '10px',
                                backgroundColor: style.bg,
                                color: style.color,
                                border: `1px solid ${style.border}`,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {style.label}
                            </span>
                          );
                        })}
                        {chatTags.length > 3 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                            +{chatTags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna 2: Chat Ativo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', minHeight: 0, overflow: 'hidden' }}>
        {selectedChat ? (
          <>
            {/* Header da Conversa */}
            <div 
              style={{
                height: '70px',
                padding: '0 24px',
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                onClick={() => setShowInfoSidebar(prev => !prev)}
                title={showInfoSidebar ? "Clique para ocultar detalhes do contato" : "Clique para ver detalhes do contato"}
              >
                <div 
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative'
                  }}
                >
                  {selectedChat.profilePicUrl ? (
                    <img 
                      src={selectedChat.profilePicUrl} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.target.style.display = 'none'; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    (selectedChat.contactName || selectedChat.contactJid || 'C').charAt(0).toUpperCase()
                  )}
                  {getPresenceForJid(selectedChat.contactJid)?.presence === 'available' && (
                    <span 
                      style={{
                        position: 'absolute',
                        bottom: '0px',
                        right: '0px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        border: '2px solid var(--bg-secondary)',
                        boxShadow: '0 0 6px #10b981'
                      }}
                      title="Online agora no WhatsApp"
                    />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                      {selectedChat.contactName || selectedChat.contactJid.split('@')[0]}
                    </h3>

                    {/* Badge do Canal */}
                    {(() => {
                      const selMeta = getChannelMeta(selectedChat.channel, selectedChat.contactJid);
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: selMeta.bg,
                            color: selMeta.color,
                            border: `1px solid ${selMeta.border}`
                          }}
                        >
                          {selMeta.icon}
                          <span>{selMeta.label}</span>
                        </span>
                      );
                    })()}

                    {/* Tags Ativas no Header */}
                    {parseTags(selectedChat.tags).map((tag, idx) => {
                      const style = getTagStyle(tag, userTags);
                      return (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: style.bg,
                            color: style.color,
                            border: `1px solid ${style.border}`,
                            lineHeight: 1.2
                          }}
                        >
                          <span>{style.label}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTag(tag);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              opacity: 0.75
                            }}
                            title="Remover esta etiqueta"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}

                    {/* Botão para Gerenciar / Adicionar Etiquetas */}
                    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTagManagerPopover(!showTagManagerPopover);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                          border: '1px dashed var(--border-subtle)',
                          cursor: 'pointer',
                          lineHeight: 1.2,
                          transition: 'var(--transition)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                        title="Adicionar ou alterar etiquetas"
                      >
                        <Tag size={10} />
                        <span>+ Etiqueta</span>
                      </button>

                      {/* Popover de Etiquetas */}
                      {showTagManagerPopover && (
                        <div
                          className="glass-panel animate-scale-up"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: '28px',
                            left: 0,
                            width: '280px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '14px',
                            padding: '12px',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 100
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Tag size={12} color="var(--primary)" /> Etiquetas do Chat
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowTagManagerPopover(false)}
                              className="btn-icon"
                              style={{ width: '22px', height: '22px' }}
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Lista de Nomenclaturas da Empresa */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' }}>
                            {userTags.length === 0 ? (
                              <div style={{ padding: '12px 6px', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Nenhuma nomenclatura cadastrada na empresa.
                              </div>
                            ) : (
                              userTags.map(tagItem => {
                                const tagLabel = tagItem.name || tagItem.label;
                                const currentTags = parseTags(selectedChat.tags);
                                const isChecked = currentTags.some(t => (typeof t === 'string' ? t : (t?.name || t?.label)) === tagLabel);
                                const style = getTagStyle(tagItem, userTags);
                                return (
                                  <button
                                    key={tagItem.id || tagLabel}
                                    type="button"
                                    onClick={() => handleToggleTag(tagLabel)}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      borderRadius: '8px',
                                      border: '1px solid',
                                      borderColor: isChecked ? style.color : 'transparent',
                                      backgroundColor: isChecked ? style.bg : 'var(--bg-tertiary)',
                                      color: isChecked ? style.color : 'var(--text-main)',
                                      fontSize: '0.78rem',
                                      fontWeight: isChecked ? 700 : 500,
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <span>{tagLabel}</span>
                                    {isChecked && <Check size={13} color={style.color} />}
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Criar Nova Nomenclatura Rápida */}
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSaveUserTag();
                              }}
                              style={{ display: 'flex', gap: '6px' }}
                            >
                              <input
                                type="text"
                                placeholder="Nova nomenclatura..."
                                value={customTagInput}
                                onChange={(e) => setCustomTagInput(e.target.value)}
                                style={{ flex: 1, height: '30px', fontSize: '0.76rem', padding: '0 8px' }}
                              />
                              <input
                                type="color"
                                value={customTagColor}
                                onChange={(e) => setCustomTagColor(e.target.value)}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  padding: 0,
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  backgroundColor: 'transparent'
                                }}
                                title="Cor da etiqueta"
                              />
                              <button
                                type="submit"
                                disabled={savingTag || !customTagInput.trim()}
                                className="btn btn-primary"
                                style={{ height: '30px', padding: '0 8px', fontSize: '0.76rem' }}
                                title="Criar e salvar no meu perfil"
                              >
                                {savingTag ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                              </button>
                            </form>

                            {/* Link para Gerenciar na Tela Dedicada */}
                            <div style={{ marginTop: '8px', textAlign: 'center', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowTagManagerPopover(false);
                                  window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'tags' }));
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Settings size={11} />
                                <span>Gerenciar Nomenclaturas na Tela Dedicada</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span>{selectedChat.contactJid.split('@')[0]}</span>
                    <span>•</span>
                    {/* Status de Presença do WhatsApp em Tempo Real */}
                    {(() => {
                      const curPresence = getPresenceForJid(selectedChat.contactJid);
                      const state = curPresence?.presence;

                      if (state === 'composing') {
                        return (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                              <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-block' }}>✍️</span> digitando...
                            </span>
                            <span>•</span>
                          </>
                        );
                      }
                      if (state === 'recording') {
                        return (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                              <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-block' }}>🎙️</span> gravando áudio...
                            </span>
                            <span>•</span>
                          </>
                        );
                      }
                      if (state === 'available') {
                        return (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 600 }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                              Online
                            </span>
                            <span>•</span>
                          </>
                        );
                      }
                      if (state === 'unavailable' || state === 'paused') {
                        return (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af', display: 'inline-block' }}></span>
                              {curPresence?.lastSeen ? `Visto ${new Date(curPresence.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}
                            </span>
                            <span>•</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                    <span>Status: <strong style={{ color: selectedChat.status === 'attending' ? '#10b981' : selectedChat.status === 'waiting' ? '#f59e0b' : '#6b7280' }}>
                      {selectedChat.status === 'attending' ? 'Atendimento Humano' : selectedChat.status === 'waiting' ? 'Fila de Espera' : 'Finalizado'}
                    </strong></span>
                    {selectedChat.attendantName && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                          <UserCheck size={11} /> {selectedChat.attendantName}
                        </span>
                      </>
                    )}
                    {selectedChat.protocol && (
                      <>
                        <span>•</span>
                        <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', color: '#93c5fd', fontSize: '0.72rem' }}>
                          Prot: {selectedChat.protocol}
                        </span>
                      </>
                    )}
                    {selectedChat.status === 'finished' && selectedChat.csatRating && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.72rem' }}>
                          <Star size={11} fill="#fbbf24" /> {selectedChat.csatRating}/5
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Ações de Atendimento */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Botão Transferir Atendimento */}
                <button
                  type="button"
                  onClick={() => handleOpenTransferModal(selectedChat)}
                  className="btn"
                  style={{
                    fontSize: '0.78rem',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Transferir para outro atendente ou devolver para a fila geral"
                >
                  <ArrowRightLeft size={14} /> Transferir
                </button>

                {selectedChat.status === 'finished' ? (
                  <button 
                    onClick={handleTakeOver}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#10b981', borderColor: '#10b981' }}
                    title="Iniciar um novo atendimento com este cliente (Gera novo protocolo e zera avaliação passada)"
                  >
                    <Play size={15} /> Iniciar Novo Atendimento
                  </button>
                ) : selectedChat.status !== 'attending' ? (
                  <button 
                    onClick={handleTakeOver}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <User size={15} /> Assumir Atendimento
                  </button>
                ) : null}

                {selectedChat.status === 'attending' && (
                  <button 
                    onClick={handleFinishChat}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle size={15} /> Finalizar Atendimento
                  </button>
                )}

                {/* Botão Pesquisar Mensagens na Conversa */}
                <button
                  type="button"
                  onClick={() => {
                    setShowInChatSearch(prev => !prev);
                    if (!showInChatSearch) {
                      setTimeout(() => document.getElementById('in-chat-search-input')?.focus(), 100);
                    }
                  }}
                  className="btn-icon"
                  style={{
                    backgroundColor: showInChatSearch ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                    color: showInChatSearch ? 'var(--primary)' : 'inherit',
                    borderRadius: '8px',
                    transition: 'var(--transition)'
                  }}
                  title="Pesquisar mensagens nesta conversa"
                >
                  <Search size={18} />
                </button>

                {/* Menu de Opções / Três Pontinhos */}
                <div style={{ position: 'relative' }} ref={threeDotsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowThreeDotsMenu(prev => !prev)}
                    className="btn-icon"
                    style={{
                      backgroundColor: showThreeDotsMenu ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                      color: showThreeDotsMenu ? 'var(--primary)' : 'inherit',
                      borderRadius: '8px',
                      transition: 'var(--transition)'
                    }}
                    title="Menu de opções (Histórico de atendimentos, Contato, etc.)"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showThreeDotsMenu && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '280px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        boxShadow: '0 14px 35px rgba(0, 0, 0, 0.45), 0 6px 14px rgba(0, 0, 0, 0.25)',
                        padding: '8px',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        backdropFilter: 'blur(10px)',
                        animation: 'fadeIn 0.15s ease'
                      }}
                    >
                      {/* Opção 1: Histórico de Atendimentos (Destaque Principal) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowThreeDotsMenu(false);
                          handleOpenAttendanceHistory();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.14)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#60a5fa',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Clock size={18} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#60a5fa' }}>
                            Histórico de Atendimentos
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            Ver todos os chamados deste cliente
                          </div>
                        </div>
                      </button>

                      {/* Opção 2: Dados do Contato */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowThreeDotsMenu(false);
                          setShowInfoSidebar(prev => !prev);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.84rem',
                          fontWeight: 500,
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <User size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <span>{showInfoSidebar ? 'Ocultar Detalhes do Contato' : 'Ver Detalhes do Contato'}</span>
                      </button>

                      {/* Opção 3: Comprovante Oficial (PDF) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowThreeDotsMenu(false);
                          handleOpenDossier();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.84rem',
                          fontWeight: 500,
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <FileText size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span>Comprovante / Dossiê (PDF)</span>
                      </button>

                      {/* Opção 4: Resumo com Inteligência Artificial */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowThreeDotsMenu(false);
                          handleOpenSummary();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.84rem',
                          fontWeight: 500,
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Sparkles size={16} color="#a78bfa" style={{ flexShrink: 0 }} />
                        <span>Resumir Conversa com IA</span>
                      </button>

                      {/* Opção: Agendar Horário / Consulta */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowThreeDotsMenu(false);
                          handleOpenQuickAppointment();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.84rem',
                          fontWeight: 500,
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Calendar size={16} color="#10b981" style={{ flexShrink: 0 }} />
                        <span>Agendar Horário / Consulta</span>
                      </button>

                      {/* Opção 5: Transferir Atendimento */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowThreeDotsMenu(false);
                          handleOpenTransferModal(selectedChat);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.84rem',
                          fontWeight: 500,
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <ArrowRightLeft size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <span>Transferir Atendimento</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedChat(null);
                    setMessages([]);
                  }}
                  className="btn-icon"
                  style={{
                    borderRadius: '8px',
                    color: 'var(--text-muted)'
                  }}
                  title="Fechar tela de atendimento"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Barra Flutuante de Busca Dentro da Conversa */}
            {showInChatSearch && (
              <div style={{
                padding: '8px 20px',
                backgroundColor: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'fadeIn 0.15s ease'
              }}>
                <Search size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <input
                  id="in-chat-search-input"
                  type="text"
                  placeholder="Pesquisar mensagens nesta conversa..."
                  value={inChatSearchQuery}
                  onChange={(e) => {
                    setInChatSearchQuery(e.target.value);
                    setInChatCurrentIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.shiftKey) handlePrevMatch();
                      else handleNextMatch();
                    } else if (e.key === 'Escape') {
                      setShowInChatSearch(false);
                      setInChatSearchQuery('');
                    }
                  }}
                  style={{
                    flex: 1,
                    height: '32px',
                    padding: '0 10px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />

                {inChatSearchQuery.trim() && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {matchedMessageIds.length > 0 
                      ? `${inChatCurrentIndex + 1} de ${matchedMessageIds.length}` 
                      : 'Nenhum resultado'}
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matchedMessageIds.length === 0}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px', opacity: matchedMessageIds.length === 0 ? 0.4 : 1 }}
                    title="Ocorrência anterior (Shift+Enter)"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matchedMessageIds.length === 0}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px', opacity: matchedMessageIds.length === 0 ? 0.4 : 1 }}
                    title="Próxima ocorrência (Enter)"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInChatSearch(false);
                      setInChatSearchQuery('');
                    }}
                    className="btn-icon"
                    style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
                    title="Fechar busca (Esc)"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Banner de Agendamento Ativo para o Contato */}
            {pendingSchedules.length > 0 && (
              <div 
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 600, overflow: 'hidden' }}>
                  <Clock size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <strong>{pendingSchedules.length} mensagem(ns) agendada(s)</strong> para este cliente
                    {pendingSchedules[0] ? ` — Próxima em: ${new Date(pendingSchedules[0].scheduledAt).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="btn"
                    style={{
                      padding: '3px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Ver Agendamentos
                  </button>
                </div>
              </div>
            )}

            {/* Banner Informativo quando Atendimento está Finalizado */}
            {selectedChat.status === 'finished' && (
              <div 
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'rgba(100, 116, 139, 0.12)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  animation: 'fadeIn 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <CheckCircle size={17} color="#10b981" style={{ flexShrink: 0 }} />
                  <span>
                    Atendimento anterior finalizado {selectedChat.closedAt ? `em ${new Date(selectedChat.closedAt).toLocaleString('pt-BR')}` : ''}
                    {selectedChat.protocol ? ` • Protocolo: ${selectedChat.protocol}` : ''}
                    {selectedChat.csatRating ? ` • Nota: ${selectedChat.csatRating}/5 ⭐` : ''}.
                    Inicie um novo chamado para tratar outra dúvida com este contato.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTakeOver}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '5px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    flexShrink: 0
                  }}
                >
                  <Play size={14} /> Iniciar Novo Atendimento
                </button>
              </div>
            )}

            {/* Timeline de Mensagens com Suporte a Drag & Drop de Arquivos */}
            <div 
              onDragOver={handleChatDragOver}
              onDragLeave={handleChatDragLeave}
              onDrop={handleChatDrop}
              style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
            >
              {/* Overlay de Drag & Drop */}
              {isDragOverChat && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(37, 99, 235, 0.35)',
                  backdropFilter: 'blur(6px)',
                  border: '3px dashed #3b82f6',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  zIndex: 9999,
                  color: '#ffffff',
                  pointerEvents: 'none'
                }}>
                  <Paperclip size={48} className="animate-bounce" />
                  <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                    Solte o arquivo aqui para enviar pelo WhatsApp
                  </span>
                  <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                    Fotos, documentos, PDFs, áudios e vídeos
                  </span>
                </div>
              )}
              <div 
                ref={messagesContainerRef}
                onScroll={handleTimelineScroll}
                style={{
                  flex: 1,
                  padding: '24px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div ref={messagesTopRef} />
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Carregando histórico da conversa...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Nenhuma mensagem registrada nesta conversa.
                  </div>
                ) : (
                  <>
                    {messages.length > visibleMessageLimit && (
                      <div style={{ textAlign: 'center', margin: '8px 0 16px 0' }}>
                        <button
                          type="button"
                          onClick={() => setVisibleMessageLimit(prev => prev + 100)}
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--primary)',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        >
                          Carregar mensagens anteriores ({messages.length - visibleMessageLimit} restantes)
                        </button>
                      </div>
                    )}
                    {(messages.length > visibleMessageLimit ? messages.slice(messages.length - visibleMessageLimit) : messages).map((msg, index, arr) => {
                      const prevMsg = index > 0 ? arr[index - 1] : null;
                      const isFirstMsg = index === 0 && messages.length <= visibleMessageLimit;
                    const isDifferentDay = prevMsg && msg.timestamp && prevMsg.timestamp && (
                      new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString()
                    );
                    const showDayDivider = (isFirstMsg || isDifferentDay) && msg.timestamp;
                    const dayLabel = showDayDivider ? getDayDividerLabel(msg.timestamp) : null;

                    const dayDividerEl = dayLabel ? (
                      <div 
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          margin: '12px 0 6px 0',
                          width: '100%',
                          position: 'sticky',
                          top: '4px',
                          zIndex: 10,
                          pointerEvents: 'none'
                        }}
                      >
                        <div 
                          style={{
                            backgroundColor: '#18222d',
                            color: '#94a3b8',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '4px 14px',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                            textTransform: 'uppercase'
                          }}
                        >
                          {dayLabel}
                        </div>
                      </div>
                    ) : null;

                  const msgKey = msg.id || msg.timestamp || index;
                  const isMatched = matchedMessageIds.includes(msgKey);
                  const isCurrentSelectedMatch = matchedMessageIds[inChatCurrentIndex] === msgKey;

                  const isMe = msg.role === 'assistant' || msg.role === 'attendant';
                  const botNames = ['Suporte Zeplyn', 'IA', 'Assistente Virtual', 'Robô', 'Bot', selectedChat?.botName];
                  const isAttendant = Boolean(msg.senderName && !botNames.includes(msg.senderName));
                  const isBot = msg.role === 'assistant' && !isAttendant;

                  return (
                    <ChatMessageItem
                      key={msgKey}
                      msg={msg}
                      msgKey={msgKey}
                      dayDividerEl={dayDividerEl}
                      isMatched={isMatched}
                      isCurrentSelectedMatch={isCurrentSelectedMatch}
                      isMe={isMe}
                      isBot={isBot}
                      isAttendant={isAttendant}
                      handleContextMenu={handleContextMenu}
                      handleReact={handleReact}
                      renderContent={renderMessageContent}
                    />
                  );
                })}
                  </>
                )}
              <div ref={messagesEndRef} />
            </div>

            {/* Botão Flutuante de Rolar para o Final da Conversa (ao lado inferior direito ao lado da barra de rolagem) */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={handleScrollToBottomClick}
                className="animate-fade-in"
                style={{
                  position: 'absolute',
                  bottom: '18px',
                  right: '20px',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  zIndex: 30,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
                title="Rolar para as mensagens mais recentes"
              >
                <ChevronDown size={22} color="var(--primary)" />
                {unreadCountWhileScrolled > 0 && (
                  <span 
                    className="animate-bounce"
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      borderRadius: '12px',
                      minWidth: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      border: '2px solid var(--bg-secondary)',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.5)'
                    }}
                  >
                    {unreadCountWhileScrolled}
                  </span>
                )}
              </button>
            )}
          </div>

            {/* Input de Envio de Mensagem */}
            <div 
              style={{
                padding: '16px 24px',
                backgroundColor: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-subtle)',
                position: 'relative',
                flexShrink: 0
              }}
            >
              {/* Feedback / Toast e Desfazer da IA */}
              {aiToast && (
                <div 
                  className="animate-fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    fontSize: '0.82rem',
                    backgroundColor: aiToast.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : (aiToast.type === 'success' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                    color: aiToast.type === 'error' ? '#ef4444' : (aiToast.type === 'success' ? '#a78bfa' : '#60a5fa'),
                    border: `1px solid ${aiToast.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} />
                    <span>{aiToast.text}</span>
                  </div>
                  {lastOriginalText && aiToast.type === 'success' && (
                    <button
                      type="button"
                      onClick={handleUndoAiRewrite}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Undo2 size={13} /> Desfazer
                    </button>
                  )}
                </div>
              )}

              {/* Banner de Mensagem Respondida (Quote) */}
              {replyingTo && (() => {
                const media = getMessageMediaInfo(replyingTo);
                const senderDisplayName = replyingTo.senderName || (replyingTo.role === 'user' ? (selectedChat.contactName || 'Contato') : 'Atendente');
                const isSticker = media?.type === 'sticker';
                const isImage = media?.type === 'image';
                const isVideo = media?.type === 'video';
                const isAudio = media?.type === 'audio';
                const isDoc = media?.type === 'document';
                const hasThumbnail = (isSticker || isImage || isVideo) && media?.url;

                return (
                  <div 
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderLeft: '4px solid var(--primary)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Respondendo a {senderDisplayName}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {media ? (
                          <>
                            {isSticker && <Sticker size={14} color="var(--primary)" style={{ flexShrink: 0 }} />}
                            {isImage && <ImageIcon size={14} color="var(--primary)" style={{ flexShrink: 0 }} />}
                            {isVideo && <VideoIcon size={14} color="var(--primary)" style={{ flexShrink: 0 }} />}
                            {isAudio && <Mic size={14} color="var(--primary)" style={{ flexShrink: 0 }} />}
                            {isDoc && <FileText size={14} color="var(--primary)" style={{ flexShrink: 0 }} />}
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {isSticker ? 'Figurinha' : (media.caption || media.label || (isVideo ? 'Vídeo' : isAudio ? 'Mensagem de voz' : 'Mídia'))}
                            </span>
                          </>
                        ) : (
                          <span>{replyingTo.content ? replyingTo.content.substring(0, 100) : 'Mensagem'}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {hasThumbnail && (
                        <div style={{ 
                          width: '42px', 
                          height: '42px', 
                          borderRadius: '6px', 
                          overflow: 'hidden', 
                          backgroundColor: 'rgba(0,0,0,0.22)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {isVideo ? (
                            <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          ) : (
                            <img 
                              src={media.url} 
                              alt="Miniatura" 
                              style={{ width: '100%', height: '100%', objectFit: isSticker ? 'contain' : 'cover' }} 
                            />
                          )}
                        </div>
                      )}

                      <button 
                        type="button" 
                        onClick={() => setReplyingTo(null)} 
                        className="btn-icon"
                        title="Cancelar resposta"
                        style={{ width: '26px', height: '26px', minWidth: '26px' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Popover de Emojis */}
              {showEmojiPicker && (
                <div 
                  className="glass-panel animate-fade-in"
                  style={{
                    position: 'absolute',
                    bottom: replyingTo ? '135px' : '76px',
                    left: '24px',
                    width: '320px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    borderRadius: '12px',
                    padding: '10px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 30,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: '4px'
                  }}
                >
                  {POPULAR_EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInputText(prev => prev + emoji);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Popover de Figurinhas (Stickers) */}
              {showStickerPicker && (
                <div 
                  className="glass-panel animate-fade-in"
                  style={{
                    position: 'absolute',
                    bottom: replyingTo ? '135px' : '76px',
                    left: '24px',
                    width: '380px',
                    maxHeight: '340px',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    padding: '12px',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 35,
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-secondary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sticker size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Minhas Figurinhas ({stickers.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleSyncStickers}
                        disabled={syncingStickers}
                        className="btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Sincronizar/importar figurinhas da conexão WhatsApp"
                      >
                        <RefreshCw size={14} className={syncingStickers ? 'animate-spin' : ''} />
                      </button>

                      <input 
                        type="file" 
                        ref={stickerInputRef} 
                        onChange={handleUploadSticker} 
                        accept="image/webp,image/png,image/jpeg,image/jpg" 
                        style={{ display: 'none' }} 
                      />
                      <button
                        type="button"
                        onClick={() => stickerInputRef.current?.click()}
                        disabled={uploadingSticker}
                        className="btn btn-secondary"
                        style={{ height: '28px', padding: '0 8px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Adicionar imagem do computador às suas figurinhas salvas"
                      >
                        {uploadingSticker ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        {uploadingSticker ? 'Convertendo...' : 'Nova'}
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setShowStickerPicker(false)}
                        className="btn-icon"
                        style={{ width: '24px', height: '24px' }}
                        title="Fechar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.3 }}>
                    💡 Figurinhas salvas com o seu usuário. Para salvar novas figurinhas, clique com o <strong>botão direito</strong> em qualquer figurinha do chat e escolha <strong>Adicionar às figurinhas</strong>!
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '220px', paddingRight: '2px' }}>
                    {loadingStickers ? (
                      <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Loader2 size={16} className="animate-spin" /> Carregando figurinhas...
                      </div>
                    ) : stickers.length === 0 ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        <Sticker size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                        <p style={{ margin: 0, marginBottom: '8px' }}>Nenhuma figurinha na sua coleção ainda.</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => stickerInputRef.current?.click()}
                            className="btn btn-primary"
                            style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                          >
                            <Plus size={13} /> Adicionar Nova
                          </button>
                          <button
                            type="button"
                            onClick={handleSyncStickers}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                          >
                            <RefreshCw size={13} /> Sincronizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {stickers.map((stk, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSendSticker(stk)}
                            style={{
                              aspectRatio: '1',
                              padding: '6px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.06)';
                              e.currentTarget.style.borderColor = 'var(--primary)';
                              const delBtn = e.currentTarget.querySelector('.stk-del-btn');
                              if (delBtn) delBtn.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.borderColor = 'var(--border-subtle)';
                              const delBtn = e.currentTarget.querySelector('.stk-del-btn');
                              if (delBtn) delBtn.style.opacity = '0';
                            }}
                            title="Clique para enviar esta figurinha"
                          >
                            <img
                              src={stk}
                              alt="Figurinha"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              loading="lazy"
                            />
                            <button
                              type="button"
                              className="stk-del-btn"
                              onClick={(e) => handleDeleteUserSticker(e, stk)}
                              title="Remover figurinha das minhas figurinhas"
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                                color: '#ffffff',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                opacity: 0,
                                transition: 'opacity 0.15s ease',
                                zIndex: 2
                              }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Menu Flutuante de Respostas Rápidas & Atalhos com / */}
              {showQuickDropdown && (
                <div 
                  className="glass-panel animate-fade-in"
                  style={{
                    position: 'absolute',
                    bottom: replyingTo ? '140px' : '80px',
                    left: '20px',
                    right: '20px',
                    maxHeight: '340px',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.6)',
                    zIndex: 100,
                    overflow: 'hidden'
                  }}
                >
                  {/* Top Bar do Menu */}
                  <div 
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={16} color="#eab308" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Respostas Rápidas {slashQuery ? `• Filtrando por "/${slashQuery}"` : ''}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        (Use ↑ ↓ e Enter para preencher)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickDropdown(false);
                          setSlashQuery('');
                        }}
                        className="btn-icon"
                        style={{ width: '24px', height: '24px', color: 'var(--text-muted)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Filtro de Categorias */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                      overflowX: 'auto',
                      backgroundColor: 'rgba(0, 0, 0, 0.08)'
                    }}
                  >
                    {['Todos', 'Geral', 'Atendimento', 'Vendas', 'Suporte', 'Financeiro'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setQuickReplyCategory(cat)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          border: quickReplyCategory === cat ? '1px solid var(--primary, #3b82f6)' : '1px solid var(--border-subtle)',
                          backgroundColor: quickReplyCategory === cat ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: quickReplyCategory === cat ? '#60a5fa' : 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Lista de Atalhos */}
                  <div style={{ overflowY: 'auto', padding: '6px', flex: 1 }}>
                    {filteredQuickReplies.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Nenhum atalho encontrado para {slashQuery ? `"${slashQuery}"` : 'esta categoria'}.
                      </div>
                    ) : (
                      filteredQuickReplies.map((qm, idx) => {
                        const isSelected = slashSelectedIndex === idx;
                        const rawShortcut = (qm.shortcut || '').replace(/^\/+/, '');
                        const preview = parseQuickReplyVariables(qm.message || qm.content || '');

                        return (
                          <div
                            key={qm.id || idx}
                            onClick={() => handleApplyQuickReply(qm)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                              border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                              transition: 'all 0.1s ease',
                              marginBottom: '2px'
                            }}
                            onMouseEnter={() => setSlashSelectedIndex(idx)}
                          >
                            <span 
                              style={{
                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                                color: isSelected ? '#93c5fd' : '#60a5fa',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                flexShrink: 0
                              }}
                            >
                              /{rawShortcut}
                            </span>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <strong style={{ fontSize: '0.84rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                                  {qm.title || `Atalho /${rawShortcut}`}
                                </strong>
                                {qm.category && (
                                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                                    {qm.category}
                                  </span>
                                )}
                              </div>
                              <div 
                                style={{ 
                                  fontSize: '0.78rem', 
                                  color: isSelected ? '#e2e8f0' : 'var(--text-muted)', 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis' 
                                }}
                              >
                                {preview}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Menu Flutuante do Catálogo de Produtos da Empresa */}
              {showProductCatalog && (
                <div 
                  className="glass-panel animate-fade-in"
                  style={{
                    position: 'absolute',
                    bottom: replyingTo ? '140px' : '80px',
                    left: '20px',
                    right: '20px',
                    maxHeight: '440px',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7)',
                    zIndex: 100,
                    overflow: 'hidden'
                  }}
                >
                  {/* Top Bar do Catálogo */}
                  <div 
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} color="#818cf8" />
                      <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                        Catálogo de Produtos & Serviços
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 700
                      }}>
                        {chatProducts.length} itens
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => loadChatProducts()}
                        title="Atualizar produtos"
                        className="btn-icon"
                        style={{ width: '26px', height: '26px', color: '#94a3b8' }}
                      >
                        <RefreshCw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowProductCatalog(false)}
                        className="btn-icon"
                        style={{ width: '26px', height: '26px', color: '#94a3b8' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Barra de Pesquisa no Catálogo */}
                  <div style={{
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <Search size={14} color="#94a3b8" />
                      <input
                        type="text"
                        placeholder="Buscar produto por nome, SKU, categoria..."
                        value={chatProductSearch}
                        onChange={(e) => setChatProductSearch(e.target.value)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#f8fafc',
                          fontSize: '0.82rem',
                          width: '100%'
                        }}
                      />
                      {chatProductSearch && (
                        <button
                          type="button"
                          onClick={() => setChatProductSearch('')}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista de Produtos para Envio */}
                  <div style={{ overflowY: 'auto', padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loadingChatProducts ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Loader2 size={16} className="animate-spin" /> Carregando produtos da empresa...
                      </div>
                    ) : chatProducts.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                        Nenhum produto cadastrado para sua empresa. Cadastre produtos no menu <strong>Produtos & Catálogo</strong>.
                      </div>
                    ) : (() => {
                      const filtered = chatProducts.filter(p => {
                        const term = chatProductSearch.trim().toLowerCase();
                        if (!term) return true;
                        return (p.name || '').toLowerCase().includes(term) ||
                               (p.sku || '').toLowerCase().includes(term) ||
                               (p.category || '').toLowerCase().includes(term) ||
                               (p.description || '').toLowerCase().includes(term);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                            Nenhum produto encontrado para "{chatProductSearch}".
                          </div>
                        );
                      }

                      return filtered.map(prod => {
                        const prodImages = Array.isArray(prod.images) && prod.images.length > 0 
                          ? prod.images 
                          : (prod.imageUrl ? [prod.imageUrl] : []);
                        const cover = prodImages[0] || null;
                        const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(prod.price) || 0);

                        return (
                          <div
                            key={prod.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              gap: '12px',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                backgroundColor: '#1e293b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0,
                                position: 'relative',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}>
                                {cover ? (
                                  <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <Package size={20} color="#64748b" />
                                )}
                                {prodImages.length > 1 && (
                                  <span style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    right: '2px',
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    color: '#fff',
                                    fontSize: '0.58rem',
                                    padding: '1px 3px',
                                    borderRadius: '3px',
                                    fontWeight: 700
                                  }}>
                                    {prodImages.length}
                                  </span>
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <strong style={{ fontSize: '0.86rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {prod.name}
                                  </strong>
                                  {prod.sku && (
                                    <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '1px 5px', borderRadius: '4px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                      {prod.sku}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                  <span style={{ color: '#34d399', fontWeight: 700 }}>
                                    {formattedPrice}
                                  </span>
                                  <span style={{ color: '#64748b' }}>•</span>
                                  <span style={{ color: '#94a3b8' }}>
                                    {prod.category || 'Geral'}
                                  </span>
                                  {prod.manageStock && (
                                    <>
                                      <span style={{ color: '#64748b' }}>•</span>
                                      <span style={{ color: prod.stock <= 5 ? '#f87171' : '#38bdf8', fontWeight: 600 }}>
                                        {prod.stock} un.
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleSendProductToChat(prod, 'insert')}
                                title="Inserir texto formatado no campo de mensagem"
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.12)',
                                  color: '#cbd5e1',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Inserir Texto
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendProductToChat(prod, 'send')}
                                title={prodImages.length > 1 ? `Enviar produto com todas as ${prodImages.length} fotos para o WhatsApp` : "Enviar produto com foto e detalhes direto no WhatsApp"}
                                style={{
                                  backgroundColor: '#6366f1',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Send size={11} />
                                <span>{prodImages.length > 1 ? `Enviar (${prodImages.length} fotos)` : 'Enviar'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Seletor de Modo: Mensagem WhatsApp vs Nota Interna (Privada) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setInputMode('message')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: inputMode === 'message' ? 700 : 500,
                    border: inputMode === 'message' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: inputMode === 'message' ? 'var(--primary-subtle)' : 'transparent',
                    color: inputMode === 'message' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MessageSquare size={13} />
                  <span>Mensagem ({selectedChat?.channel === 'instagram' ? 'Instagram' : selectedChat?.channel === 'telegram' ? 'Telegram' : 'WhatsApp'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMode('internal_note')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: inputMode === 'internal_note' ? 700 : 500,
                    border: inputMode === 'internal_note' ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                    backgroundColor: inputMode === 'internal_note' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: inputMode === 'internal_note' ? '#d97706' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Deixar anotação visível somente internamente na conversa (o cliente no WhatsApp NÃO vê)"
                >
                  <Lock size={13} />
                  <span>Nota Interna (Privada)</span>
                </button>

                {inputMode === 'internal_note' && (
                  <span style={{ fontSize: '0.72rem', color: '#d97706', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    🔒 Visível apenas para a equipe interna
                  </span>
                )}
              </div>

              {/* Modo de Gravação de Áudio OU Modo de Texto */}
              {isRecording ? (
                <div 
                  className="animate-fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    boxShadow: '0 2px 12px rgba(239, 68, 68, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700, fontSize: '0.88rem' }}>
                    <span className="recording-pulse-dot" />
                    <span>{String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                  </div>

                  {/* Onda sonora animada estilo WhatsApp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '22px', padding: '0 6px' }}>
                    <div className="audio-wave-bar" style={{ animationDelay: '0.0s' }} />
                    <div className="audio-wave-bar" style={{ animationDelay: '0.2s' }} />
                    <div className="audio-wave-bar" style={{ animationDelay: '0.4s' }} />
                    <div className="audio-wave-bar" style={{ animationDelay: '0.1s' }} />
                    <div className="audio-wave-bar" style={{ animationDelay: '0.3s' }} />
                    <div className="audio-wave-bar" style={{ animationDelay: '0.5s' }} />
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Mic size={13} style={{ color: '#ef4444' }} />
                    <span>Nota de voz nativa (Push-to-Talk)</span>
                  </div>
                  
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={cancelAudioRecord}
                      disabled={isUploadingAudio}
                      className="btn btn-secondary"
                      style={{ height: '36px', padding: '0 12px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Cancelar e descartar áudio"
                    >
                      <Trash2 size={16} /> Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSendAudioRecord}
                      disabled={isUploadingAudio}
                      className="btn btn-primary"
                      style={{ height: '36px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Enviar áudio como nota de voz oficial WhatsApp"
                    >
                      {isUploadingAudio ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Enviando PTT...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Enviar Áudio PTT</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : inputMode === 'internal_note' ? (
                /* FORMULÁRIO EXCLUSIVO: NOTA INTERNA PRIVADA */
                <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div 
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                    title="Modo Nota Interna Privada"
                  >
                    <Pin size={18} />
                  </div>

                  <input
                    ref={chatInputRef}
                    type="text"
                    placeholder="Escreva uma anotação privada ou digite / para atalhos rápidos..."
                    value={inputText}
                    onChange={handleChatInputChange}
                    onKeyDown={handleChatInputKeyDown}
                    style={{
                      flex: 1,
                      height: '42px',
                      borderColor: 'rgba(245, 158, 11, 0.5)',
                      backgroundColor: 'rgba(245, 158, 11, 0.04)',
                      boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.15)',
                      borderRadius: '8px'
                    }}
                    autoFocus
                  />

                  <button
                    type="submit"
                    className="btn"
                    disabled={sending || !inputText.trim()}
                    style={{
                      height: '42px',
                      padding: '0 18px',
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: sending || !inputText.trim() ? 'not-allowed' : 'pointer',
                      opacity: sending || !inputText.trim() ? 0.6 : 1
                    }}
                    title="Salvar nota interna na conversa"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Pin size={15} />}
                    <span>Salvar Nota</span>
                  </button>
                </form>
              ) : (
                /* FORMULÁRIO PADRÃO: MENSAGEM WHATSAPP */
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      style={{ display: 'none' }} 
                    />
                    {/* Menu Unificado de Anexos e Recursos (+) */}
                    <div style={{ position: 'relative' }} ref={attachMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(prev => !prev);
                          setShowEmojiPicker(false);
                          setShowQuickDropdown(false);
                          setShowStickerPicker(false);
                          setShowProductCatalog(false);
                        }}
                        className="btn-icon"
                        style={{
                          backgroundColor: showAttachMenu ? 'rgba(59, 130, 246, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                          color: showAttachMenu ? 'var(--primary)' : 'var(--text-main)',
                          borderRadius: '8px',
                          width: '34px',
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--border-subtle)',
                          transition: 'all 0.2s ease'
                        }}
                        title="Anexar arquivos, produtos ou atalhos (+)"
                      >
                        <Plus size={19} style={{ transform: showAttachMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                      </button>

                      {showAttachMenu && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: replyingTo ? '145px' : '52px',
                            left: 0,
                            width: '270px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '12px',
                            boxShadow: '0 16px 38px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.25)',
                            padding: '6px',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            backdropFilter: 'blur(12px)',
                            animation: 'fadeIn 0.15s ease'
                          }}
                        >
                          {/* 1. Catálogo de Produtos */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachMenu(false);
                              setShowProductCatalog(true);
                              loadChatProducts();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '9px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              color: '#818cf8',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Package size={18} style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Catálogo de Produtos</div>
                              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>Enviar fotos, preços e links</div>
                            </div>
                          </button>

                          {/* 2. Respostas Rápidas */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachMenu(false);
                              setShowQuickDropdown(true);
                              setSlashQuery('');
                              setSlashSelectedIndex(0);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Zap size={18} color="#eab308" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Respostas Rápidas</div>
                              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>Modelos salvos ou digite /</div>
                            </div>
                          </button>

                          {/* 3. Fotos e Documentos */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachMenu(false);
                              fileInputRef.current?.click();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Paperclip size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Fotos e Documentos</div>
                              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>Enviar arquivo do computador</div>
                            </div>
                          </button>

                          {/* 4. Figurinhas */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachMenu(false);
                              setShowStickerPicker(true);
                              loadStickers();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Sticker size={18} color="#10b981" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>Figurinhas (Stickers)</div>
                              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>Enviar stickers do WhatsApp</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botão Emoji */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowStickerPicker(false);
                        setShowQuickDropdown(false);
                        setShowAttachMenu(false);
                      }}
                      className="btn-icon"
                      title="Inserir Emoji"
                    >
                      <Smile size={18} color={showEmojiPicker ? 'var(--primary)' : undefined} />
                    </button>

                  {/* Botão de Reescrever com IA */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleAiRewrite('professional')}
                      disabled={isRewriting}
                      className="btn-icon"
                      title={inputText.trim() ? "Reescrever e aprimorar com IA (Clique no lado para escolher o tom)" : "Gerar resposta sugerida pela IA para o cliente"}
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.14)',
                        color: isRewriting ? 'var(--primary)' : '#8b5cf6',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isRewriting ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAiToneMenu(!showAiToneMenu);
                        setShowEmojiPicker(false);
                        setShowQuickDropdown(false);
                      }}
                      disabled={isRewriting}
                      className="btn-icon"
                      title="Escolher tom da IA (Profissional, Amigável, Direto, Formal, Correção)"
                      style={{
                        width: '20px',
                        minWidth: '20px',
                        padding: 0,
                        backgroundColor: 'rgba(139, 92, 246, 0.14)',
                        color: '#8b5cf6',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        borderLeft: 'none',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0
                      }}
                    >
                      <ChevronDown size={13} />
                    </button>

                    {/* Menu Popover de Tons de IA */}
                    {showAiToneMenu && (
                      <div
                        className="glass-panel animate-fade-in"
                        style={{
                          position: 'absolute',
                          bottom: replyingTo ? '145px' : '55px',
                          left: 0,
                          width: '280px',
                          borderRadius: '12px',
                          padding: '8px',
                          boxShadow: 'var(--shadow-lg)',
                          zIndex: 40,
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid rgba(139, 92, 246, 0.4)'
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#8b5cf6', padding: '4px 8px 6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Sparkles size={13} /> Escolha como a IA deve reescrever:
                        </div>
                        {AI_TONES.map(tone => (
                          <button
                            key={tone.id}
                            type="button"
                            onClick={() => handleAiRewrite(tone.id)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'none',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.84rem',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <span style={{ fontSize: '1.05rem' }}>{tone.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600 }}>{tone.label}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{tone.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    ref={chatInputRef}
                    type="text"
                    placeholder={replyingTo ? "Digite sua resposta..." : "Digite sua mensagem ou digite / para atalhos rápidos..."}
                    value={inputText}
                    onChange={handleChatInputChange}
                    onKeyDown={handleChatInputKeyDown}
                    style={{ flex: 1, height: '42px' }}
                  />

                  {/* Botão de Ditado por Voz Nativo (Web Speech API - 100% Sem IA / Grátis) */}
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className="btn-icon"
                    title={isDictating ? "Parar ditado por voz" : "Ditar mensagem por voz (Web Speech API do Navegador - 100% Grátis / Sem IA)"}
                    style={{
                      height: '38px',
                      width: '38px',
                      minWidth: '38px',
                      color: isDictating ? '#ef4444' : 'var(--text-muted)',
                      backgroundColor: isDictating ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      border: isDictating ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Mic size={17} className={isDictating ? 'recording-pulse-dot' : ''} />
                  </button>

                  {/* Botão de Agendamento de Mensagens / Lembretes */}
                  <button
                    type="button"
                    onClick={handleOpenScheduleModal}
                    className="btn-icon"
                    title="Agendar Mensagem / Lembrete para este cliente"
                    style={{
                      height: '38px',
                      width: '38px',
                      minWidth: '38px',
                      color: pendingSchedules.length > 0 ? '#f59e0b' : 'var(--text-muted)',
                      backgroundColor: pendingSchedules.length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      border: pendingSchedules.length > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : undefined,
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Clock size={17} />
                    {pendingSchedules.length > 0 && (
                      <span 
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#f59e0b'
                        }}
                      />
                    )}
                  </button>

                  {inputText.trim() ? (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={sending}
                      style={{ height: '42px', padding: '0 20px' }}
                      title="Enviar mensagem"
                    >
                      <Send size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startAudioRecord}
                      className="btn-icon"
                      style={{
                        height: '42px',
                        width: '42px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Gravar nota de voz nativa (Push-to-Talk) com microfone"
                    >
                      <Mic size={19} />
                    </button>
                  )}
                </form>
            )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={48} strokeWidth={1.4} style={{ marginBottom: '14px', color: 'var(--primary)', opacity: 0.6 }} />
            <h4 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Nenhum atendimento selecionado</h4>
            <p style={{ fontSize: '0.85rem' }}>Selecione uma conversa na lista à esquerda para interagir em tempo real.</p>
          </div>
        )}
      </div>

      {/* Coluna 3: Drawer de Informações do Contato */}
      {selectedChat && showInfoSidebar && (
        <div 
          style={{
            width: '330px',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-subtle)',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto'
          }}
        >
          {/* Cabeçalho do Drawer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} color="var(--primary)" />
              <span>Detalhes do Contato</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button 
                type="button"
                onClick={handleOpenEditContactModal} 
                className="btn-icon" 
                title="Editar nome do contato"
                style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}
              >
                <Edit2 size={14} />
              </button>
              <button 
                type="button"
                onClick={() => setShowInfoSidebar(false)} 
                className="btn-icon" 
                title="Fechar detalhes"
                style={{ width: '30px', height: '30px', borderRadius: '8px' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Card Principal do Contato (Avatar Central, Status Dot, Nome, Telefone BR, JID/LID) */}
          <div 
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              padding: '20px 16px 16px 16px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}
          >
            {/* Botão de Editar no Canto Superior Direito (Estilo WhatsApp do Print) */}
            <button 
              type="button"
              onClick={handleOpenEditContactModal}
              title="Editar nome salvo no WhatsApp"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <Edit2 size={13} />
            </button>

            {/* Avatar Central Grande com Badge de Status (Red/Green Dot) */}
            <div style={{ position: 'relative', width: '84px', height: '84px', margin: '0 auto 12px auto' }}>
              <div 
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  fontSize: '2rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '3px solid var(--border-subtle)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}
              >
                {selectedChat.profilePicUrl ? (
                  <img 
                    src={selectedChat.profilePicUrl} 
                    alt="" 
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.target.style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  (selectedChat.contactName || selectedChat.name || 'C').charAt(0).toUpperCase()
                )}
              </div>

              {/* Ponto Indicador de Status no Canto Inferior Direito do Avatar */}
              <span 
                title={selectedChat.status === 'attending' ? 'Em Atendimento' : 'Aguardando / Disponível'}
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '3px',
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  backgroundColor: selectedChat.status === 'attending' ? '#10b981' : '#ef4444',
                  border: '2.5px solid var(--bg-primary)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.18)'
                }}
              />
            </div>

            {/* Nome do Contato em Negrito */}
            <h3 
              style={{ 
                fontSize: '1.15rem', 
                fontWeight: 700, 
                color: 'var(--text-main)', 
                margin: '0 0 6px 0',
                lineHeight: 1.25,
                wordBreak: 'break-word'
              }}
            >
              {selectedChat.contactName || selectedChat.name || 'Sem Nome'}
            </h3>

            {/* Telefone Formatado com Bandeira do Brasil 🇧🇷 */}
            <div 
              style={{ 
                fontSize: '0.88rem', 
                fontWeight: 600, 
                color: 'var(--text-secondary)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '6px',
                marginBottom: '4px'
              }}
            >
              <span style={{ fontSize: '1rem' }}>🇧🇷</span>
              <span>{formatBrazilianPhone(selectedChat.contactJid)}</span>
            </div>

            {/* Identificador JID / LID do WhatsApp */}
            <div 
              style={{ 
                fontSize: '0.78rem', 
                color: 'var(--text-muted)', 
                fontFamily: 'monospace',
                opacity: 0.85,
                wordBreak: 'break-all'
              }}
              title="Identificador WhatsApp (LID / JID)"
            >
              {selectedChat.contactJid}
            </div>

            {/* Bloco de Atendente Responsável e Transferência */}
            <div 
              style={{
                marginTop: '14px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status da conversa:</span>
                <span style={{
                  fontWeight: 700,
                  color: selectedChat.status === 'attending' ? '#10b981' : selectedChat.status === 'waiting' ? '#f59e0b' : '#6b7280'
                }}>
                  {selectedChat.status === 'attending' ? '● Em Atendimento' : selectedChat.status === 'waiting' ? '● Na Fila' : '● Finalizado'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Atendente atual:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <UserCheck size={12} color="#3b82f6" />
                  {selectedChat.attendantName || 'Nenhum (Fila Geral)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenTransferModal(selectedChat)}
                style={{
                  marginTop: '4px',
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#60a5fa',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ArrowRightLeft size={14} /> Transferir Atendimento
              </button>

              <button
                type="button"
                onClick={() => handleOpenAttendanceHistory(selectedChat)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Clock size={13} color="var(--primary)" /> Ver Histórico de Atendimentos
              </button>
            </div>
          </div>

          {/* Barra de Filtro de Mídias com Badges Verdes (Áudio, Imagem, Vídeo, Docs, Links, Outros) */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '4px'
            }}
          >
            {[
              { id: 'audio', label: 'Áudio', count: contactMedia.audios.length, icon: Headphones, color: '#8b5cf6' },
              { id: 'image', label: 'Imagem', count: contactMedia.images.length, icon: ImageIcon, color: '#10b981' },
              { id: 'video', label: 'Vídeo', count: contactMedia.videos.length, icon: VideoIcon, color: '#f59e0b' },
              { id: 'doc', label: 'Docs', count: contactMedia.docs.length, icon: FileText, color: '#3b82f6' },
              { id: 'link', label: 'Links', count: contactMedia.links.length, icon: LinkIcon, color: '#06b6d4' },
              { id: 'other', label: 'Outros', count: contactMedia.others.length, icon: MoreHorizontal, color: '#6b7280' },
            ].map(item => {
              const IconComp = item.icon;
              const isActive = activeMediaTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMediaTab(isActive ? null : item.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 2px 6px 2px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--primary-subtle)' : 'var(--bg-primary)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--primary)' : 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    minWidth: 0
                  }}
                  title={`Filtrar ${item.label} (${item.count})`}
                >
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconComp size={18} style={{ color: item.color }} />
                    {item.count > 0 && (
                      <span 
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-10px',
                          minWidth: '15px',
                          height: '15px',
                          padding: '0 3px',
                          borderRadius: '10px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                        }}
                      >
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </div>
                  <span 
                    style={{ 
                      fontSize: '0.68rem', 
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)', 
                      fontWeight: isActive ? 700 : 500,
                      marginTop: '5px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%'
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Visualizador de Galeria quando uma aba de mídia está ativa */}
          {activeMediaTab && (
            <div 
              className="glass-panel animate-fade-in"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '12px',
                maxHeight: '260px',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                  {activeMediaTab === 'audio' && `🎧 Áudios Compartilhados (${contactMedia.audios.length})`}
                  {activeMediaTab === 'image' && `🖼️ Imagens Compartilhadas (${contactMedia.images.length})`}
                  {activeMediaTab === 'video' && `🎥 Vídeos Compartilhados (${contactMedia.videos.length})`}
                  {activeMediaTab === 'doc' && `📄 Documentos Compartilhados (${contactMedia.docs.length})`}
                  {activeMediaTab === 'link' && `🔗 Links Compartilhados (${contactMedia.links.length})`}
                  {activeMediaTab === 'other' && `💬 Outros Compartilhados (${contactMedia.others.length})`}
                </span>
                <button 
                  type="button" 
                  onClick={() => setActiveMediaTab(null)} 
                  className="btn-icon" 
                  style={{ width: '22px', height: '22px' }}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Renderização da Galeria por Tipo */}
              {activeMediaTab === 'audio' && (
                contactMedia.audios.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum áudio nesta conversa.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {contactMedia.audios.map((aud, i) => (
                      <div key={aud.id || i} style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span>{aud.isMe ? 'Enviado por você' : 'Cliente'}</span>
                          <span>{aud.timestamp ? new Date(aud.timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <WhatsAppAudioPlayer src={aud.url} isMe={aud.isMe} />
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeMediaTab === 'image' && (
                contactMedia.images.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhuma imagem nesta conversa.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {contactMedia.images.map((img, i) => (
                      <a 
                        key={img.id || i} 
                        href={img.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', height: '70px', border: '1px solid var(--border-subtle)', position: 'relative' }}
                      >
                        <img 
                          src={img.url} 
                          alt="Mídia" 
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </a>
                    ))}
                  </div>
                )
              )}

              {activeMediaTab === 'video' && (
                contactMedia.videos.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum vídeo nesta conversa.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {contactMedia.videos.map((vid, i) => (
                      <div key={vid.id || i} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <video controls src={vid.url} style={{ width: '100%', maxHeight: '140px', display: 'block' }} />
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeMediaTab === 'doc' && (
                contactMedia.docs.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum documento nesta conversa.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {contactMedia.docs.map((doc, i) => (
                      <a 
                        key={doc.id || i} 
                        href={doc.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          textDecoration: 'none',
                          color: 'var(--text-main)',
                          fontSize: '0.74rem',
                          fontWeight: 500
                        }}
                      >
                        <FileText size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.name || 'Documento'}</span>
                        <Download size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )
              )}

              {activeMediaTab === 'link' && (
                contactMedia.links.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum link nesta conversa.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {contactMedia.links.map((lnk, i) => (
                      <a 
                        key={lnk.id || i} 
                        href={lnk.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--primary)',
                          fontSize: '0.74rem',
                          textDecoration: 'underline',
                          wordBreak: 'break-all'
                        }}
                      >
                        <LinkIcon size={13} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lnk.url}</span>
                        <ExternalLink size={12} style={{ flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )
              )}

              {activeMediaTab === 'other' && (
                contactMedia.others.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum outro item nesta conversa.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {contactMedia.others.map((oth, i) => (
                      <div key={oth.id || i} style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                        {oth.type === 'sticker' ? (
                          <img src={oth.url} alt="Sticker" style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto' }} />
                        ) : (
                          <span style={{ fontSize: '0.72rem' }}>{oth.title || 'Item'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Status Atual:</span>
              <strong style={{ color: 'var(--text-main)' }}>
                {selectedChat.status === 'attending' ? 'Em Atendimento Humano' : selectedChat.status === 'waiting' ? 'Aguardando na Fila' : 'Finalizado'}
              </strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Início da Conversa:</span>
              <strong style={{ color: 'var(--text-main)' }}>
                {selectedChat.createdAt ? new Date(selectedChat.createdAt).toLocaleString() : 'N/A'}
              </strong>
            </div>

            {selectedChat.csatRating && (
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Avaliação CSAT:</span>
                <strong style={{ color: 'var(--accent-amber)' }}>
                  ★ {selectedChat.csatRating} / 5
                </strong>
                {selectedChat.csatComment && (
                  <p style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                    "{selectedChat.csatComment}"
                  </p>
                )}
              </div>
            )}

            {/* SEÇÃO: ETIQUETAS / TAGS DO CONTATO */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={14} color="var(--primary)" /> Etiquetas / Tags
                </span>
                <button
                  type="button"
                  onClick={() => setShowManageTagsModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Gerenciar e criar minhas nomenclaturas de status"
                >
                  ⚙️ Gerenciar
                </button>
              </div>

              {parseTags(selectedChat.tags).length === 0 ? (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Nenhuma etiqueta vinculada.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {parseTags(selectedChat.tags).map(tag => {
                    const style = getTagStyle(tag, userTags);
                    return (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          backgroundColor: style.bg,
                          color: style.color,
                          border: `1px solid ${style.border}`
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: style.color,
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0.8
                          }}
                          title="Remover etiqueta"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEÇÃO: NOTAS INTERNAS REGISTRADAS */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14} color="#f59e0b" /> Notas da Equipe
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {messages.filter(m => m.role === 'internal_note').length} nota(s)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {messages.filter(m => m.role === 'internal_note').length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhuma nota interna registrada nesta conversa.
                  </div>
                ) : (
                  messages.filter(m => m.role === 'internal_note').map(note => (
                    <div
                      key={note.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        fontSize: '0.76rem',
                        lineHeight: '1.35'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#d97706' }}>{note.senderName || 'Atendente'}</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          {note.timestamp ? new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE PDF EM TELA CHEIA */}
      {viewingPdfModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              maxWidth: '960px',
              height: '88vh',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div 
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileText size={20} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {viewingPdfModal.name || 'Documento PDF'}
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Visualização em tempo real
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={viewingPdfModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                  title="Abrir em nova aba do navegador"
                >
                  <ExternalLink size={14} /> Nova Aba
                </a>
                <button 
                  onClick={() => setViewingPdfModal(null)} 
                  className="btn-icon" 
                  style={{ width: '32px', height: '32px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Visualizador Iframe */}
            <div style={{ flex: 1, backgroundColor: '#fff', overflow: 'hidden' }}>
              <iframe
                src={viewingPdfModal.url}
                title={viewingPdfModal.name}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TRANSFERÊNCIA DE ATENDIMENTO */}
      {showTransferModal && chatToTransfer && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10070,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingTransfer) {
              setShowTransferModal(false);
            }
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              backgroundColor: 'var(--bg-primary)',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal */}
            <div 
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.18)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Transferir Atendimento
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {chatToTransfer.contactName || chatToTransfer.name || 'Cliente'} • {chatToTransfer.contactJid ? chatToTransfer.contactJid.split('@')[0] : ''}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !submittingTransfer && setShowTransferModal(false)}
                className="btn-icon"
                disabled={submittingTransfer}
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Destino da Transferência */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'block' }}>
                  Escolha o destino da transferência
                </label>

                {/* Abas Segmentadas: Setor / Atendente / Fila Geral */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr', 
                  gap: '6px', 
                  marginBottom: '14px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  padding: '4px', 
                  borderRadius: '10px', 
                  border: '1px solid var(--border-subtle)' 
                }}>
                  <button
                    type="button"
                    onClick={() => setTransferType('department')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: transferType === 'department' ? 700 : 500,
                      backgroundColor: transferType === 'department' ? 'var(--primary)' : 'transparent',
                      color: transferType === 'department' ? '#ffffff' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Building2 size={14} /> Setor / Equipe
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferType('attendant')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: transferType === 'attendant' ? 700 : 500,
                      backgroundColor: transferType === 'attendant' ? 'var(--primary)' : 'transparent',
                      color: transferType === 'attendant' ? '#ffffff' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <UserCheck size={14} /> Atendente
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransferType('queue');
                      setSelectedTargetAttendantId('queue');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: transferType === 'queue' ? 700 : 500,
                      backgroundColor: transferType === 'queue' ? 'var(--primary)' : 'transparent',
                      color: transferType === 'queue' ? '#ffffff' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Users size={14} /> Fila Geral
                  </button>
                </div>

                {/* Painel: Setor / Departamento */}
                {transferType === 'department' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Selecione o setor da empresa:
                      </span>
                      {loadingAttendants && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={12} className="animate-spin" /> Carregando...
                        </span>
                      )}
                    </div>

                    {departmentsList.length === 0 && !loadingAttendants ? (
                      <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Nenhum departamento cadastrado. Você pode transferir diretamente para um Atendente ou para a Fila Geral.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', maxHeight: '190px', overflowY: 'auto' }}>
                        {departmentsList.map((dept, idx) => {
                          const deptName = typeof dept === 'string' ? dept : (dept.name || '');
                          const isSelected = selectedDepartment === deptName;
                          const deptAttendants = attendantsList.filter(a => a.department && a.department.toLowerCase() === deptName.toLowerCase());
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedDepartment(deptName)}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid',
                                borderColor: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                                backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  backgroundColor: isSelected ? 'var(--primary)' : 'rgba(59, 130, 246, 0.12)',
                                  color: isSelected ? '#ffffff' : '#3b82f6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <Building2 size={16} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                    {deptName}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {deptAttendants.length} atendente(s) vinculado(s)
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 7px',
                                  borderRadius: '12px',
                                  backgroundColor: deptAttendants.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: deptAttendants.length > 0 ? '#10b981' : '#ef4444',
                                  fontWeight: 600
                                }}>
                                  {deptAttendants.length > 0 ? 'Equipe disponível' : 'Sem operadores'}
                                </span>
                                {isSelected && <Check size={16} color="var(--primary)" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Painel: Atendente Específico */}
                {transferType === 'attendant' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Selecione o atendente de destino:
                      </span>
                      {loadingAttendants && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={12} className="animate-spin" /> Carregando...
                        </span>
                      )}
                    </div>

                    {/* Campo de Busca de Atendente */}
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: '8px'
                      }}
                    >
                      <Search size={15} color="var(--text-muted)" />
                      <input
                        type="text"
                        placeholder="Filtrar por nome ou e-mail..."
                        value={transferSearch}
                        onChange={(e) => setTransferSearch(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-main)',
                          fontSize: '0.82rem',
                          width: '100%'
                        }}
                      />
                      {transferSearch && (
                        <button 
                          type="button" 
                          onClick={() => setTransferSearch('')}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Lista de Atendentes */}
                    <div 
                      style={{
                        maxHeight: '170px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {attendantsList
                        .filter(att => {
                          if (!transferSearch) return true;
                          const query = transferSearch.toLowerCase();
                          return (
                            (att.name && att.name.toLowerCase().includes(query)) ||
                            (att.email && att.email.toLowerCase().includes(query)) ||
                            (att.department && att.department.toLowerCase().includes(query))
                          );
                        })
                        .map(att => {
                          const isSelected = selectedTargetAttendantId === att.id;
                          const isCurrentAttendant = chatToTransfer.attendantId === att.id;
                          return (
                            <div
                              key={att.id}
                              onClick={() => setSelectedTargetAttendantId(att.id)}
                              style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                backgroundColor: isSelected ? 'var(--primary-subtle)' : 'transparent',
                                borderBottom: '1px solid var(--border-subtle)',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div 
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}
                                >
                                  {(att.name || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {att.name}
                                    </span>
                                    {isCurrentAttendant && (
                                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
                                        Atual
                                      </span>
                                    )}
                                    {att.department && (
                                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                                        {att.department}
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {att.email}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <span 
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: att.isAvailable !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                    color: att.isAvailable !== false ? '#10b981' : '#f59e0b',
                                    fontWeight: 700
                                  }}
                                  title={att.isAvailable !== false ? 'Atendente disponível' : 'Atendente pausado/ausente no momento'}
                                >
                                  {att.isAvailable !== false ? '🟢 Disponível' : '🟠 Pausado'}
                                </span>

                                <span 
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: (att.activeChatsCount || 0) > 0 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                    color: (att.activeChatsCount || 0) > 0 ? '#60a5fa' : '#34d399',
                                    fontWeight: 600
                                  }}
                                  title="Quantidade de conversas ativas no momento"
                                >
                                  {att.activeChatsCount || 0} ativo(s)
                                </span>
                                {isSelected && <Check size={16} color="var(--primary)" />}
                              </div>
                            </div>
                          );
                        })}

                      {attendantsList.length === 0 && !loadingAttendants && (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Nenhum atendente cadastrado na equipe.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Painel: Fila Geral de Espera */}
                {transferType === 'queue' && (
                  <div 
                    onClick={() => setSelectedTargetAttendantId('queue')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--primary)',
                      backgroundColor: 'var(--primary-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px'
                    }}
                  >
                    <div 
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Users size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Fila Geral de Espera (Plantão)
                        </strong>
                        <Check size={16} color="var(--primary)" />
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Desvincula o operador atual e coloca a conversa de volta na fila compartilhada. Qualquer operador livre poderá puxar o atendimento.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Motivo da Transferência (Nota Interna) */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Motivo / Observação para a Equipe <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span></span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ficará registrado no histórico</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Cliente confirmou dados, só precisa do boleto de Outubro..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Opção de Notificar Cliente no WhatsApp */}
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={notifyClientWhatsApp}
                  onChange={(e) => setNotifyClientWhatsApp(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  <strong>Avisar cliente no WhatsApp</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Envia uma mensagem automática amigável informando o redirecionamento.
                  </div>
                </div>
              </label>
            </div>

            {/* Rodapé com Botões */}
            <div 
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                disabled={submittingTransfer}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={
                  submittingTransfer ||
                  (transferType === 'department' && !selectedDepartment) ||
                  (transferType === 'attendant' && !selectedTargetAttendantId)
                }
                className="btn btn-primary"
                style={{
                  padding: '8px 20px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (
                    submittingTransfer ||
                    (transferType === 'department' && !selectedDepartment) ||
                    (transferType === 'attendant' && !selectedTargetAttendantId)
                  ) ? 0.6 : 1,
                  cursor: (
                    submittingTransfer ||
                    (transferType === 'department' && !selectedDepartment) ||
                    (transferType === 'attendant' && !selectedTargetAttendantId)
                  ) ? 'not-allowed' : 'pointer'
                }}
              >
                {submittingTransfer ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Transferindo...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={15} /> Confirmar Transferência
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESUMO INTELIGENTE COM IA */}
      {showSummaryModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10060,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '680px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal */}
            <div 
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)'
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Resumo Inteligente com IA
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Síntese executiva em 3 tópicos para {selectedChat?.contactName || 'Contato'}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setShowSummaryModal(false)} 
                className="btn-icon" 
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: '24px', maxHeight: '65vh', overflowY: 'auto' }}>
              {summaryLoading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <Loader2 size={36} className="animate-spin" color="#8b5cf6" />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    Lendo histórico e sintetizando conversa...
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '380px' }}>
                    Nossa IA está analisando as mensagens trocadas para extrair o motivo do contato, histórico atual e próxima ação recomendada.
                  </div>
                </div>
              ) : summaryError ? (
                <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>{summaryError}</p>
                  <button 
                    onClick={handleOpenSummary} 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : summaryData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Card 1: Motivo do Contato */}
                  <div 
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                      <span>🎯 1. Motivo do Contato</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                      {summaryData.motivo || 'Não identificado com precisão.'}
                    </div>
                  </div>

                  {/* Card 2: Histórico & Situação Atual */}
                  <div 
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                      <span>📋 2. Histórico & Situação Atual</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                      {summaryData.historico || 'Nenhum histórico recente.'}
                    </div>
                  </div>

                  {/* Card 3: Próxima Ação Recomendada */}
                  <div 
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                      <span>⚡ 3. Próxima Ação Recomendada</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                      {summaryData.proximaAcao || 'Dar continuidade ao atendimento padrão.'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Rodapé de Ações */}
            <div 
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                Fechar
              </button>

              {summaryData && !summaryLoading && (
                <>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Copiar texto do resumo para a área de transferência"
                  >
                    {summaryCopied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                    <span>{summaryCopied ? 'Copiado!' : 'Copiar Resumo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSummaryAsNote}
                    disabled={summarySavingNote}
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#f59e0b',
                      borderColor: '#f59e0b',
                      color: '#ffffff'
                    }}
                    title="Registrar automaticamente este resumo como uma Nota Interna na conversa"
                  >
                    {summarySavingNote ? <Loader2 size={15} className="animate-spin" /> : <Pin size={15} />}
                    <span>{summarySavingNote ? 'Salvando...' : 'Salvar como Nota Interna'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO DE NOMENCLATURAS E STATUS (PERSONALIZADO POR USUÁRIO) */}
      {showManageTagsModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10070,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '620px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal */}
            <div 
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Tag size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Nomenclaturas & Etiquetas da Empresa
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Personalize as tags, cores e nomes de status vinculadas à sua empresa.
                  </span>
                </div>
              </div>

              <button 
                onClick={() => {
                  setShowManageTagsModal(false);
                  handleCancelEditTag();
                }} 
                className="btn-icon" 
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '24px', maxHeight: '65vh', overflowY: 'auto' }}>
              {/* Formulário de Criação / Edição */}
              <div 
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {editingTag ? <Edit2 size={14} color="var(--primary)" /> : <Plus size={14} color="var(--primary)" />}
                  <span>{editingTag ? `Editar Nomenclatura: "${editingTag.name}"` : 'Criar Nova Nomenclatura'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Nome / Nomenclatura do Status
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 🚀 Lead Quente, 💰 Proposta Enviada, 📞 Retornar Ligação..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveUserTag();
                        }
                      }}
                      style={{ width: '100%', height: '38px', fontSize: '0.86rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Cor de Identificação Visual
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
                        '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
                      ].map(colorHex => (
                        <button
                          key={colorHex}
                          type="button"
                          onClick={() => setCustomTagColor(colorHex)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: colorHex,
                            border: customTagColor === colorHex ? '2px solid #ffffff' : '2px solid transparent',
                            boxShadow: customTagColor === colorHex ? '0 0 0 2px ' + colorHex : 'none',
                            cursor: 'pointer',
                            transition: 'transform 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        />
                      ))}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                        <input
                          type="color"
                          value={customTagColor}
                          onChange={(e) => setCustomTagColor(e.target.value)}
                          style={{
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            backgroundColor: 'transparent'
                          }}
                          title="Selecione qualquer cor personalizada"
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {customTagColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Prévia da Etiqueta */}
                  {customTagInput.trim() && (
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Prévia visual no chat:
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '14px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: `${customTagColor}22`,
                          color: customTagColor,
                          border: `1px solid ${customTagColor}55`
                        }}
                      >
                        {customTagInput.trim()}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={handleSaveUserTag}
                      disabled={savingTag || !customTagInput.trim()}
                      className="btn btn-primary"
                      style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {savingTag ? <Loader2 size={14} className="animate-spin" /> : editingTag ? <Check size={14} /> : <Plus size={14} />}
                      <span>{editingTag ? 'Salvar Alteração' : 'Criar Nomenclatura'}</span>
                    </button>

                    {editingTag && (
                      <button
                        type="button"
                        onClick={handleCancelEditTag}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista das Nomenclaturas Atuais do Usuário */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Nomenclaturas da Empresa ({userTags.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Empresa: {user?.companyName || user?.companyId || 'Sua Empresa'}
                </span>
              </div>

              {loadingUserTags ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin" /> Carregando as nomenclaturas da empresa...
                </div>
              ) : userTags.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  Nenhuma etiqueta personalizada encontrada para sua empresa. Crie uma acima para começar!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {userTags.map(tag => {
                    const style = getTagStyle(tag, userTags);
                    const chatsWithThisTag = chats.filter(c => parseTags(c.tags).some(t => (typeof t === 'string' ? t : (t.name || t.label)) === tag.name)).length;
                    return (
                      <div
                        key={tag.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 10px',
                              borderRadius: '14px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              backgroundColor: style.bg,
                              color: style.color,
                              border: `1px solid ${style.border}`
                            }}
                          >
                            {tag.name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {chatsWithThisTag} conversa(s) ativa(s)
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => handleStartEditTag(tag, e)}
                            className="btn-icon"
                            style={{ width: '28px', height: '28px' }}
                            title="Editar nome ou cor desta etiqueta"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteUserTag(tag.id, e)}
                            className="btn-icon"
                            style={{ width: '28px', height: '28px', color: '#ef4444' }}
                            title="Remover esta nomenclatura do seu perfil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div 
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowManageTagsModal(false);
                  handleCancelEditTag();
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.84rem' }}
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: AGENDAMENTO DE MENSAGENS & LEMBRETES             */}
      {/* ======================================================== */}
      {showScheduleModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            padding: '20px'
          }}
        >
          <div 
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Cabeçalho */}
            <div 
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-tertiary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Clock size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Agendar Mensagem / Lembrete
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Para: <strong style={{ color: 'var(--text-main)' }}>{selectedChat?.contactName || selectedChat?.contactJid}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Lista de Agendamentos Ativos */}
              {pendingSchedules.length > 0 && (
                <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    <span>Agendamentos Pendentes para este cliente ({pendingSchedules.length})</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingSchedules.map(item => (
                      <div 
                        key={item.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                              📅 {new Date(item.scheduledAt).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {item.cancelIfCustomerReplies && (
                              <span 
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                Auto-cancela ao responder
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                            "{item.message}"
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCancelSchedule(item.id)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: '#ef4444', flexShrink: 0 }}
                          title="Cancelar este agendamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulário de Novo Agendamento */}
              <form onSubmit={handleSaveSchedule}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Mensagem a ser enviada <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    placeholder="Digite a mensagem ou lembrete que será enviado no horário programado..."
                    value={scheduleText}
                    onChange={(e) => setScheduleText(e.target.value)}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-main)',
                      fontSize: '0.86rem',
                      resize: 'vertical'
                    }}
                    required
                  />

                  {/* Atalhos de Mensagens Frequentes */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {[
                      { label: 'Follow-up de Proposta', text: 'Olá! Tudo bem? Passando para saber se conseguiu analisar nossa proposta enviada.' },
                      { label: 'Lembrete de Reunião', text: 'Olá! Lembrando que nossa reunião está confirmada para hoje.' },
                      { label: 'Retomada de Contato', text: 'Olá! Ficamos à disposição caso precise de mais alguma informação ou suporte.' }
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setScheduleText(preset.text)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data e Hora do Envio */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Data e Hora do Disparo <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                    required
                  />

                  {/* Atalhos Rápidos de Horário */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {[
                      { id: '1h', label: '⏰ Daqui a 1 hora' },
                      { id: 'tomorrow_9', label: '🌅 Amanhã às 09:00' },
                      { id: 'tomorrow_14', label: '☀️ Amanhã às 14:00' },
                      { id: 'monday_9', label: '📅 Próxima Segunda 09:00' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplySchedulePresetTime(p.id)}
                        style={{
                          fontSize: '0.72rem',
                          padding: '4px 9px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--primary-subtle)',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary-subtle)',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opção Inteligente de Auto-Cancelamento */}
                <div 
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    marginBottom: '18px'
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={scheduleCancelIfReply}
                      onChange={(e) => setScheduleCancelIfReply(e.target.checked)}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Cancelar agendamento automaticamente se o cliente responder antes
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                        Se o cliente enviar qualquer mensagem no WhatsApp antes do horário programado, este agendamento será cancelado para evitar mensagens inconvenientes.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Rodapé dos Botões */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="btn btn-secondary"
                    disabled={savingSchedule}
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingSchedule}
                    style={{ minWidth: '160px', fontWeight: 700 }}
                  >
                    {savingSchedule ? 'Agendando...' : 'Confirmar Agendamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Dossiê / Comprovante Oficial de Atendimento */}
      {showDossierModal && (
        <div 
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDossierModal(false);
          }}
        >
          <div 
            className="modal-content"
            style={{
              backgroundColor: 'var(--bg-card, #1e293b)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div 
              className="dossier-no-print"
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Comprovante & Dossiê de Atendimento
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Relatório oficial para compliance, auditoria e envio ao cliente em PDF
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handlePrintDossier}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 16px', fontWeight: 600 }}
                  disabled={loadingDossier || !dossierData}
                >
                  <Printer size={15} /> Imprimir / Salvar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowDossierModal(false)}
                  className="btn-icon"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {loadingDossier ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Compilando histórico e gerando assinatura digital do atendimento...</p>
                </div>
              ) : !dossierData ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Não foi possível carregar as informações do dossiê.
                </div>
              ) : (
                /* Print container */
                <div 
                  id="dossier-print-container"
                  style={{
                    backgroundColor: 'var(--bg-main, #0f172a)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '24px',
                    color: 'var(--text-main, #f8fafc)',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >

                  {/* Header do Dossiê */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary, #3b82f6)' }}>
                        {dossierData.company?.name || 'Zeplyn'}
                      </h2>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }} className="dossier-text-muted">
                        COMPROVANTE OFICIAL DE ATENDIMENTO DIGITAL
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div 
                        className="dossier-box"
                        style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          fontFamily: 'monospace',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: '#60a5fa'
                        }}
                      >
                        PROTOCOLO: {dossierData.protocol}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }} className="dossier-text-muted">
                        Emitido em: {new Date(dossierData.generatedAt).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  {/* Cards de Metadados: Cliente vs Atendimento */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    {/* Dados do Cliente */}
                    <div 
                      className="dossier-box"
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }} className="dossier-text-muted">
                        Dados do Cliente
                      </div>
                      <div style={{ fontSize: '0.86rem', lineHeight: '1.6' }}>
                        <div><strong>Nome:</strong> {dossierData.client?.name || 'Não informado'}</div>
                        <div><strong>WhatsApp:</strong> {dossierData.client?.phone || dossierData.client?.jid?.split('@')[0]}</div>
                        <div><strong>Início:</strong> {dossierData.client?.createdAt ? new Date(dossierData.client.createdAt).toLocaleString('pt-BR') : '-'}</div>
                        <div><strong>Encerramento:</strong> {dossierData.client?.closedAt ? new Date(dossierData.client.closedAt).toLocaleString('pt-BR') : 'Em andamento'}</div>
                      </div>
                    </div>

                    {/* Dados do Atendente & CSAT */}
                    <div 
                      className="dossier-box"
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }} className="dossier-text-muted">
                        Atendimento & Satisfação
                      </div>
                      <div style={{ fontSize: '0.86rem', lineHeight: '1.6' }}>
                        <div><strong>Operador:</strong> {dossierData.attendant?.name || 'IA / Automático'} {dossierData.attendant?.role ? `(${dossierData.attendant.role})` : ''}</div>
                        <div><strong>Email:</strong> {dossierData.attendant?.email || '-'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <strong>Avaliação (CSAT):</strong> 
                          {dossierData.csat?.rating ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '1px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '0.78rem' }}>
                              <Star size={12} fill="#f59e0b" /> {dossierData.csat.rating}/5 estrelas
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }} className="dossier-text-muted">Pendente / Não avaliado</span>
                          )}
                        </div>
                        {dossierData.csat?.comment && (
                          <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '2px' }}>
                            "{dossierData.csat.comment}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transcrição Cronológica */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }} className="dossier-text-muted">
                      Transcrição Integral da Conversa ({dossierData.messages?.length || 0} registros)
                    </div>

                    <div className="dossier-messages-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                      {(!dossierData.messages || dossierData.messages.length === 0) ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          Nenhuma mensagem registrada neste atendimento.
                        </div>
                      ) : (
                        dossierData.messages.map((m, idx) => {
                          const msgTime = m.createdAt || m.timestamp;
                          const isFromMe = m.fromMe ?? (m.role === 'assistant' || m.role === 'operator' || m.role === 'system');
                          const senderLabel = isFromMe 
                            ? (m.senderName || dossierData.attendant?.name || 'Atendente / Empresa') 
                            : (m.senderName || dossierData.client?.name || dossierData.contact?.name || 'Cliente');
                          const timeStr = msgTime ? new Date(msgTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                          const dateStr = msgTime ? new Date(msgTime).toLocaleDateString('pt-BR') : '';

                          return (
                            <div 
                              key={m.id || idx}
                              className={isFromMe ? 'dossier-bubble-attendant' : 'dossier-bubble-client'}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                backgroundColor: isFromMe ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                                border: isFromMe ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border-subtle)',
                                fontSize: '0.82rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }} className="dossier-text-muted">
                                <strong>{senderLabel}</strong>
                                <span>{dateStr} às {timeStr}</span>
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.45' }}>
                                {m.content || m.caption || (m.mediaType ? `[Arquivo de Mídia: ${m.mediaType}]` : '')}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Assinatura Digital & Hash SHA-256 */}
                  <div 
                    className="dossier-box"
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    <ShieldCheck size={24} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Certificação de Integridade Criptográfica (SHA-256)
                      </div>
                      <div 
                        className="dossier-hash"
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          color: '#94a3b8',
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          margin: '4px 0'
                        }}
                      >
                        {dossierData.securityHash}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }} className="dossier-text-muted">
                        Documento gerado eletronicamente em conformidade com as diretrizes de integridade de dados e registro de atendimento ao consumidor. O hash acima comprova que o histórico não foi adulterado.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div 
              className="dossier-no-print"
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handlePrintDossier}
                className="btn btn-primary"
                disabled={loadingDossier || !dossierData}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE ATENDIMENTOS DO CLIENTE */}
      {showAttendanceHistoryModal && (
        <div 
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10050,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAttendanceHistoryModal(false);
          }}
        >
          <div 
            className="modal-content animate-fade-in"
            style={{
              backgroundColor: 'var(--bg-secondary, #1e293b)',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
              width: '100%',
              maxWidth: '860px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Cabeçalho do Modal */}
            <div 
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-primary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Histórico de Atendimentos</span>
                    <span 
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {attendanceHistoryList.length} registro(s)
                    </span>
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Cliente: <strong>{selectedChat?.contactName || selectedChat?.name || 'Cliente'}</strong> • {formatBrazilianPhone(selectedChat?.contactJid)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAttendanceHistoryModal(false)}
                className="btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                title="Fechar histórico"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo / Timeline de Atendimentos */}
            <div 
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              {loadingAttendanceHistory ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 className="spin" size={32} style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--primary)' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Carregando histórico completo de atendimentos...</div>
                </div>
              ) : attendanceHistoryList.length === 0 ? (
                <div 
                  style={{
                    padding: '50px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-subtle)'
                  }}
                >
                  <Clock size={40} style={{ margin: '0 auto 12px auto', opacity: 0.4, color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Nenhum histórico anterior encontrado
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
                    Os atendimentos deste cliente são registrados automaticamente com número de protocolo oficial, operador responsável, duração e avaliação CSAT sempre que um chamado for concluído ou iniciado.
                  </div>
                </div>
              ) : (
                attendanceHistoryList.map((att, index) => {
                  const isCurrent = att.isCurrent || att.status === 'attending';
                  const isExpanded = expandedAttendanceId === att.id;
                  const rating = att.csatRating;

                  return (
                    <div 
                      key={att.id || att.protocol || index}
                      style={{
                        backgroundColor: isCurrent ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)',
                        borderRadius: '12px',
                        border: isCurrent ? '1.5px solid rgba(59, 130, 246, 0.45)' : '1px solid var(--border-subtle)',
                        padding: '16px 18px',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Linha Superior: Protocolo, Status e Avaliação CSAT */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span 
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.86rem',
                              color: 'var(--text-main)',
                              backgroundColor: 'var(--bg-secondary)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="Protocolo do Atendimento"
                          >
                            <FileText size={13} color="var(--primary)" />
                            {att.protocol}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyProtocol(att.protocol)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedProt === att.protocol ? '#10b981' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'color 0.15s'
                            }}
                            title={copiedProt === att.protocol ? 'Protocolo copiado!' : 'Copiar número do protocolo'}
                          >
                            {copiedProt === att.protocol ? <Check size={14} /> : <Copy size={14} />}
                          </button>

                          {/* Status Badge */}
                          {att.status === 'attending' ? (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                              Em Atendimento
                            </span>
                          ) : att.status === 'waiting' ? (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.35)'
                            }}>
                              Aguardando Fila
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(107, 114, 128, 0.15)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)'
                            }}>
                              🏁 Finalizado
                            </span>
                          )}
                        </div>

                        {/* Avaliação CSAT */}
                        <div>
                          {rating ? (
                            <div 
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: '#f59e0b'
                              }}
                              title={`Avaliação de Satisfação: ${rating}/5 estrelas`}
                            >
                              <div style={{ display: 'flex', gap: '2px' }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} size={13} fill={s <= rating ? '#f59e0b' : 'none'} color="#f59e0b" />
                                ))}
                              </div>
                              <span>{rating}/5</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                              Sem avaliação registrada
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bloco de Métricas do Atendimento */}
                      <div 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                          fontSize: '0.8rem',
                          backgroundColor: 'var(--bg-secondary)',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>Atendente Responsável</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <User size={13} color="var(--primary)" />
                            <span>{att.attendantName || 'IA / Automático'}</span>
                            {att.department && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({att.department})</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>Início do Atendimento</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={13} color="var(--text-muted)" />
                            <span>{att.startedAt ? new Date(att.startedAt).toLocaleString('pt-BR') : '-'}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>Encerramento</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={13} color="var(--text-muted)" />
                            <span>{att.closedAt ? new Date(att.closedAt).toLocaleString('pt-BR') : 'Em andamento'}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>Duração & Mensagens</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <MessageSquare size={13} color="var(--text-muted)" />
                            <span>{att.durationFormatted || '-'} • {att.totalMessages} msgs</span>
                          </div>
                        </div>
                      </div>

                      {/* Comentário CSAT (se houver) */}
                      {att.csatComment && (
                        <div 
                          style={{
                            marginTop: '10px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            borderLeft: '3px solid #f59e0b',
                            fontSize: '0.78rem',
                            color: 'var(--text-main)'
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#f59e0b' }}>💬 Feedback do Cliente: </span>
                          <em>"{att.csatComment}"</em>
                        </div>
                      )}

                      {/* Barra de Ações: Ver Mensagens e Dossiê */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedAttendanceId(isExpanded ? null : att.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                            padding: '4px 0'
                          }}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          <span>{isExpanded ? 'Ocultar mensagens deste chamado' : 'Ver mensagens trocadas neste chamado'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDossier(att.protocol)}
                          className="btn"
                          style={{
                            fontSize: '0.74rem',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer'
                          }}
                          title="Emitir Comprovante / Dossiê Oficial deste Atendimento em PDF"
                        >
                          <FileText size={13} /> Dossiê Oficial (PDF)
                        </button>
                      </div>

                      {/* Caixa Expansível de Mensagens deste Atendimento */}
                      {isExpanded && (
                        <div 
                          style={{
                            marginTop: '12px',
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-card, #090d16)',
                            border: '1px solid var(--border-subtle)',
                            maxHeight: '260px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {Array.isArray(att.messages) && att.messages.length > 0 ? (
                            att.messages.map((m, mIdx) => {
                              const isClient = m.role === 'user';
                              const isSys = m.role === 'system';

                              if (isSys) {
                                return (
                                  <div key={m.id || mIdx} style={{ textAlign: 'center', margin: '4px 0' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                                      {m.content}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  key={m.id || mIdx}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isClient ? 'flex-start' : 'flex-end'
                                  }}
                                >
                                  <div 
                                    style={{
                                      maxWidth: '75%',
                                      padding: '8px 12px',
                                      borderRadius: '10px',
                                      fontSize: '0.78rem',
                                      backgroundColor: isClient ? 'var(--bg-secondary)' : 'var(--primary)',
                                      color: isClient ? 'var(--text-main)' : '#ffffff',
                                      borderTopLeftRadius: isClient ? '2px' : '10px',
                                      borderTopRightRadius: isClient ? '10px' : '2px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                                    }}
                                  >
                                    <div style={{ fontSize: '0.68rem', opacity: 0.8, marginBottom: '2px', fontWeight: 600 }}>
                                      {m.senderName || (isClient ? 'Cliente' : 'Atendente')} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                      {m.content}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              Nenhuma mensagem registrada no intervalo deste atendimento.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé do Modal */}
            <div 
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--bg-primary)'
              }}
            >
              <button
                type="button"
                onClick={() => setShowAttendanceHistoryModal(false)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE NOME DO CONTATO */}
      {showEditContactModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10070,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '440px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Editar Nome do Contato
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Salva o nome oficial no WhatsApp
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEditContactModal(false)} 
                className="btn-icon" 
                style={{ width: '30px', height: '30px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContactName}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nome Identificador
                </label>
                <input 
                  type="text"
                  value={editingContactName}
                  onChange={(e) => setEditingContactName(e.target.value)}
                  placeholder="Ex: Jonathan Gomes"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Número: <strong>{formatBrazilianPhone(selectedChat?.contactJid)}</strong> <br />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>({selectedChat?.contactJid})</span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowEditContactModal(false)} 
                  className="btn btn-secondary"
                  disabled={savingContactName}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingContactName || !editingContactName.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {savingContactName ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Salvar Nome</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE AGENDAMENTO RÁPIDO NO CHAT */}
      {showQuickAptModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10070,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '480px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Agendar Horário / Consulta
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Para {selectedChat?.contactName || selectedChat?.name || 'Cliente'}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowQuickAptModal(false)} 
                className="btn-icon" 
                style={{ width: '30px', height: '30px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickAppointment}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Serviço / Assunto *
                </label>
                <input 
                  type="text"
                  value={quickAptData.title}
                  onChange={(e) => setQuickAptData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Consulta Médica, Reunião, Atendimento Presencial"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Data *
                  </label>
                  <input 
                    type="date"
                    value={quickAptData.date}
                    onChange={(e) => setQuickAptData(prev => ({ ...prev, date: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Horário *
                  </label>
                  <input 
                    type="time"
                    value={quickAptData.time}
                    onChange={(e) => setQuickAptData(prev => ({ ...prev, time: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Duração estimada
                </label>
                <select
                  value={quickAptData.durationMinutes}
                  onChange={(e) => setQuickAptData(prev => ({ ...prev, durationMinutes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none'
                  }}
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1 hora e 30 min</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Observações internas (opcional)
                </label>
                <textarea 
                  value={quickAptData.notes}
                  onChange={(e) => setQuickAptData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Instruções para o dia, documentos a trazer, etc."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox"
                  id="sendImmediateConfirmation"
                  checked={quickAptData.sendImmediateConfirmation}
                  onChange={(e) => setQuickAptData(prev => ({ ...prev, sendImmediateConfirmation: e.target.checked }))}
                  style={{ accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <label htmlFor="sendImmediateConfirmation" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                  Disparar confirmação e lembretes automáticos anti-falta via WhatsApp
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowQuickAptModal(false)} 
                  className="btn btn-secondary"
                  disabled={savingQuickApt}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingQuickApt || !quickAptData.title.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#10b981', borderColor: '#10b981' }}
                >
                  {savingQuickApt ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
                  <span>Confirmar Agendamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Menu de Contexto (Botão Direito na Mensagem) */}
      {contextMenu && contextMenu.visible && (
        <div
          id="message-context-menu"
          className="glass-panel animate-fade-in"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 99999,
            minWidth: '220px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '6px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            userSelect: 'none'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Se for figurinha: 1. Adicionar às figurinhas */}
          {contextMenu.isSticker && (
            <button
              type="button"
              onClick={() => handleSaveStickerToMyCollection(contextMenu.msg)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '9px 12px',
                background: 'none',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
            >
              <Sticker size={16} color="var(--primary)" />
              <span>Adicionar às figurinhas</span>
            </button>
          )}

          {/* Opção: Responder com IA */}
          <button
            type="button"
            onClick={() => handleAiReplyToMessage(contextMenu.msg)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '9px 12px',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = '#8b5cf6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
          >
            <Sparkles size={16} color="#8b5cf6" />
            <span>Responder com IA</span>
          </button>

          {/* Opção: Responder */}
          <button
            type="button"
            onClick={() => handleReplyMessage(contextMenu.msg)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '9px 12px',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
          >
            <CornerUpLeft size={16} color="var(--primary)" />
            <span>Responder</span>
          </button>

          {/* Opção: Reagir */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setContextMenu(prev => ({ ...prev, showReactions: !prev.showReactions }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '9px 12px',
                background: 'none',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                setContextMenu(prev => ({ ...prev, showReactions: true }));
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.color = '#f59e0b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smile size={16} color="#f59e0b" />
                <span>Reagir</span>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.6 }} />
            </button>

            {/* Submenu de Reações Rápidas */}
            {contextMenu.showReactions && (
              <div
                className="glass-panel animate-fade-in"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: '0',
                  marginLeft: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 8px',
                  borderRadius: '24px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  zIndex: 100000
                }}
              >
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReactionFromMenu(contextMenu.msg, emoji)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      padding: '3px 4px',
                      borderRadius: '6px',
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
