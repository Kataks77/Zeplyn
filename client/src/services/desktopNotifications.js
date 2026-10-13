/**
 * desktopNotifications.js
 * Gerenciador de Notificações Nativas do Windows / Desktop via Web Notifications API
 * e sintetizador de alerta sonoro via Web Audio API.
 */

class DesktopNotificationService {
  constructor() {
    this.lastNotified = new Map(); // Debounce por contato
    this.audioCtx = null;
    this.titleFlashInterval = null;
    this.originalTitle = typeof document !== 'undefined' ? (document.title || 'Zeplyn') : 'Zeplyn';
    this.currentCounts = { waitingCount: 0, unreadCount: 0 };
    
    // Configura escuta de foco para restaurar título normal
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.clearTitleFlash());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.clearTitleFlash();
      });
    }
  }

  isSupported() {
    try {
      return typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined';
    } catch {
      return false;
    }
  }

  getPermission() {
    try {
      if (!this.isSupported()) return 'unsupported';
      return Notification.permission || 'default';
    } catch {
      return 'unsupported';
    }
  }

  isEnabled() {
    try {
      if (!this.isSupported()) return false;
      if (this.getPermission() !== 'granted') return false;
      return localStorage.getItem('desktop_notifications_enabled') !== 'false';
    } catch {
      return false;
    }
  }

  setEnabled(enabled) {
    try {
      localStorage.setItem('desktop_notifications_enabled', enabled ? 'true' : 'false');
    } catch (e) {
      // Ignora erro de localStorage em modo privado
    }
    window.dispatchEvent(new CustomEvent('desktop:permission_changed', { detail: { enabled, permission: this.getPermission() } }));
  }

  isSoundMuted() {
    try {
      return localStorage.getItem('desktop_notifications_sound_muted') === 'true';
    } catch {
      return false;
    }
  }

  setSoundMuted(muted) {
    try {
      localStorage.setItem('desktop_notifications_sound_muted', muted ? 'true' : 'false');
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('desktop:sound_muted_changed', { detail: { muted } }));
  }

  async requestPermission() {
    if (!this.isSupported()) {
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.setEnabled(true);
      }
      window.dispatchEvent(new CustomEvent('desktop:permission_changed', { detail: { permission } }));
      return permission;
    } catch (err) {
      console.error('Erro ao solicitar permissão de notificações:', err);
      return this.getPermission();
    }
  }

  _getAudioContext() {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * 🚨 SOM DE FILA DE ESPERA (Alerta Urgente e Nítido)
   * Toque duplo ascendente mais perceptível para quando um cliente entra na fila
   */
  playQueueAlert() {
    if (this.isSoundMuted()) return;
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Beep 1 (Atenção - 659.25 Hz / E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Beep 2 (Urgência nítida - 880 Hz / A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.14);
      gain2.gain.setValueAtTime(0.32, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.45);
    } catch (e) {}
  }

  /**
   * 💬 SOM DE MENSAGEM DO ATENDIMENTO (Suave & Discreto)
   * Som de bolha suave para mensagens normais do cliente durante o chat ativo
   */
  playMessageChime() {
    if (this.isSoundMuted()) return;
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Nota suave 1 (523.25 Hz / C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.14, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Nota suave 2 (783.99 Hz / G5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.08);
      gain2.gain.setValueAtTime(0.16, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.40);
    } catch (e) {}
  }

  /**
   * 🔄 SOM DE TRANSFERÊNCIA DE ATENDIMENTO (Harmônico)
   */
  playTransferAlert() {
    if (this.isSoundMuted()) return;
    try {
      const ctx = this._getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [587.33, 739.99, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + (idx * 0.1));
        gain.gain.setValueAtTime(0.2, now + (idx * 0.1));
        gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.1) + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + (idx * 0.1));
        osc.stop(now + (idx * 0.1) + 0.35);
      });
    } catch (e) {}
  }

  /**
   * Compatibilidade legado
   */
  playChime() {
    this.playMessageChime();
  }

  /**
   * 🔔 CONTADOR DINÂMICO NA ABA DO NAVEGADOR
   * Atualiza document.title com badges (ex: "(3) 🚨 Fila de Espera | Zeplyn")
   * e pisca alternadamente quando a aba está em segundo plano
   */
  updateTitleBadge({ waitingCount = 0, unreadCount = 0, flashMessage = null } = {}) {
    if (typeof document === 'undefined') return;

    this.currentCounts = {
      waitingCount: Math.max(0, waitingCount),
      unreadCount: Math.max(0, unreadCount)
    };

    const total = this.currentCounts.waitingCount + this.currentCounts.unreadCount;
    let badgeTitle = 'Zeplyn';

    if (this.currentCounts.waitingCount > 0) {
      badgeTitle = `(${this.currentCounts.waitingCount}) 🚨 Fila de Espera | Zeplyn`;
    } else if (this.currentCounts.unreadCount > 0) {
      badgeTitle = `(${this.currentCounts.unreadCount}) 💬 Nova Mensagem | Zeplyn`;
    }

    // Se estiver em segundo plano e foi passado um evento de destaque, faz a aba piscar
    if (typeof document !== 'undefined' && document.hidden && (flashMessage || total > 0)) {
      this.startTitleFlash(flashMessage || (this.currentCounts.waitingCount > 0 ? 'Cliente na Fila!' : 'Nova Mensagem!'), badgeTitle);
    } else {
      this.clearTitleFlash();
      document.title = badgeTitle;
    }
  }

  startTitleFlash(flashText, steadyTitle) {
    this.clearTitleFlash();
    let state = false;
    const total = this.currentCounts.waitingCount + this.currentCounts.unreadCount;
    const prefix = total > 0 ? `(${total}) ` : '';

    this.titleFlashInterval = setInterval(() => {
      state = !state;
      if (document.hidden) {
        document.title = state ? `${prefix}🔔 ${flashText}` : steadyTitle;
      } else {
        this.clearTitleFlash();
        document.title = steadyTitle;
      }
    }, 1200);
  }

  clearTitleFlash() {
    if (this.titleFlashInterval) {
      clearInterval(this.titleFlashInterval);
      this.titleFlashInterval = null;
    }
    const total = this.currentCounts.waitingCount + this.currentCounts.unreadCount;
    if (this.currentCounts.waitingCount > 0) {
      document.title = `(${this.currentCounts.waitingCount}) 🚨 Fila de Espera | Zeplyn`;
    } else if (this.currentCounts.unreadCount > 0) {
      document.title = `(${this.currentCounts.unreadCount}) 💬 Nova Mensagem | Zeplyn`;
    } else {
      document.title = 'Zeplyn';
    }
  }

  /**
   * Limpa o badge do título e restaura para o título padrão
   */
  clearTitleBadge() {
    this.clearTitleFlash();
    this.currentCounts = { waitingCount: 0, unreadCount: 0 };
    if (typeof document !== 'undefined') {
      document.title = 'Zeplyn';
    }
  }

  /**
   * Notificação de fila de espera (alias amigável)
   */
  notifyQueueAlert({ contactName, contactJid, message, reason, sectorName, chatId } = {}) {
    return this.notifyWaitingClient({
      contactName,
      contactJid,
      message,
      reason: reason || (sectorName ? `Setor: ${sectorName}` : null),
      chatId
    });
  }

  /**
   * Notificação de nova mensagem recebida
   */
  notifyNewMessage({ contactName, message, contactJid, chatId } = {}) {
    if (!this.isEnabled()) return null;

    const contactKey = contactJid || chatId || 'unknown';
    const now = Date.now();
    const lastTime = this.lastNotified.get(contactKey) || 0;
    if (now - lastTime < 3000) return null;
    this.lastNotified.set(contactKey, now);

    const name = contactName || 'Cliente';
    const title = `💬 Mensagem de ${name}`;
    const cleanMsg = (message || '').length > 80 ? (message || '').substring(0, 77) + '...' : (message || 'Nova mensagem recebida');

    try {
      const notification = new Notification(title, {
        body: cleanMsg,
        icon: '/favicon-dark.svg',
        badge: '/favicon-dark.svg',
        tag: `msg_${contactKey}`,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('app:open_chat', {
          detail: { contactJid, chatId, contactName }
        }));
        notification.close();
      };

      return notification;
    } catch (err) {
      return null;
    }
  }

  /**
   * Dispara notificação nativa do Windows para clientes na fila de espera
   */
  notifyWaitingClient({ contactName, contactJid, message, reason, chatId }) {
    if (!this.isEnabled()) {
      // Mesmo sem notificação nativa do Windows, toca o som da fila e atualiza a aba
      this.playQueueAlert();
      return null;
    }

    const contactKey = contactJid || chatId || 'unknown';
    const now = Date.now();
    const lastTime = this.lastNotified.get(contactKey) || 0;

    // Debounce de 10 segundos por contato
    if (now - lastTime < 10000 && !reason) {
      return null;
    }
    this.lastNotified.set(contactKey, now);

    // Toca alerta sonoro de fila
    this.playQueueAlert();

    const name = contactName || 'Novo Cliente';
    const title = `🚨 Cliente na Fila: ${name}`;
    
    let body = 'Aguardando atendimento na fila do WhatsApp.';
    if (reason) {
      body = `⚠️ ${reason}\nClique para assumir o atendimento.`;
    } else if (message) {
      const cleanMsg = message.length > 80 ? message.substring(0, 77) + '...' : message;
      body = `"${cleanMsg}"\nClique para abrir e responder.`;
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/favicon-dark.svg',
        badge: '/favicon-dark.svg',
        tag: `waiting_${contactKey}`,
        requireInteraction: true,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('app:open_chat', {
          detail: { contactJid, chatId, contactName }
        }));
        notification.close();
      };

      return notification;
    } catch (err) {
      console.error('Falha ao instanciar notificação nativa do Windows:', err);
      return null;
    }
  }

  /**
   * Dispara notificação nativa do Windows quando um atendimento for transferido para o operador
   */
  notifyTransfer({ contactName, contactJid, fromAttendantName, note, chatId }) {
    this.playTransferAlert();

    if (!this.isEnabled()) return null;

    const name = contactName || 'Cliente';
    const title = `🔄 Atendimento Transferido: ${name}`;
    let body = `Transferido por ${fromAttendantName || 'Colega de Equipe'}.`;
    if (note && note.trim()) {
      body += `\nMotivo: "${note.trim()}"`;
    }
    body += '\nClique para abrir e assumir a conversa.';

    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/favicon-dark.svg',
        badge: '/favicon-dark.svg',
        tag: `transfer_${contactJid || chatId || Date.now()}`,
        requireInteraction: true,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('app:open_chat', {
          detail: { contactJid, chatId, contactName }
        }));
        notification.close();
      };

      return notification;
    } catch (err) {
      console.error('Falha ao instanciar notificação de transferência:', err);
      return null;
    }
  }

  /**
   * Envia uma notificação de teste para o operador verificar no Windows
   */
  async sendTestNotification() {
    if (this.getPermission() !== 'granted') {
      const res = await this.requestPermission();
      if (res !== 'granted') return false;
    }

    this.playQueueAlert();

    try {
      const notif = new Notification('✅ Zeplyn: Alertas Ativos', {
        body: 'Perfeito! Você receberá alertas sonoros e visuais sempre que um cliente estiver na fila de espera.',
        icon: '/favicon-dark.svg',
        tag: 'test_zeplyn_notification',
        requireInteraction: false
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return true;
    } catch (e) {
      console.error('Erro ao enviar notificação de teste:', e);
      return false;
    }
  }
}

export const desktopNotifications = new DesktopNotificationService();
