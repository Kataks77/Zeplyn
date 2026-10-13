import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  getSocket() {
    if (!this.socket) {
      this.connect();
    }
    return this.socket;
  }

  connect(tokenOverride = null) {
    let token = tokenOverride;
    if (!token && typeof localStorage !== 'undefined') {
      try {
        token = localStorage.getItem('token');
      } catch (_) {}
    }

    if (this.socket) {
      if (token) {
        this.socket.auth = { token };
        if (this.socket.connected) {
          this.socket.emit('join-company', { token });
        }
      }
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return this.socket;
    }

    let host = window.location.origin;
    if (window.location.port === '5173') {
      host = `http://${window.location.hostname}:3000`;
    }

    this.socket = io(host, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('⚡ [Socket.IO] Conectado ao servidor:', this.socket.id);
      if (token) {
        this.socket.emit('join-company', { token });
      }
      window.dispatchEvent(new CustomEvent('socket:status', { detail: { connected: true } }));
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.warn('⚠️ [Socket.IO] Desconectado:', reason);
      window.dispatchEvent(new CustomEvent('socket:status', { detail: { connected: false, reason } }));
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      console.error('❌ [Socket.IO] Erro de conexão:', error.message);
      window.dispatchEvent(new CustomEvent('socket:status', { detail: { connected: false, error: error.message } }));
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  on(event, callback) {
    if (!this.socket) this.connect();
    this.socket.on(event, callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (!this.socket) this.connect();
    this.socket.emit(event, data);
  }
}

export const socketService = new SocketService();
